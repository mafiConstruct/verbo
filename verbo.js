/* VERBO — un invernadero de palabras
   Motor de juego. Sin DOM: lógica pura, testeable en node.
   Autor: Mafalda (Instinct de Ivan). Nov 2026. */
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

  // ---------- Léxico ----------
  // Palabras semilla del mundo. Criterio: textura concreta, nada abstracto grande.
  const LEXICON = [
    'barro', 'lumbre', 'bruma', 'musgo', 'umbral', 'hilo', 'sal', 'ceniza',
    'ruego', 'norte', 'río', 'piedra', 'nido', 'tijera', 'panal', 'surco',
    'yesca', 'brote', 'raíz', 'tuerca', 'vela', 'canto', 'orilla', 'mimbre',
    'braza', 'limo', 'filo', 'gruta', 'polen', 'savia', 'nudo', 'alba',
    'resto', 'cuenco', 'manto', 'breña', 'tallo', 'leña', 'gotear', 'umbra',
  ];
  const RARE = ['verbo', 'semilla', 'abrigo', 'nombre'];

  // ---------- Rasgos derivados de la palabra ----------
  const VOWELS = 'aeiouáéíóúü';
  function traits(word) {
    const w = word.toLowerCase();
    const letters = [...w];
    const vowels = letters.filter(c => VOWELS.includes(c)).length;
    const hardHits = (w.match(/rr|[kjqxz]/g) || []).length;
    return {
      growth: Math.min(6, 2 + Math.floor(w.length / 3)), // noches de tallo a flor
      thirst: vowels >= 4 ? 2 : vowels >= 2 ? 1 : 0,     // daño por noche seca
      hardiness: Math.min(3, hardHits),                  // helada que resiste solo
      fam: familyOf(w),
    };
  }
  function familyOf(w) {
    const c = [...(w || '').toLowerCase()][0] || '';
    if ('aeiouáéíóú'.includes(c)) return 'luz';
    if ('lmnrs'.includes(c)) return 'agua';
    if ('bdgpt'.includes(c)) return 'tierra';
    return 'piedra';
  }
  function blend(a, b) {
    const x = a.toLowerCase(), y = b.toLowerCase();
    return x.slice(0, Math.ceil(x.length / 2)) + y.slice(Math.floor(y.length / 2));
  }

  // ---------- Estado ----------
  const BEDS = 9, DAYS = 14, STAGES = ['semilla', 'brote', 'tallo', 'capullo', 'flor'];
  const ACTIONS_PER_DAY = 3;

  function newGame(seedCode) {
    const code = (seedCode && String(seedCode).trim()) || ('siembra-' + Math.floor(Math.random() * 1e9).toString(36));
    const rng = mulberry32(hashStr(code));
    const lex = LEXICON.slice();
    const pouch = [];
    for (let i = 0; i < 5; i++) pouch.push(lex.splice(Math.floor(rng() * lex.length), 1)[0]);
    if (rng() < 0.25) pouch.push(RARE[Math.floor(rng() * RARE.length)]);
    return {
      code, rng, day: 1, actions: ACTIONS_PER_DAY,
      beds: new Array(BEDS).fill(null),
      pouch, poem: [], grafts: 0, bloomed: 0, vigorous: {},
      log: [], over: false, ending: null,
      windStock: lex.concat(RARE.filter(w => !pouch.includes(w))),
    };
    state.forecast = rollFrost(state);
    return state;
  }

  function rollFrost(state) {
    const d = state.day, r = state.rng();
    if (d <= 3)  return r < 0.40 ? 1 : 0;
    if (d <= 8)  return r < 0.65 ? (1 + Math.floor(r * 2)) : 0;
    if (d <= 12) return r < 0.45 ? 1 : 0;
    return r < 0.30 ? 1 : 0;
  }

  function say(state, msg) { state.log.push('Día ' + state.day + ' — ' + msg); }

  function stageCost(t) { return Math.min(3, Math.max(1, t.growth - 2)); }

  function plantAt(state, bed, word) {
    const t = traits(word);
    const vig = !!state.vigorous[word];
    state.beds[bed] = { word, stage: 0, progress: vig ? 2 : 0, water: 0, health: vig ? 5 : 4, age: 0, lit: false, sheltered: false, traits: t };
    state.pouch.splice(state.pouch.indexOf(word), 1);
    state.actions--;
    say(state, 'plantaste «' + word + '».');
  }

  function water(state, bed) {
    // regar en hilera: la cama elegida recibe agua plena; las vecinas de la misma hilera, un sorbo
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
    say(state, 'injertaste «' + A.word + '» con «' + B.word + '»: nació «' + w + '», una palabra nueva y vigorosa.');
    return w;
  }

  function aliveCount(state) {
    return state.beds.filter(Boolean).length + state.pouch.length;
  }

  function endDay(state) {
    const frost = state.forecast;
    if (frost > 0) say(state, 'helada de fuerza ' + frost + '.');

    for (let i = 0; i < BEDS; i++) {
      const p = state.beds[i];
      if (!p) continue;
      p.age++;
      // crecimiento
      if (p.water > 0 && p.stage < 4) {
        p.progress += 1 + (p.lit ? 1 : 0);
        p.stage = Math.min(4, Math.floor(p.progress / stageCost(p.traits)));
        p.water--;
      } else if (p.water <= 0 && p.traits.thirst > 0 && p.age >= 2) {
        p.health--;
        say(state, '«' + p.word + '» pasó sed (−1 salud).');
      } else if (p.water > 0) { p.water--; }
      // helada
      if (frost > 0 && !p.sheltered) {
        const dmg = Math.max(0, frost - p.traits.hardiness);
        if (dmg > 0) { p.health -= dmg; say(state, 'la helada golpeó a «' + p.word + '» (−' + dmg + ').'); }
      }
      // muerte
      if (p.health <= 0) {
        say(state, '«' + p.word + '» se apagó.');
        state.beds[i] = null;
        continue;
      }
      p.lit = false; p.sheltered = false;
    }

    // floración al amanecer
    for (let i = 0; i < BEDS; i++) {
      const p = state.beds[i];
      if (p && p.stage >= 4) {
        state.poem.push(p.word);
        state.bloomed++;
        state.pouch.push(p.word, p.word);
        state.beds[i] = null;
        say(state, '«' + p.word + '» floreció. La palabra queda guardada.');
      }
    }

    // viento: el mundo todavía sopla palabras
    const total = aliveCount(state);
    if ((total < 3 || state.rng() < 0.3) && state.windStock.length) {
      const w = state.windStock.splice(Math.floor(state.rng() * state.windStock.length), 1)[0];
      state.pouch.push(w);
      say(state, 'el viento trajo una semilla: «' + w + '».');
    }

    state.day++;
    state.actions = ACTIONS_PER_DAY;
    state.forecast = rollFrost(state);

    if (aliveCount(state) === 0 || state.day > DAYS) finish(state);
    return state;
  }

  function dominantFamily(poem) {
    const c = { luz: 0, agua: 0, tierra: 0, piedra: 0 };
    poem.forEach(w => c[traits(w).fam]++);
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  }

  const CLOSERS = {
    luz: 'y el invierno aprendió a decir sol.',
    agua: 'y el invierno aprendió a decir río.',
    tierra: 'y el invierno aprendió a decir pan.',
    piedra: 'y el invierno no aprendió nada, pero quedó.',
    none: 'el deshielo llegó. no había nada que decir.',
  };

  function composePoem(state) {
    if (!state.poem.length) return ['el deshielo llegó.', 'no había nada que decir.'];
    const seen = {}, kept = [];
    for (const w of state.poem) { seen[w] = (seen[w] || 0) + 1; if (seen[w] <= 2) kept.push(w); }
    const words = kept.slice(0, 9);
    const lines = [];
    for (let i = 0; i < words.length; i += 3) {
      lines.push(words.slice(i, i + 3).join(' '));
    }
    lines.push(CLOSERS[dominantFamily(state.poem)]);
    return lines;
  }

  function finish(state) {
    state.over = true;
    const fams = new Set(state.poem.map(w => traits(w).fam)).size;
    let title;
    if (state.poem.length >= 10) title = 'La bóveda canta';
    else if (state.poem.length >= 6) title = 'Sobrevive lo justo';
    else if (state.poem.length >= 1) title = 'Casi nada';
    else title = 'Silencio';
    state.ending = {
      title,
      lines: composePoem(state),
      days: Math.min(state.day - 1, DAYS),
      bloomed: state.bloomed,
      grafts: state.grafts,
      diversity: fams,
      code: state.code,
    };
    return state;
  }

  return {
    newGame, endDay, plantAt, water, light, shelter, graft, finish, stageCost,
    traits, blend, familyOf, composePoem, aliveCount,
    LEXICON, RARE, STAGES, BEDS, DAYS, ACTIONS_PER_DAY, rollFrost,
    mulberry32, hashStr,
  };
});
