# Lesson schema — TODO

**Out of scope for the bootstrap session, by explicit instruction.** Do not design it here, and
do not let its absence block anything. This file is the placeholder.

Until a schema exists, the lesson is an **opaque structured payload** passing between the three
agents. Everything that touches it is written to tolerate that:

| Place | How it stays loose |
|---|---|
| `pipeline/lib/payload.mjs` | `VERIFIER_VISIBLE_FIELDS` and `FROZEN_PATHS` are flat lists. A real schema replaces the lists; nothing else moves. |
| `pipeline/stages/generate.mjs` | `preflight()` checks structure only — null discipline, sampling replay, scope. It never inspects mathematical content. |
| `web/src/timeline.ts` | Reads every field defensively. A missing section is omitted, never invented. |
| `web/src/Lesson.tsx` | A missing field renders as an explicit marker (`.missing`), never as filler copy. |

## Fields the pipeline already relies on

These are load-bearing today. Whatever schema lands must keep them or update the two lists above
in the same change:

```
lesson_id, concept_slug, tags[], title, language
claims[]           { claim_id, statement, formula, value }
method, mechanism
examples[]         { claim_id, operands[], steps[], result }
sampling           { seed, spec{min,max,filter}, draws[], rejections[], rejection_rate }
applicability      { condition, formal }
counterexample     { input, method_says, truth }        // null iff universality is claimed
universality       { kind: "theorem"|"exhaustive", theorem_id, hypothesis_mapping, domain, check_script }
nulls[]            { field, reason }                    // §3.3
generator_checks[] { claim_id, script }                 // released to the Verifier only in phase 2
```

## Decisions to make when the schema is designed

- **Where narration text lives.** Timing is driven by hand-authored audio, so the payload needs a
  segment id per beat that matches the audio segment ids in `request.json`. Today `timeline.ts`
  derives ids positionally (`example-0`), which will not survive a real edit pass.
- **Whether `steps[]` carries LaTeX, prose, or both.** `Lesson.tsx` currently accepts either and
  guesses per element. That guess should not survive into production.
- **How a multi-claim lesson maps onto beats.** One claim per beat is assumed and not enforced.
- **Versioning.** The ledger stores runs across schema changes; entries need a schema version or
  old runs become unreadable.

## Non-negotiable regardless of schema

Whatever shape it takes, the schema must make it impossible to express a lesson that:

- states a result without the mechanism that produces it
- has neither a counterexample nor a universality proof (§3.2)
- carries operands that did not come from a recorded seeded draw (§3.4)
- fills a required field with an invented value instead of `null` + reason (§3.3)

A schema that permits any of these moves the enforcement burden back onto the model, which is
where it was before this pipeline existed.
