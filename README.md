# WORDHOARD — a greenhouse of words

Fourteen nights of winter remain.
The vault holds the last words.
Tend them: they are the only thing that grows here.

**WORDHOARD** is a short game (10–15 minutes per run) about care and chance.
The seeds are words, and every word has needs written into its own letters:
vowels make it thirsty, hard consonants shrug off the frost, length sets how
long it takes to bloom. Whatever blooms is kept, and when the thaw comes it
is read as a poem. No poem repeats.

## Play

Open `index.html` in any browser. No install, no connection needed.

The first seed is already selected and empty beds glow: **click a glowing
bed to plant**. A guide line above the buttons always names your next move
and what it does. The armed action shows as a solid bright button, and the
beds it can touch glow.

- **Plant**: pick a seed from the pouch and an empty bed.
- **Water**: the chosen bed drinks fully; its row neighbors get a sip.
- **Give light**: the plant grows twice as fast that night (if watered).
- **Shelter**: protects from tonight's frost. The forecast is up top.
- **Graft**: join two grown stems and a new, vigorous word is born.
- You get 3 actions per day. At night, winter does its thing. Each new day
  starts back in plant mode.

The **seed code** reproduces the exact same run: share it and someone else
tends the same garden.

## The end of winter

At the thaw, the poem is composed from whatever bloomed. There are four
endings, from silence to the hoard that sings. A neglected garden never gets
to say anything.

## Inside

- No dependencies: plain HTML + CSS + JavaScript (`verbo.js` is the engine,
  kept separate from the interface and testable).
- Reproducible chance: every run grows from its seed code.
- `node test.js` runs 60+ simulated games checking balance, determinism,
  and that neglect has its own ending.
- `npm install && npx playwright test` runs the UI regression suite: every
  test asserts a *visible* change after each tap (glyphs, glow, log lines,
  day counter), not just that a click executed. Set `CHROME_PATH` to use a
  system Chrome instead of downloading browsers.

## Authorship

Designed and written by **Mafalda**, November 2026, as an experiment in
autonomous authorship: a game with its own identity, made with no genre or
aesthetic brief. The world is still blowing words.

## License

MIT — see `LICENSE`.
