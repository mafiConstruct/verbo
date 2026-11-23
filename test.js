// WORDHOARD test: headless simulations with a simple policy.
const V = require('./verbo.js');

let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.log('FAIL:', msg); } }

// 1. Deterministic traits
ok(V.traits('ember').growth === V.traits('ember').growth, 'deterministic traits');
ok(V.familyOf('ember') === 'light', 'ember is light, got ' + V.familyOf('ember'));
ok(V.familyOf('salt') === 'water', 'salt is water');
ok(V.familyOf('bark') === 'earth', 'bark is earth');
ok(V.familyOf('flint') === 'stone', 'flint is stone');
ok(V.blend('ember', 'frost') === 'embost', 'blend ember+frost = ' + V.blend('ember', 'frost'));

// 2. Same seed, same game
{
  const a = V.newGame('fixed-test'), b = V.newGame('fixed-test');
  ok(JSON.stringify(a.pouch) === JSON.stringify(b.pouch), 'same seed -> same pouch: ' + JSON.stringify(a.pouch));
}

// 3. Simple player policy: water, shelter, plant, graft sometimes
function playRun(code, grafty) {
  const g = V.newGame(code);
  const events = [];
  while (!g.over) {
    for (let i = 0; i < V.BEDS && g.actions > 0; i++) {
      const p = g.beds[i];
      if (p && p.water === 0 && (p.traits.thirst > 0 || p.stage < 4)) V.water(g, i);
    }
    for (let i = 0; i < V.BEDS && g.actions > 0; i++) {
      const p = g.beds[i];
      if (p && !p.sheltered && g.forecast - p.traits.hardiness >= 1 && p.health <= 3) V.shelter(g, i);
    }
    if (grafty && g.actions >= 2) {
      const grown = g.beds.map((p, i) => p && p.stage >= 2 ? i : -1).filter(i => i >= 0);
      if (grown.length >= 2 && g.rng() < 0.7) {
        const w = V.graft(g, grown[0], grown[1]);
        events.push('graft:' + w);
      }
    }
    for (let i = 0; i < V.BEDS && g.actions > 0; i++) {
      const planted = g.beds.filter(Boolean).length;
      if (!g.beds[i] && g.pouch.length && planted < 6) V.plantAt(g, i, g.pouch[0]);
    }
    for (let i = 0; i < V.BEDS && g.actions > 0; i++) {
      const p = g.beds[i];
      if (p && p.stage >= 2 && !p.lit) { V.light(g, i); }
    }
    V.endDay(g);
  }
  return { g, events };
}

const endings = {};
let poems = 0, graftRuns = 0, minDays = 99, maxDays = 0;
for (let i = 0; i < 60; i++) {
  const { g, events } = playRun('sim-' + i, i % 2 === 0);
  ok(g.over, 'run ' + i + ' ended');
  ok(g.ending && g.ending.title, 'run ' + i + ' has ending');
  ok(g.ending.lines.length >= 2, 'run ' + i + ' poem has lines');
  endings[g.ending.title] = (endings[g.ending.title] || 0) + 1;
  if (g.bloomed > 0) poems++;
  if (g.grafts > 0) graftRuns++;
  minDays = Math.min(minDays, g.ending.days); maxDays = Math.max(maxDays, g.ending.days);
  if (i < 3) {
    console.log('--- run', i, '(' + g.code + '):', g.ending.title, '| bloomed:', g.bloomed, '| grafts:', g.grafts, '| diversity:', g.ending.diversity);
    console.log(g.ending.lines.map(l => '    ' + l).join('\n'));
  }
}
console.log('---');
console.log('60 runs | endings:', JSON.stringify(endings));
console.log('runs with poem:', poems, '| runs with grafts:', graftRuns, '| days min/max:', minDays, maxDays);
ok(poems >= 45, 'most runs bloom something (' + poems + '/60)');
ok(graftRuns >= 10, 'grafts are frequent (' + graftRuns + '/60)');
ok(endings['Silence'] === undefined || endings['Silence'] <= 10, 'silence is rare with decent play');

// 4. Total neglect -> silence or almost nothing
{
  const g = V.newGame('neglect');
  while (!g.over) V.endDay(g);
  ok(['Silence', 'Almost nothing'].includes(g.ending.title), 'neglect -> ' + g.ending.title);
  console.log('total neglect:', g.ending.title);
}


