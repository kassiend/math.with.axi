# Axi — the desktop app

A Windows front end for the worker. Five buttons, no logic of its own.

```
┌──────────────────────────────────────────────────────────┐
│  [ Generate now ]  [ Run worker ]                        │
│                                                          │
│  [ Create lesson ]  [ Create lesson 20s ]  [ … 40s ]     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ live output from the run                           │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

| button | command |
|---|---|
| Generate now | `worker now` — lesson + task20 + task40 |
| Run worker | `worker` — stays running, fires daily at `WORKER_DAILY_AT` |
| Create lesson | `worker now --posts lesson` |
| Create lesson 20s | `worker now --posts task20` |
| Create lesson 40s | `worker now --posts task40` |

Each button is a command you could type. Nothing is generated a second way, so the ledgers, the
render gates and Telegram delivery behave identically whether a run started here or in a terminal.
Posts go to the paired chat; the app does not save them anywhere of its own.

While a run is going, its own button becomes **Stop** and the rest are disabled — one run at a
time, and stopping kills the whole process tree. That matters: beneath `node` sit `claude`,
`python`, `ffmpeg` and a headless Chromium, and killing only the parent leaves those orphaned and
still spending.

## Build

```powershell
npm run desktop
```

Output: `desktop\dist\Axi.exe`, about 15 KB.

It compiles with the C# compiler included in the .NET Framework, which is present on every
Windows 10/11 install — no SDK, no NuGet, no npm package, and nothing added to the repository's
toolchain. `dist/` is gitignored because the build takes a second.

Make a shortcut to the .exe anywhere you like. It finds the repository by walking up from wherever
the .exe itself lives, looking for `core\worker\index.mjs`, so a shortcut on the desktop is fine —
but moving the .exe out of the checkout is not.

## What it needs

Node on `PATH`, plus everything `npm run worker -- status` checks: ffmpeg, ffprobe, the Claude
Code CLI, the Python venv, a filled-in `.env` and a paired chat. The app reports a missing Node or
a missing checkout on startup; the rest surface the moment a run begins, in the log pane.

Pairing has no button. It is a once-per-machine step that needs you to message the bot while it
waits, which reads far better in a terminal:

```
npm run worker -- pair
```
