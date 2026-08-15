# Context isolation boundary

Three agents, three separate `claude -p` processes. There is no shared conversation, no shared
transcript, and no message passing between them. Everything that crosses from one agent to the
next crosses as a **file on disk that the orchestrator wrote**, after the orchestrator filtered it.

```
                    ┌────────────────────────────────────────┐
                    │ orchestrator (pipeline/orchestrate.mjs)│
                    └────────────────────────────────────────┘
                       │              │                │
        request.json   │              │                │  editor.in.json
        ledger.json    ▼              ▼                ▼  editor.budget.json
    ┌──────────────────────┐  ┌────────────────┐  ┌──────────────────┐
    │ A · axi-generator    │  │ B · axi-verifier│  │ C · axi-editor   │
    │ cwd = repo root      │  │ cwd = verifier. │  │ cwd = repo root  │
    │                      │  │       box/      │  │                  │
    └──────────────────────┘  └────────────────┘  └──────────────────┘
        │ generator.out.json      │ verifier.out.json    │ editor.out.json
        ▼                         ▼                      ▼
    ┌────────────────────────────────────────────────────────────────┐
    │ allowlist filter  →  verifier.in.json                          │
    │ frozen-element hash taken before C, re-checked after C         │
    └────────────────────────────────────────────────────────────────┘
```

## The boundary that matters: A → B

The Verifier must never see the Generator's prompt, reasoning, or intermediate steps. An agent
shown someone else's reasoning agrees with it, and an agreeing verifier verifies nothing.

Four mechanisms enforce this, in order of how much they are relied on:

**1. Separate processes.** Each agent is a fresh `claude -p` invocation. There is no mechanism
by which the Generator's context could reach the Verifier, because there is no shared context to
leak. This is the load-bearing one; the rest are defence in depth.

**2. Field allowlist.** `pipeline/lib/payload.mjs` projects `generator.out.json` onto
`VERIFIER_VISIBLE_FIELDS` to produce `verifier.in.json`. Anything not on the list is dropped —
not redacted, dropped. Adding a field to the payload does not automatically expose it; someone
has to add it to the allowlist on purpose.

**3. Leak scan.** The same module refuses to write `verifier.in.json` if any surviving string
value matches the forbidden-key patterns (`prompt`, `rationale`, `reasoning`, `chain_of_thought`,
`draft`, `why_i_chose`, `instruction`) or exceeds the declared field budget. The run fails; it
does not sanitise and continue.

**4. Filesystem sandbox.** The Verifier runs with `cwd = <run>/verifier.box/`, a directory
containing exactly two files: `verifier.in.json` and a copy of `theorems.json`. It is launched
without `--add-dir` for the run directory, so `generator.out.json` and `request.json` are outside
its working tree. Bash is still available to it (it needs Python), so this is a speed bump rather
than a jail — which is why it is fourth on the list and not first.

## What the Generator does not get back

The Verifier's findings are **not** returned to the Generator for repair. A failed lesson is
discarded and the run ends. There is no fix-and-resubmit loop, because a Generator that sees
which check caught it will learn to write payloads that pass checks rather than payloads that
are true.

## What the Editor does and does not see

The Editor sees the verified lesson and the runtime budget. It does not see the Verifier's
findings — it has no use for them, and a list of things that were almost wrong is an invitation
to "clarify" them, which is editing mathematics.

The orchestrator hashes every frozen element before invoking the Editor and re-hashes after.
A changed hash fails the run irrespective of the Editor's self-reported status.

## Two SymPy scripts, written blind

Per the run decision on §3.1, both the Generator and the Verifier write an independent check for
every claim. The Generator's script is inside the payload but is **not** on the Verifier-visible
allowlist until the Verifier has written and saved its own — the orchestrator releases it only
in the second phase, and only for explaining a disagreement. Both scripts are executed by the
orchestrator, never by the agent that wrote them.

Disagreement between the two scripts, or between either script and the text, fails the lesson.
Neither script is edited to resolve the disagreement.