// 7. Words have weather
{
  // night words shrug off frost; flame words suffer extra
  const g = V.newGame('weather-frost');
  V.plantAt(g, 0, 'snow');   // night theme
  V.plantAt(g, 1, 'ember');  // flame theme
  g.actions = 3; g.forecast = 1;
  // frostDamage predicts the night exactly, so the UI can warn honestly
  ok(V.frostDamage(g, g.beds[0]) === 0, 'snow takes 0 from frost 1');
  ok(V.frostDamage(g, g.beds[1]) === 2, 'ember takes 2 from frost 1, got ' + V.frostDamage(g, g.beds[1]));
  g.forecast = 0;
  ok(V.frostDamage(g, g.beds[1]) === 0, 'no frost, no damage');
  g.forecast = 1;
  V.endDay(g);
  const snow = g.beds[0], ember = g.beds[1];
  ok(snow && snow.health === 4, 'snow unharmed by frost 1, health ' + (snow && snow.health));
  ok(ember && ember.health === 2, 'ember takes extra frost damage, health ' + (ember && ember.health));
}
{
  // wet words freeze harder: watering into a frost night is a gamble
  const g = V.newGame('weather-wet');
  V.plantAt(g, 0, 'fern');   // a word that is neither night nor flame — beds 0 and 3: different rows, no splash
  V.plantAt(g, 3, 'fern');
  g.actions = 3; g.forecast = 1;
  const dry = V.frostDamage(g, g.beds[0]);
  V.water(g, 3);             // wet the second one
  const wet = V.frostDamage(g, g.beds[3]);
  ok(wet === dry + 1, 'wet word takes one more bite: dry ' + dry + ', wet ' + wet);
  const before = g.beds[3].health;
  V.endDay(g);
  ok(g.beds[3] && g.beds[3].health === before - wet, 'the night applies the predicted wet bite, health ' + (g.beds[3] && g.beds[3].health));
  ok(g.beds[0] && g.beds[0].health === 4 - dry, 'the dry word takes only the plain bite, health ' + (g.beds[0] && g.beds[0].health));
  ok(g.log.some(l => l.includes('froze harder')), 'the log names the wet bite');
}
{
  // tide words hold water (3 nights per watering); others get 2
  const g = V.newGame('weather-tide');
  V.plantAt(g, 0, 'river');  // tide
  V.plantAt(g, 3, 'peat');   // loam, different row
  V.water(g, 0); V.water(g, 3);
  ok(g.beds[0].water === 3, 'river holds 3 water, got ' + g.beds[0].water);
  ok(g.beds[3].water === 2, 'peat holds 2 water, got ' + g.beds[3].water);
}
{
  // a lit flame word grows 3 per night (base 1 + light 1 + flame 1)
  const g = V.newGame('weather-flame');
  V.plantAt(g, 0, 'ember');
  V.water(g, 0); V.light(g, 0);
  g.forecast = 0; V.endDay(g);
  ok(g.beds[0].progress === 3, 'lit ember progressed 3, got ' + g.beds[0].progress);
}
{
  // a lamp lights the whole row for the night
  const g = V.newGame('lamp-row');
  V.plantAt(g, 0, 'snow'); V.plantAt(g, 1, 'ivy'); V.plantAt(g, 4, 'peat');
  V.light(g, 0);
  ok(g.beds[0].lit && g.beds[1].lit, 'lamp lights row mates');
  ok(!g.beds[4].lit, 'lamp does not reach another row');
}
{
  // a night word shuns the light: lit, it still grows 1 per night
  const g = V.newGame('weather-nightlight');
  V.plantAt(g, 0, 'snow');
  V.water(g, 0); V.light(g, 0);
  g.forecast = 0; V.endDay(g);
  ok(g.beds[0].progress === 1, 'lit snow progressed 1, got ' + g.beds[0].progress);
}
// 8. The poem remembers
{
  // a word that took frost and lived is marked
  const g = V.newGame('scar-test');
  V.plantAt(g, 0, 'ember');
  g.forecast = 1; V.endDay(g);
  ok(g.scarred.ember === true, 'ember carries a scar');
}
{
  // graft records parents
  const g = V.newGame('parents-test');
  V.plantAt(g, 0, 'ember'); V.plantAt(g, 1, 'frost');
  g.beds[0].stage = 2; g.beds[1].stage = 2;
  const w = V.graft(g, 0, 1);
  ok(w && g.parents[w] && g.parents[w].join('+') === 'ember+frost', 'parents of ' + w + ': ' + JSON.stringify(g.parents[w]));
}
{
  // a bloomed scarred word gets its own verse
  const g = V.newGame('scar-poem');
  V.plantAt(g, 0, 'ember');
  g.sky = g.sky.map(() => 0); // calm season; only night 1 bites
  g.forecast = 1;
  while (!g.over) {
    if (g.actions > 0 && g.beds[0]) V.water(g, 0);
    V.endDay(g);
  }
  const hero = g.ending.lines.find(l => l.includes('stood in the frost'));
  ok(hero && hero.includes('ember'), 'poem names the scarred word: ' + JSON.stringify(g.ending.lines));
}
// 9. The sky is dealt with the game and never moves
{
  const a = V.newGame('seed-2xk5l0'), b = V.newGame('seed-2xk5l0');
  ok(JSON.stringify(a.sky) === JSON.stringify(b.sky), 'same seed, same sky');
  ok(JSON.stringify(a.sky.slice(0, 8)) === '[1,0,0,0,2,1,1,2]', 'seed-2xk5l0 opens ' + JSON.stringify(a.sky.slice(0, 8)) + ' (pinned: UI tests play this weather)');
  ok(a.forecast === 1, 'night 1 forecast comes from the sky');
  // play consumes rng (water, shelter, wind) but the sky does not move
  const g = V.newGame('seed-2xk5l0');
  V.plantAt(g, 0, g.pouch[0]);
  for (let n = 1; n <= 6 && !g.over; n++) {
    ok(g.forecast === g.sky[g.day - 1], 'night ' + n + ' forecast = sky[' + (g.day - 1) + ']');
    if (g.actions > 0 && g.beds[0]) V.water(g, 0);
    V.endDay(g);
  }
  ok(g.day > 1 && g.forecast === g.sky[g.day - 1], 'sky still authoritative after rng-consuming nights');
}
// 10. The frost that kills freezes the bed for two nights
{
  const g = V.newGame('freeze-test');
  g.sky = g.sky.map(() => 0); g.sky[0] = 3; g.forecast = 3;
  V.plantAt(g, 0, 'ember'); // flame, hardiness 0: takes 4 on a force-3 night
  V.endDay(g);
  ok(g.beds[0] === null && g.lost.includes('ember'), 'ember died on the force-3 night');
  ok(g.frozenBeds[0] === 3, 'bed frozen through night 3, got ' + g.frozenBeds[0]);
  const before = g.pouch.length;
  const r = V.plantAt(g, 0, 'crow');
  ok(r === false && g.beds[0] === null && g.pouch.length === before && g.actions === 3, 'planting in a frozen bed is refused without cost');
  V.endDay(g); // night 2 -> 3: still frozen
  ok(V.plantAt(g, 0, 'crow') === false && g.beds[0] === null, 'still frozen on night 3');
  V.endDay(g); // night 3 -> 4: the thaw
  const r2 = V.plantAt(g, 0, 'crow');
  ok(r2 !== false && g.beds[0] && g.beds[0].word === 'crow', 'bed takes root again after the thaw');
}
{
  // thirst does not freeze a bed
  const g = V.newGame('thirst-nofreeze');
  g.sky = g.sky.map(() => 0); g.forecast = 0;
  V.plantAt(g, 0, 'marrow'); // thirst 1
  let diedAt = 0;
  while (!g.over && g.beds[0]) { V.endDay(g); if (!g.beds[0]) diedAt = g.day - 1; }
  ok(diedAt > 0, 'marrow died of thirst on night ' + diedAt);
  ok(Object.keys(g.frozenBeds).length === 0, 'a thirsty death leaves no frozen bed');
}
// 11. Graft refuses anything below stem stage, like the garden says
{
  const g = V.newGame('graft-bar');
  g.sky = g.sky.map(() => 0); g.forecast = 0;
  V.plantAt(g, 0, 'marrow'); V.plantAt(g, 1, 'crow');
  g.beds[0].stage = 1; g.beds[1].stage = 1; // two sprouts
  const r = V.graft(g, 0, 1);
  ok(r === null && g.beds[0] && g.beds[1] && g.grafts === 0, 'sprouts cannot be grafted');
  g.beds[0].stage = 2; g.beds[1].stage = 2; g.actions = 3;
  const r2 = V.graft(g, 0, 1);
  ok(r2 !== null && g.grafts === 1, 'two stems graft into a new word');
}
console.log(fails === 0 ? 'MEMORY OK' : 'MEMORY FAILURES: ' + fails);
console.log(fails === 0 ? 'WEATHER OK' : 'WEATHER FAILURES: ' + fails);
console.log(fails === 0 ? 'ALL OK' : fails + ' FAILURES');
process.exit(fails === 0 ? 0 : 1);
