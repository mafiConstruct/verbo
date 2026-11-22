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

console.log(fails === 0 ? 'ALL OK' : fails + ' FAILURES');
process.exit(fails === 0 ? 0 : 1);
