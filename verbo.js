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

  // ---------- Themes: what a word is ABOUT (not how it sounds) ----------
  // Hand-authored over the lexicon; grafted words inherit their first parent's theme.
  const THEME_MAP = {
    ember: 'flame', ash: 'flame', tinder: 'flame', coal: 'flame', cinder: 'flame',
    wick: 'flame', lantern: 'flame', kettle: 'flame', anvil: 'flame',
    river: 'tide', rain: 'tide', mist: 'tide', dew: 'tide', inlet: 'tide',
    silt: 'tide', reed: 'tide', salt: 'tide',
    acorn: 'leaf', elm: 'leaf', bark: 'leaf', bole: 'leaf', grove: 'leaf',
    orchard: 'leaf', sap: 'leaf', ivy: 'leaf', thorn: 'leaf', bramble: 'leaf',
    nettle: 'leaf', yarrow: 'leaf', pollen: 'leaf', grain: 'leaf',
    loam: 'loam', peat: 'loam', turf: 'loam', moss: 'loam', furrow: 'loam', husk: 'loam',
    snow: 'night', frost: 'night', north: 'night', echo: 'night', hollow: 'night',
    dawn: 'night', marrow: 'night',
    owl: 'wing', crow: 'wing', wren: 'wing', nest: 'wing', burrow: 'wing',
    flint: 'stone', quartz: 'stone',
  };
  function themeOf(w, state) {
    return (state && state.bornThemes && state.bornThemes[w]) || THEME_MAP[w] || 'loam';
  }

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
      pouch, poem: [], grafts: 0, bloomed: 0, vigorous: {}, lost: [], bornThemes: {},
      scarred: {}, parents: {},
      log: [], over: false, ending: null,
      windStock: lex.concat(RARE.filter(w => !pouch.includes(w))),
    };
    state.forecast = rollFrost(state);
    return state;
  }

  function say(state, msg) { state.log.push('Night ' + state.day + ' — ' + msg); }

  function stageCost(t) { return Math.min(3, Math.max(1, t.growth - 2)); }

  function plantAt(state, bed, word) {
    const t = traits(word);
    const vig = !!state.vigorous[word];
    state.beds[bed] = { word, stage: 0, progress: vig ? 2 : 0, water: 0, health: vig ? 5 : 4, age: 0, dry: 0, lit: false, sheltered: false, traits: t };
    state.pouch.splice(state.pouch.indexOf(word), 1);
    state.actions--;
    say(state, 'you planted «' + word + '».');
  }

  function water(state, bed) {
    // row watering: the chosen bed drinks fully; its row neighbors get a sip
    // a water word holds water well: one watering lasts longer
    state.beds[bed].water = themeOf(state.beds[bed].word, state) === 'tide' ? 3 : 2;
    const row = Math.floor(bed / 3);
    for (const n of [bed - 1, bed + 1]) {
      if (n >= 0 && n < BEDS && Math.floor(n / 3) === row && state.beds[n]) {
        state.beds[n].water = Math.max(state.beds[n].water, 1);
      }
    }
    state.actions--;
  }
  function light(state, bed) {
    // the lamp covers the whole row, like watering
    const row = Math.floor(bed / 3);
    for (let n = row * 3; n < row * 3 + 3; n++) if (state.beds[n]) state.beds[n].lit = true;
    state.actions--;
  }
  function shelter(state, bed) { state.beds[bed].sheltered = true; state.actions--; }

  function graft(state, bedA, bedB) {
    const A = state.beds[bedA], B = state.beds[bedB];
    const w = blend(A.word, B.word);
    state.beds[bedA] = null; state.beds[bedB] = null;
    state.pouch.push(w);
    state.vigorous[w] = true;
    state.parents[w] = [A.word, B.word];
    state.bornThemes[w] = themeOf(A.word, state); // a born word keeps its first parent's theme
    state.grafts++;
    state.actions -= 2;
    say(state, 'you grafted «' + A.word + '» with «' + B.word + '»: «' + w + '» was born, a new and vigorous word.');
    return w;
  }

  function aliveCount(state) {
    return state.beds.filter(Boolean).length + state.pouch.length;
  }

  // the exact harm tonight's frost would do to this plant, unsheltered:
  // hardiness soaks the first points, night words shrug one more,
  // fire words always feel the cold
  function frostDamage(state, p) {
    if (state.forecast <= 0) return 0;
    const base = Math.max(0, state.forecast - p.traits.hardiness);
    const th = themeOf(p.word, state);
    if (th === 'night') return Math.max(0, base - 1);
    if (th === 'flame') return base + 1;
    return base;
  }

  function endDay(state) {
    const frost = state.forecast;
    if (frost > 0) say(state, 'frost, force ' + frost + '.');

    // a bloomed word returns to the pouch twice, so several beds can hold the
    // same word; when they do, the log names the bed it means
    const dup = {};
    for (const q of state.beds) if (q) dup[q.word] = (dup[q.word] || 0) + 1;
    const tag = (p, i) => '«' + p.word + '»' + (dup[p.word] > 1 ? ' (bed ' + (i + 1) + ')' : '');

    for (let i = 0; i < BEDS; i++) {
      const p = state.beds[i];
      if (!p) continue;
      p.age++;
      // growth
      if (p.water > 0 && p.stage < 4) {
        // a fire word feeds on light: lit, it grows twice as fast again
        // a night word shuns the light: being lit does not speed it up
        const th0 = themeOf(p.word, state);
        p.progress += 1 + (p.lit && th0 !== 'night' ? 1 : 0) + (p.lit && th0 === 'flame' ? 1 : 0);
        p.stage = Math.min(4, Math.floor(p.progress / stageCost(p.traits)));
        p.water--;
        p.dry = 0;
      } else if (p.water <= 0 && p.traits.thirst > 0 && p.age >= 2) {
        p.health--;
        say(state, tag(p, i) + ' went thirsty (−1 health).');
      } else if (p.water > 0) { p.water--; p.dry = 0; }
      // frost: night words are at home in it; fire words suffer
      if (frost > 0 && !p.sheltered) {
        const th = themeOf(p.word, state);
        const base = Math.max(0, frost - p.traits.hardiness);
        const dmg = frostDamage(state, p);
        if (dmg > 0) { p.health -= dmg; say(state, 'the frost hit ' + tag(p, i) + ' (−' + dmg + ').'); if (p.health > 0) state.scarred[p.word] = true; }
        else if (th === 'night' && base > 0) say(state, tag(p, i) + ' is at home in the frost.');
      }
      // death
      if (p.health <= 0) {
        say(state, tag(p, i) + ' went dark.');
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
        // one bloom, one seed back: replanting a saved word is a choice,
        // not a way to fill the garden with copies of it
        state.pouch.push(p.word);
        state.beds[i] = null;
        say(state, tag(p, i) + ' bloomed. The word is safe now.');
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

    // the last night: planting or grafting now can never bloom,
    // so say so before the player spends their final actions on it
    if (state.day === DAYS && aliveCount(state) > 0)
      say(state, 'the last night. new seeds would not have time to bloom; tend what is already growing.');

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
    // a word that bloomed anywhere is saved, even if another copy of it died:
    // winter can only keep what never bloomed
    const lostNames = [...new Set(state.lost)].filter(w => !state.poem.includes(w));
    if (!state.poem.length) {
      const bleak = ['the thaw came.', 'there was nothing to say.'];
      if (lostNames.length) bleak.push(winterKeeps(lostNames));
      return bleak;
    }
    // one line per word at most: a repeated bloom feeds the count, not the verse
    const kept = [];
    for (const w of state.poem) if (!kept.includes(w)) kept.push(w);
    // the poem remembers what happened: a word that took frost and lived
    // gets its own verse, and a born word arrives with its parents' names.
    // Those words leave the enumeration below.
    const hero = kept.find(w => state.scarred[w]);
    const bornChild = kept.find(w => state.parents[w]);
    const words = kept.filter(w => w !== hero && w !== bornChild).slice(0, 9);
    // verses group words that are ABOUT the same thing: one theme per verse,
    // biggest theme first; a verse holds at most 3 words and 16 letters,
    // short words lead to long; a born word closes its verse.
    // rare words stand alone, after the themed verses.
    const themed = [];
    const rares = [];
    const byTheme = {};
    for (const w of words) {
      if (RARE.includes(w)) { rares.push(w); continue; }
      const t = themeOf(w, state);
      (byTheme[t] = byTheme[t] || []).push(w);
    }
    // verses follow theme adjacency: a theme with enough words holds its own verse;
    // small neighboring themes share one. Budget: 3 words and 16 letters per verse.
    const THEME_ORDER = ['flame', 'tide', 'leaf', 'loam', 'night', 'wing', 'stone'];
    let verse = [], letters = 0;
    const pushVerse = () => { if (verse.length) { themed.push(verse.join(', ')); verse = []; letters = 0; } };
    for (const t of THEME_ORDER) {
      const group = byTheme[t];
      if (!group) continue;
      group.sort((a, b) => a.length - b.length);
      if (verse.length && (verse.length + group.length > 3 || letters + group.join('').length > 16)) pushVerse();
      for (const w of group) {
        if (verse.length === 3 || letters + w.length > 16) pushVerse();
        verse.push(w); letters += w.length;
      }
    }
    pushVerse();
    const bornLast = line => {
      const ws = line.split(', ');
      if (!ws.some(w => state.vigorous[w])) return line;
      return ws.filter(w => !state.vigorous[w]).concat(ws.filter(w => state.vigorous[w])).join(', ');
    };
    const lines = themed.map(bornLast).concat(rares);
    if (hero) lines.push('«' + hero + '» stood in the frost.');
    if (bornChild) lines.push('«' + bornChild + '», child of «' + state.parents[bornChild][0] + '» and «' + state.parents[bornChild][1] + '».');
    else if (words.some(w => state.vigorous[w])) lines.push('one of these words was never heard before.');
    lines.push(CLOSERS[dominantFamily(state.poem)]);
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
    const lostUniq = [...new Set(state.lost)].length;
    let subtitle = null;
    if (state.poem.length >= 1 && lostUniq >= 3) subtitle = 'the frost took its share';
    else if (!state.poem.length && lostUniq > 0) subtitle = 'only the names of the dead';
    state.ending = {
      title,
      subtitle,
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
    traits, blend, familyOf, themeOf, composePoem, aliveCount, rollFrost, frostDamage,
    LEXICON, RARE, THEME_MAP, STAGES, BEDS, DAYS, ACTIONS_PER_DAY,
    mulberry32, hashStr,
  };
});
