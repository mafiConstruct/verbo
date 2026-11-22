/* WORDHOARD — a greenhouse of words
   Game engine. No DOM: pure logic, testable in node.
   Author: Mafalda. Nov 2026. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VERBO = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- RNG ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // ---------- Lexicon ----------
  // Seed words of the world. Criterion: concrete texture, no big abstractions.
  const LEXICON = [
    'ember', 'acorn', 'ivy', 'orchard', 'echo', 'owl', 'ash', 'elm', 'anvil', 'inlet',
    'loam', 'moss', 'mist', 'nest', 'north', 'river', 'salt', 'sap', 'silt', 'reed',
    'rain', 'lantern', 'marrow', 'nettle', 'snow', 'bark', 'burrow', 'dawn', 'grove',
    'peat', 'pollen', 'tinder', 'thorn', 'dew', 'bramble', 'grain', 'turf', 'bole',
    'flint', 'frost', 'hollow', 'coal', 'crow', 'kettle', 'wick', 'quartz', 'husk',
    'furrow', 'cinder', 'wren', 'yarrow',
  ];
  const RARE = ['word', 'seed', 'shelter', 'name', 'verb'];

  // ---------- Traits derived from the word itself ----------
  const VOWELS = 'aeiou';
  function traits(word) {
    const w = word.toLowerCase();
    const letters = [...w];
    const vowels = letters.filter(c => VOWELS.includes(c)).length;
    const hardHits = (w.match(/ck|qu|[kjqxz]/g) || []).length;
    return {
      growth: Math.min(6, 2 + Math.floor(w.length / 3)), // nights from stem to bloom
      thirst: vowels >= 4 ? 2 : vowels >= 2 ? 1 : 0,     // damage per dry night
      hardiness: Math.min(3, hardHits),                  // frost it shrugs off alone
      fam: familyOf(w),
    };
  }
  function familyOf(w) {
    const c = [...(w || '').toLowerCase()][0] || '';
    if ('aeiou'.includes(c)) return 'light';
    if ('lmnrs'.includes(c)) return 'water';
    if ('bdgpt'.includes(c)) return 'earth';
    return 'stone';
  }
  function blend(a, b) {
    const x = a.toLowerCase(), y = b.toLowerCase();
    return x.slice(0, Math.ceil(x.length / 2)) + y.slice(Math.floor(y.length / 2));
  }

  // ---------- State ----------
  const BEDS = 9, DAYS = 14, STAGES = ['seed', 'sprout', 'stem', 'bud', 'bloom'];
  const ACTIONS_PER_DAY = 3;

  function rollFrost(state) {
    const d = state.day, r = state.rng();
    if (d <= 3)  return r < 0.40 ? 1 : 0;
    if (d <= 8)  return r < 0.65 ? (1 + Math.floor(r * 2)) : 0;
    if (d <= 12) return r < 0.45 ? 1 : 0;
    return r < 0.30 ? 1 : 0;
  }

  function newGame(seedCode) {
    const code = (seedCode && String(seedCode).trim()) || ('seed-' + Math.floor(Math.random() * 1e9).toString(36));
    const rng = mulberry32(hashStr(code));
    const lex = LEXICON.slice();
    const pouch = [];
    for (let i = 0; i < 5; i++) pouch.push(lex.splice(Math.floor(rng() * lex.length), 1)[0]);
    if (rng() < 0.25) pouch.push(RARE[Math.floor(rng() * RARE.length)]);
    const state = {
      code, rng, day: 1, actions: ACTIONS_PER_DAY,
      beds: new Array(BEDS).fill(null),
      pouch, poem: [], grafts: 0, bloomed: 0, vigorous: {}, lost: [],
      log: [], over: false, ending: null,
      windStock: lex.concat(RARE.filter(w => !pouch.includes(w))),
    };
    state.forecast = rollFrost(state);
    return state;
  }

  function say(state, msg) { state.log.push('Day ' + state.day + ' — ' + msg); }

  function stageCost(t) { return Math.min(3, Math.max(1, t.growth - 2)); }

  function plantAt(state, bed, word) {
    const t = traits(word);
    const vig = !!state.vigorous[word];
    state.beds[bed] = { word, stage: 0, progress: vig ? 2 : 0, water: 0, health: vig ? 5 : 4, age: 0, lit: false, sheltered: false, traits: t };
    state.pouch.splice(state.pouch.indexOf(word), 1);
    state.actions--;
    say(state, 'you planted «' + word + '».');
  }

  function water(state, bed) {
    // row watering: the chosen bed drinks fully; its row neighbors get a sip
    state.beds[bed].water = 2;
    const row = Math.floor(bed / 3);
    for (const n of [bed - 1, bed + 1]) {
      if (n >= 0 && n < BEDS && Math.floor(n / 3) === row && state.beds[n]) {
        state.beds[n].water = Math.max(state.beds[n].water, 1);
      }
    }
    state.actions--;
  }
  function light(state, bed) { state.beds[bed].lit = true; state.actions--; }
  function shelter(state, bed) { state.beds[bed].sheltered = true; state.actions--; }

  function graft(state, bedA, bedB) {
    const A = state.beds[bedA], B = state.beds[bedB];
    const w = blend(A.word, B.word);
    state.beds[bedA] = null; state.beds[bedB] = null;
    state.pouch.push(w);
    state.vigorous[w] = true;
    state.grafts++;
    state.actions -= 2;
    say(state, 'you grafted «' + A.word + '» with «' + B.word + '»: «' + w + '» was born, a new and vigorous word.');
    return w;
  }

  function aliveCount(state) {
    return state.beds.filter(Boolean).length + state.pouch.length;
  }

  function endDay(state) {
    const frost = state.forecast;
    if (frost > 0) say(state, 'frost, force ' + frost + '.');

    for (let i = 0; i < BEDS; i++) {
      const p = state.beds[i];
      if (!p) continue;
      p.age++;
      // growth
      if (p.water > 0 && p.stage < 4) {
        p.progress += 1 + (p.lit ? 1 : 0);
        p.stage = Math.min(4, Math.floor(p.progress / stageCost(p.traits)));
        p.water--;
      } else if (p.water <= 0 && p.traits.thirst > 0 && p.age >= 2) {
        p.health--;
        say(state, '«' + p.word + '» went thirsty (−1 health).');
      } else if (p.water > 0) { p.water--; }
      // frost
      if (frost > 0 && !p.sheltered) {
        const dmg = Math.max(0, frost - p.traits.hardiness);
        if (dmg > 0) { p.health -= dmg; say(state, 'the frost hit «' + p.word + '» (−' + dmg + ').'); }
      }
      // death
      if (p.health <= 0) {
        say(state, '«' + p.word + '» went dark.');
        state.lost.push(p.word);
        state.beds[i] = null;
        continue;
      }
      p.lit = false; p.sheltered = false;
    }

    // blooming at dawn
    for (let i = 0; i < BEDS; i++) {
      const p = state.beds[i];
      if (p && p.stage >= 4) {
        state.poem.push(p.word);
        state.bloomed++;
        state.pouch.push(p.word, p.word);
        state.beds[i] = null;
        say(state, '«' + p.word + '» bloomed. The word is safe now.');
      }
    }

    // wind: the world is still blowing words
    const total = aliveCount(state);
    if ((total < 3 || state.rng() < 0.3) && state.windStock.length) {
      const w = state.windStock.splice(Math.floor(state.rng() * state.windStock.length), 1)[0];
      state.pouch.push(w);
      say(state, 'the wind brought a seed: «' + w + '».');
    }

    state.day++;
    state.actions = ACTIONS_PER_DAY;
    state.forecast = rollFrost(state);

    if (aliveCount(state) === 0 || state.day > DAYS) finish(state);
    return state;
  }

  function dominantFamily(poem) {
    const c = { light: 0, water: 0, earth: 0, stone: 0 };
    poem.forEach(w => c[traits(w).fam]++);
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  }

  const CLOSERS = {
    light: 'and winter learned to say sun.',
    water: 'and winter learned to say river.',
    earth: 'and winter learned to say bread.',
    stone: 'and winter learned nothing, but it stayed.',
    none: 'the thaw came. there was nothing to say.',
  };

  function winterKeeps(kept) {
    if (kept.length === 1) return 'winter keeps «' + kept[0] + '».';
    if (kept.length === 2) return 'winter keeps «' + kept[0] + '» and «' + kept[1] + '».';
    return 'winter keeps «' + kept[0] + '», and ' + (kept.length - 1) + ' names more.';
  }

  function composePoem(state) {
    const lostNames = [...new Set(state.lost)];
    if (!state.poem.length) {
      const bleak = ['the thaw came.', 'there was nothing to say.'];
      if (lostNames.length) bleak.push(winterKeeps(lostNames));
      return bleak;
    }
    // one line per word at most: a repeated bloom feeds the count, not the verse
    const kept = [];
    for (const w of state.poem) if (!kept.includes(w)) kept.push(w);
    const words = kept.slice(0, 9);
    // verses shaped by the words themselves: a rare word stands alone;
    // a verse holds at most 3 words and 16 letters; short words lead to long;
    // a word born in this garden closes its verse.
    const lines = [];
    let verse = [], letters = 0;
    const flush = () => {
      if (!verse.length) return;
      verse.sort((a, b) => a.length - b.length || ((state.vigorous[a] ? 1 : 0) - (state.vigorous[b] ? 1 : 0)));
      lines.push(verse.join(', '));
      verse = []; letters = 0;
    };
    for (const w of words) {
      if (RARE.includes(w)) { flush(); lines.push(w); continue; }
      if (verse.length === 3 || letters + w.length > 16) flush();
      verse.push(w); letters += w.length;
    }
    flush();
    lines.push(CLOSERS[dominantFamily(state.poem)]);
    if (words.some(w => state.vigorous[w])) lines.push('one of these words was never heard before.');
    if (lostNames.length) lines.push(winterKeeps(lostNames));
    return lines;
  }

  function finish(state) {
    state.over = true;
    const fams = new Set(state.poem.map(w => traits(w).fam)).size;
    let title;
    if (state.poem.length >= 10) title = 'The hoard sings';
    else if (state.poem.length >= 6) title = 'Just enough';
    else if (state.poem.length >= 1) title = 'Almost nothing';
    else title = 'Silence';
    state.ending = {
      title,
      lines: composePoem(state),
      days: Math.min(state.day - 1, DAYS),
      bloomed: state.bloomed,
      grafts: state.grafts,
      lost: state.lost.length,
      diversity: fams,
      code: state.code,
    };
    return state;
  }

  return {
    newGame, endDay, plantAt, water, light, shelter, graft, finish, stageCost,
    traits, blend, familyOf, composePoem, aliveCount, rollFrost,
    LEXICON, RARE, STAGES, BEDS, DAYS, ACTIONS_PER_DAY,
    mulberry32, hashStr,
  };
});
