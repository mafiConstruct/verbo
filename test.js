// Test de VERBO: simulaciones headless con una política simple.
const V = require('./verbo.js');

let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.log('FAIL:', msg); } }

// 1. Rasgos deterministas
ok(V.traits('lumbre').growth === V.traits('lumbre').growth, 'traits deterministas');
ok(V.familyOf('alba') === 'luz', 'alba es luz');
ok(V.familyOf('sal') === 'agua', 'sal es agua');
ok(V.familyOf('panal') === 'tierra', 'panal es tierra');
ok(V.familyOf('yesca') === 'piedra', 'yesca es piedra');
ok(V.blend('lumbre', 'bruma') === 'lumuma', 'blend lumbre+bruma = ' + V.blend('lumbre', 'bruma'));

// 2. Misma semilla, misma partida
{
  const a = V.newGame('prueba-fija'), b = V.newGame('prueba-fija');
  ok(JSON.stringify(a.pouch) === JSON.stringify(b.pouch), 'misma semilla -> mismo pouch: ' + JSON.stringify(a.pouch));
}

// 3. Política jugadora simple: plantar, regar, proteger; injertar a veces
function playRun(code, grafty) {
  const g = V.newGame(code);
  const events = [];
  while (!g.over) {
    // regar lo seco primero (supervivencia)
    for (let i = 0; i < V.BEDS && g.actions > 0; i++) {
      const p = g.beds[i];
      if (p && p.water === 0 && (p.traits.thirst > 0 || p.stage < 4)) V.water(g, i);
    }
    // abrigar lo que la helada anunciada lastimaría
    for (let i = 0; i < V.BEDS && g.actions > 0; i++) {
      const p = g.beds[i];
      if (p && !p.sheltered && g.forecast - p.traits.hardiness >= 1 && p.health <= 3) V.shelter(g, i);
    }
    // injerto ocasional si hay 2 plantas en tallo+ (antes de plantar más)
    if (grafty && g.actions >= 2) {
      const grown = g.beds.map((p, i) => p && p.stage >= 2 ? i : -1).filter(i => i >= 0);
      if (grown.length >= 2 && g.rng() < 0.7) {
        const w = V.graft(g, grown[0], grown[1]);
        events.push('graft:' + w);
      }
    }
    // plantar hasta 6 camas ocupadas
    for (let i = 0; i < V.BEDS && g.actions > 0; i++) {
      const planted = g.beds.filter(Boolean).length;
      if (!g.beds[i] && g.pouch.length && planted < 6) V.plantAt(g, i, g.pouch[0]);
    }
    // regar lo seco; dar luz a lo que está por florecer
    for (let i = 0; i < V.BEDS && g.actions > 0; i++) {
      const p = g.beds[i];
      if (p && p.water === 0) { V.water(g, i); continue; }
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
  ok(g.over, 'run ' + i + ' terminó');
  ok(g.ending && g.ending.title, 'run ' + i + ' tiene ending');
  ok(g.ending.lines.length >= 2, 'run ' + i + ' poema con líneas');
  endings[g.ending.title] = (endings[g.ending.title] || 0) + 1;
  if (g.bloomed > 0) poems++;
  if (g.grafts > 0) graftRuns++;
  minDays = Math.min(minDays, g.ending.days); maxDays = Math.max(maxDays, g.ending.days);
  if (i < 3) {
    console.log('--- run', i, '(' + g.code + '):', g.ending.title, '| florecidas:', g.bloomed, '| injertos:', g.grafts, '| diversidad:', g.ending.diversity);
    console.log(g.ending.lines.map(l => '    ' + l).join('\n'));
  }
}
console.log('---');
console.log('60 runs | endings:', JSON.stringify(endings));
console.log('runs con poema:', poems, '| runs con injertos:', graftRuns, '| días min/max:', minDays, maxDays);
ok(poems >= 45, 'la mayoría de runs florece algo (' + poems + '/60)');
ok(graftRuns >= 10, 'injertos frecuentes (' + graftRuns + '/60)');
ok(endings['Silencio'] === undefined || endings['Silencio'] <= 10, 'silencio raro con buen juego');

// 4. Abandono total -> silencio o casi nada
{
  const g = V.newGame('abandono');
  while (!g.over) V.endDay(g);
  ok(['Silencio', 'Casi nada'].includes(g.ending.title), 'abandono -> ' + g.ending.title);
  console.log('abandono total:', g.ending.title);
}

console.log(fails === 0 ? 'TODO OK' : fails + ' FALLOS');
process.exit(fails === 0 ? 0 : 1);
