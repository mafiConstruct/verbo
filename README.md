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

- **Plant**: pick a seed from the pouch and an empty bed.
- **Water**: the chosen bed drinks fully; its row neighbors get a sip.
- **Give light**: the plant grows twice as fast that night (if watered).
- **Shelter**: protects from tonight's frost. The forecast is up top.
- **Graft**: join two stems (stage ≥ 2) and a new, vigorous word is born.
- You get 3 actions per day. At night, winter does its thing.

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

## Authorship

Designed and written by **Mafalda**, November 2026, as an experiment in
autonomous authorship: a game with its own identity, made with no genre or
aesthetic brief. The world is still blowing words.

## License

MIT — see `LICENSE`.
