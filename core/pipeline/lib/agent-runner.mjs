/**
 * Agent invocation. Every agent is a separate `claude -p` process — that separation IS the
 * context isolation (agents/ISOLATION.md). There is no in-process agent loop here on purpose:
 * a shared process is a shared context waiting to happen.
 *
 * Two backends:
 *   cli     — spawn the Claude Code CLI headless (default)
 *   manual  — write the input files, print what to run, and stop. For debugging a single stage
 *             by hand without burning a full pipeline run.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export class AgentError extends Error {
  constructor(message, { agent, code, stderr } = {}) {
    super(message);
    this.agent = agent;
    this.code = code;
    this.stderr = stderr;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.agent        subagent name, e.g. "axi-verifier"
 * @param {string} opts.prompt       the task
 * @param {string} opts.cwd          working directory — for the Verifier this is its sandbox
 * @param {string[]} [opts.allowedTools]
 * @param {string[]} [opts.addDirs]  extra readable dirs. Deliberately empty for the Verifier.
 * @param {string} opts.expectFile   file the agent must produce; missing file is a failure
 * @param {string} [opts.backend]    "cli" | "manual"
 */
export async function runAgent(opts) {
  const {
    agent, prompt, cwd, allowedTools = [], addDirs = [], expectFile,
    backend = process.env.AXI_AGENT_BACKEND ?? 'cli',
    timeout = DEFAULT_TIMEOUT_MS,
  } = opts;

  if (!agent || !prompt || !cwd || !expectFile) {
    throw new AgentError('runAgent needs agent, prompt, cwd and expectFile', { agent });
  }

  if (backend === 'manual') {
    const args = buildArgs({ agent, allowedTools, addDirs });
    console.log(`\n[manual] run this, then re-run the pipeline with --resume:\n` +
      `  cd ${cwd} && claude ${args.join(' ')} ${JSON.stringify(prompt)}\n` +
      `  expected output: ${expectFile}\n`);
    throw new AgentError(`manual backend: waiting for ${expectFile}`, { agent });
  }

  const args = [...buildArgs({ agent, allowedTools, addDirs }), prompt];
  const { code, stderr } = await spawnClaude(args, { cwd, timeout });

  if (code !== 0) {
    throw new AgentError(`${agent} exited with code ${code}`, { agent, code, stderr });
  }
  if (!fs.existsSync(expectFile)) {
    // An agent that produced no artifact produced nothing. It does not get to have "mostly run".
    throw new AgentError(`${agent} did not write ${expectFile}`, { agent, code, stderr });
  }
  return JSON.parse(fs.readFileSync(expectFile, 'utf8'));
}

function buildArgs({ agent, allowedTools, addDirs }) {
  const args = ['-p', '--agent', agent];
  if (allowedTools.length) args.push('--allowedTools', allowedTools.join(' '));
  for (const dir of addDirs) args.push('--add-dir', dir);
  return args;
}

function spawnClaude(args, { cwd, timeout }) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd, stdio: ['ignore', 'inherit', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; process.stderr.write(d); });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new AgentError(`agent timed out after ${timeout}ms`, { stderr }));
    }, timeout);
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stderr }); });
  });
}
