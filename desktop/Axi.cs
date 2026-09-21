// Axi — a desktop front end for the worker.
//
// Five buttons over `node core/worker/index.mjs`. It adds no logic of its own: every button is a
// command you could type, and the ledgers, the gates and the Telegram delivery behave exactly as
// they do from a terminal. That is deliberate — a GUI that generated posts a different way would
// be a second implementation to keep honest.
//
// Built with the csc.exe that ships in the .NET Framework, so the repository gains no toolchain
// and the output is one portable .exe. See build.ps1.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace Axi
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    public class MainForm : Form
    {
        // Layout constants. The two spacers are the ones in the brief: 8 between buttons in a
        // row, 16 between the rows.
        const int GAP = 8;
        const int ROW_GAP = 16;
        const int PAD = 16;

        readonly Button generateNow, runWorker, createLesson, create20, create40;
        readonly TextBox output;
        readonly Label status;

        Process job;             // the running node process, or null
        Button jobButton;        // the button that started it, relabelled to "Stop"
        string jobButtonText;    // its caption, to restore afterwards
        bool stoppedByUser;

        readonly string repoRoot;
        readonly string nodeExe;

        public MainForm()
        {
            Text = "Axi";
            Font = new Font("Segoe UI", 9F);
            AutoScaleMode = AutoScaleMode.Dpi;
            ClientSize = new Size(880, 620);
            MinimumSize = new Size(720, 460);
            StartPosition = FormStartPosition.CenterScreen;

            repoRoot = FindRepoRoot();
            nodeExe = FindNode();

            generateNow  = MakeButton("Generate now",     150, "worker now — lesson + task20 + task40, delivered to Telegram");
            runWorker    = MakeButton("Run worker",       150, "worker — stays running and fires daily at WORKER_DAILY_AT");
            createLesson = MakeButton("Create lesson",    150, "worker now --posts lesson");
            create20     = MakeButton("Create lesson 20s",150, "worker now --posts task20");
            create40     = MakeButton("Create lesson 40s",150, "worker now --posts task40");

            generateNow.Click  += (s, e) => Start(generateNow,  "now", null,     "Generating all three posts");
            runWorker.Click    += (s, e) => Start(runWorker,    null,  null,     "Worker running — waiting for the daily time");
            createLesson.Click += (s, e) => Start(createLesson, "now", "lesson", "Creating a lesson");
            create20.Click     += (s, e) => Start(create20,     "now", "task20", "Creating a 20s task");
            create40.Click     += (s, e) => Start(create40,     "now", "task40", "Creating a 40s task");

            var row1 = MakeRow(generateNow, runWorker);
            var row2 = MakeRow(createLesson, create20, create40);
            row2.Margin = new Padding(0, ROW_GAP, 0, 0);

            output = new TextBox
            {
                Multiline = true, ReadOnly = true, WordWrap = false,
                ScrollBars = ScrollBars.Both, Dock = DockStyle.Fill,
                Font = new Font("Consolas", 9F),
                BackColor = Color.FromArgb(24, 24, 27), ForeColor = Color.FromArgb(228, 228, 231),
                BorderStyle = BorderStyle.FixedSingle,
            };

            status = new Label
            {
                Dock = DockStyle.Bottom, Height = 24, TextAlign = ContentAlignment.MiddleLeft,
                ForeColor = Color.FromArgb(90, 90, 95),
            };

            // Column { Row { … }, Spacer(16), Row { … } } over a log pane. The pane is not in the
            // brief, but a button that starts a ten-minute job and shows nothing is a button you
            // cannot trust — a gate closing is a normal outcome and has to be readable.
            var controls = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.TopDown, Dock = DockStyle.Top,
                AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, WrapContents = false,
                Padding = new Padding(PAD, PAD, PAD, PAD),
            };
            controls.Controls.Add(row1);
            controls.Controls.Add(row2);

            var body = new Panel { Dock = DockStyle.Fill, Padding = new Padding(PAD, 0, PAD, PAD) };
            body.Controls.Add(output);

            Controls.Add(body);
            Controls.Add(controls);
            Controls.Add(status);

            FormClosing += OnFormClosing;

            if (repoRoot == null)
            {
                Fail("Cannot find the repository. Axi.exe expects to sit inside the checkout, "
                   + "e.g. desktop\\dist\\Axi.exe — it looks upward for core\\worker\\index.mjs.");
            }
            else if (nodeExe == null)
            {
                Fail("Cannot find node.exe on PATH. Install Node 20 or newer from nodejs.org, "
                   + "then reopen this app so it picks up the new PATH.");
            }
            else
            {
                status.Text = "Ready · " + repoRoot;
                Log("Axi — front end for the math.with.axi worker.");
                Log("repository : " + repoRoot);
                Log("node       : " + nodeExe);
                Log("");
                Log("Every button runs the worker exactly as the command line would.");
                Log("Posts are delivered to the paired Telegram chat, not saved here.");
                Log("");
            }
        }

        // --- layout helpers ---------------------------------------------------

        Button MakeButton(string text, int width, string tip)
        {
            var b = new Button
            {
                Text = text, Width = width, Height = 34,
                Margin = new Padding(0, 0, GAP, 0),   // the 8 between buttons
                UseVisualStyleBackColor = true,
            };
            new ToolTip().SetToolTip(b, tip);
            return b;
        }

        static FlowLayoutPanel MakeRow(params Control[] items)
        {
            var row = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.LeftToRight,
                AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink,
                WrapContents = false, Margin = Padding.Empty,
            };
            row.Controls.AddRange(items);
            return row;
        }

        void Fail(string message)
        {
            foreach (var b in new[] { generateNow, runWorker, createLesson, create20, create40 })
                b.Enabled = false;
            status.Text = "Not ready";
            Log("✗ " + message);
        }

        // --- locating things --------------------------------------------------

        /// Walk up from the executable until a directory holds core\worker\index.mjs. Anchored on
        /// a file the worker cannot run without, so a half-copied folder fails here with a clear
        /// message instead of at the first button press.
        static string FindRepoRoot()
        {
            var dir = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
            for (int i = 0; i < 8 && dir != null; i++)
            {
                if (File.Exists(Path.Combine(dir.FullName, "core", "worker", "index.mjs")))
                    return dir.FullName;
                dir = dir.Parent;
            }
            return null;
        }

        /// node.exe from PATH, then the default installer location. Not npm: npm on Windows is a
        /// .cmd shim that needs a shell, and going straight to node keeps the child process tree
        /// something we can kill.
        static string FindNode()
        {
            var path = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (var dir in path.Split(';'))
            {
                if (dir.Length == 0) continue;
                try
                {
                    var candidate = Path.Combine(dir.Trim(), "node.exe");
                    if (File.Exists(candidate)) return candidate;
                }
                catch (ArgumentException) { /* a malformed PATH entry — skip it */ }
            }
            var fallback = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
            return File.Exists(fallback) ? fallback : null;
        }

        // --- running the worker -----------------------------------------------

        void Start(Button source, string command, string posts, string what)
        {
            if (job != null) { Stop(); return; }

            var args = new StringBuilder();
            args.Append('"').Append(Path.Combine(repoRoot, "core", "worker", "index.mjs")).Append('"');
            if (command != null) args.Append(' ').Append(command);
            if (posts != null) args.Append(" --posts ").Append(posts);

            var psi = new ProcessStartInfo(nodeExe, args.ToString())
            {
                WorkingDirectory = repoRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            };

            job = new Process { StartInfo = psi, EnableRaisingEvents = true };
            job.OutputDataReceived += (s, e) => { if (e.Data != null) Post(() => Log(e.Data)); };
            job.ErrorDataReceived  += (s, e) => { if (e.Data != null) Post(() => Log(e.Data)); };
            job.Exited += (s, e) => Post(Finished);

            stoppedByUser = false;
            try
            {
                job.Start();
                job.BeginOutputReadLine();
                job.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                job = null;
                Log("✗ could not start node: " + ex.Message);
                return;
            }

            jobButton = source;
            jobButtonText = source.Text;
            source.Text = "Stop";
            foreach (var b in new[] { generateNow, runWorker, createLesson, create20, create40 })
                if (b != source) b.Enabled = false;

            status.Text = what + "…";
            Log("");
            Log("──────────────────────────────────────────────────────────────");
            Log("▸ " + what);
            Log("  node " + args.ToString().Replace(repoRoot + Path.DirectorySeparatorChar, ""));
            Log("──────────────────────────────────────────────────────────────");
        }

        /// Kill the whole tree, not just node. A run has claude, python, ffmpeg and chromium
        /// beneath it; killing the parent alone leaves those orphaned and still burning the
        /// machine — and, for claude, still spending.
        void Stop()
        {
            if (job == null) return;
            stoppedByUser = true;
            status.Text = "Stopping…";
            try
            {
                var kill = new ProcessStartInfo("taskkill", "/PID " + job.Id + " /T /F")
                {
                    UseShellExecute = false, CreateNoWindow = true,
                    RedirectStandardOutput = true, RedirectStandardError = true,
                };
                using (var p = Process.Start(kill)) p.WaitForExit(10000);
            }
            catch (Exception ex)
            {
                Log("! could not stop cleanly: " + ex.Message);
            }
        }

        void Finished()
        {
            int code = -1;
            try { code = job.ExitCode; } catch (InvalidOperationException) { /* already gone */ }

            if (stoppedByUser) { Log(""); Log("■ stopped"); status.Text = "Stopped"; }
            else if (code == 0) { Log(""); Log("✓ finished"); status.Text = "Finished"; }
            else { Log(""); Log("✗ exited with code " + code); status.Text = "Failed (exit " + code + ")"; }

            try { job.Dispose(); } catch (Exception) { }
            job = null;

            if (jobButton != null) { jobButton.Text = jobButtonText; jobButton = null; }
            foreach (var b in new[] { generateNow, runWorker, createLesson, create20, create40 })
                b.Enabled = true;
        }

        void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            if (job == null) return;
            var answer = MessageBox.Show(
                "A run is still going. Closing Axi stops it and everything it started.\n\n" +
                "Stop it and close?", "Axi", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
            if (answer == DialogResult.Yes) Stop();
            else e.Cancel = true;
        }

        // --- output -----------------------------------------------------------

        /// Process events arrive on a background thread; the log box may only be touched on the
        /// UI one. BeginInvoke rather than Invoke so a chatty run never blocks the reader.
        void Post(Action action)
        {
            if (IsDisposed || !IsHandleCreated) return;
            try { BeginInvoke(action); } catch (ObjectDisposedException) { }
        }

        void Log(string line)
        {
            output.AppendText(line + Environment.NewLine);
        }
    }
}
