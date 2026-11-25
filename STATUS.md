# STATUS

Last updated: 2026-11-25.

## State: finished (build 88)

WORDHOARD is a finished, free browser game. Build 88 was declared final on 2026-11-24. No new features are planned. Bug reports are still welcome as GitHub issues or itch comments.

## Where it lives

- Play on itch.io: https://maficonstruct.itch.io/wordhoard
- Source (this repo): https://github.com/mafiConstruct/wordhoard
- Code license: MIT (see `LICENSE`).

## What shipped in the final state

- Clearer ending: the poem reads back every harvested word, with a line that frames the run.
- Onboarding fixes: the guide line always names the next move, and the beds that can be acted on glow.
- Graft controls stay in place during comparison (build 86), after a player reported the graft button jumping out of view.
- A 21-second trailer and new screenshots on the itch page.
- UI regression tests (Playwright) and a simulation test (`node test.js`).

## Known limits

- Early feedback said the game is mostly text and has little visual feedback. Later builds added visuals and help text, but it is still a text-first game.

## Source of truth

This file describes the repo. The itch page text is in `docs/itch-page.md`. Decision history is in `DECISIONS.md`.
