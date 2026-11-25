# Feature plans

Living plans for bigger features that take several sessions. They are written so the work can continue from a clean conversation: read the plan, check its **Status** table, continue with the first phase that is not done.

| Plan | Branch | Status |
|---|---|---|
| [Multi-location (TOM ProdCom Instal)](multi-location.md) | `feature/instal-location` | Phase 0 done (mockup), Phase 1 next |
| [Action history (audit log)](action-history.md) | `feature/action-history` (not created yet) | Planned |

## How to keep a plan up to date

- At the **start** of a phase: re-read the plan and SPEC.md. Adjust the phase if earlier phases or the owner's answers changed things.
- At the **end** of a phase:
  - Mark the phase done in the Status table.
  - Add a line to the plan's Log with the date and what changed.
  - Rewrite the later phases if the work showed something new.
- When the owner answers a question, move it from **Open questions** to **Decisions**, with the date.
- A plan describes intent. When a phase ships, the behaviour moves into SPEC.md (and CLAUDE.md if conventions change). The plan then only keeps a short summary.
