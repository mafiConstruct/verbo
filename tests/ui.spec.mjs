// UI regression suite. Every test asserts a VISIBLE change after a tap,
// not just that a click executed — the failure mode a novice reported:
// "I pressed buttons and nothing happened."
import { test, expect } from '@playwright/test';

const begin = async (page, seed) => {
  await page.goto('/index.html');
  if (seed) await page.fill('#entrada-siembra', seed);
  await page.click('#comenzar');
  await expect(page.locator('#app')).toBeVisible();
};

test('begin hides the intro and shows the garden at day 1', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#pantalla-inicio')).toBeVisible();
  await page.click('#comenzar');
  await expect(page.locator('#pantalla-inicio')).toBeHidden();
  await expect(page.locator('#dia')).toHaveText('1');
});

test('at start, empty beds glow as targets and the coach names the first move', async ({ page }) => {
  await begin(page);
  await expect(page.locator('#camas > .cama.objetivo')).toHaveCount(9);
  await expect(page.locator('#guia')).toContainText('click a glowing bed to plant');
  await expect(page.locator('button[data-modo="plantar"]')).toHaveClass(/activo/);
});

test('one click on a glowing bed plants: glyph, word and log entry appear', async ({ page }) => {
  await begin(page);
  const firstSeed = await page.locator('#semillas > .semilla').first().textContent();
  const bed = page.locator('#camas > .cama').first();
  await bed.click();
  await expect(bed.locator('.planta')).toBeVisible();
  await expect(bed.locator('.palabra')).toHaveText(firstSeed.trim());
  await expect(page.locator('#registro')).toContainText('you planted «' + firstSeed.trim() + '»');
});

test('arming water visibly changes button, coach and target glow', async ({ page }) => {
  await begin(page);
  await page.locator('#camas > .cama').first().click(); // plant one
  const coachBefore = await page.locator('#guia').textContent();
  await page.click('button[data-modo="regar"]');
  await expect(page.locator('button[data-modo="regar"]')).toHaveClass(/activo/);
  await expect(page.locator('#guia')).toContainText('water armed');
  await expect(page.locator('#guia')).not.toHaveText(coachBefore);
  await expect(page.locator('#camas > .cama.objetivo')).toHaveCount(1);
});

test('watering a word marks it visibly with ≈', async ({ page }) => {
  await begin(page);
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant
  await page.click('button[data-modo="regar"]');
  await bed.click(); // water
  await expect(bed.locator('.estado')).toContainText('≈');
  await expect(page.locator('#acciones-restantes')).toHaveText('●○○');
});

test('ending the night advances the day and appends to the log', async ({ page }) => {
  await begin(page);
  await page.locator('#camas > .cama').first().click();
  await page.click('#noche');
  await expect(page.locator('#dia')).toHaveText('2');
  await expect(page.locator('#acciones-restantes')).toHaveText('●●●');
});

test('a typed seed code reproduces the same garden', async ({ page }) => {
  await begin(page, 'seed-playwright');
  await expect(page.locator('#codigo')).toHaveText('seed-playwright');
  const pouch = await page.locator('#semillas').textContent();
  await page.goto('/index.html');
  await page.fill('#entrada-siembra', 'seed-playwright');
  await page.click('#comenzar');
  await expect(page.locator('#semillas')).toHaveText(pouch);
});

test('two grown words graft into a new word in the pouch', async ({ page }) => {
  test.setTimeout(60000);
  await begin(page, 'seed-graft8');
  const actionsLeft = async () => !(await page.locator('#acciones-restantes').textContent()).startsWith('\u25cb');
  const arm = async modo => {
    const btn = page.locator('button[data-modo="' + modo + '"]');
    if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
  };
  // policy: shelter what the frost threatens (a wet word freezes harder, and a
  // frost-killed bed lies frozen two nights), plant up to two, water the rest
  for (let night = 0; night < 14; night++) {
    const graftable = await page.locator('#camas > .cama').evaluateAll(
      els => els.filter(el => /, (stem|bud),/.test(el.getAttribute('aria-label') || '')).length
    );
    if (graftable >= 2) break;
    for (const bed of await page.locator('#camas > .cama:has(.planta:not(.eco))').all()) {
      if (!(await actionsLeft())) break;
      if (/frost threatens/.test(await bed.getAttribute('aria-label') || '')) {
        await arm('abrigar');
        await bed.click();
      }
    }
    while ((await page.locator('#camas > .cama:has(.planta:not(.eco))').count()) < 2 && (await actionsLeft())) {
      const empty = page.locator('#camas > .cama:not(:has(.planta:not(.eco))):not(.congelada)');
      if ((await empty.count()) === 0 || (await page.locator('#semillas > .semilla').count()) === 0) break;
      await arm('plantar');
      await empty.first().click();
    }
    for (const bed of await page.locator('#camas > .cama:has(.planta:not(.eco))').all()) {
      if (!(await actionsLeft())) break;
      const aria = (await bed.getAttribute('aria-label')) || '';
      if (/frost threatens|frost held off/.test(aria)) continue;
      if (!/≈/.test(await bed.locator('.estado').textContent())) {
        await arm('regar');
        await bed.click();
        await expect(bed.locator('.estado')).toContainText('≈');
      }
    }
    await page.click('#noche');
  }
  await page.click('button[data-modo="injertar"]');
  await expect(page.locator('#guia')).toContainText('graft armed');
  const glow = page.locator('#camas > .cama.objetivo');
  await expect(glow).toHaveCount(2);
  const pouchBefore = await page.locator('#semillas').textContent();
  await glow.nth(0).click();
  await glow.nth(1).click();
  await page.click('button[data-modo="injertar"]'); // confirm the trade the preview showed
  await expect(page.locator('#registro')).toContainText('you grafted');
  await expect(page.locator('#semillas')).not.toHaveText(pouchBefore);
});

test('a graft leaves intertwined tendrils where the parents stood', async ({ page }) => {
  test.setTimeout(60000);
  await begin(page, 'seed-graft8'); // same engine-verified pair as the graft test
  for (let night = 0; night < 14; night++) {
    const glowGraftable = await page.locator('#camas > .cama').evaluateAll(
      els => els.filter(el => /, (stem|bud),/.test(el.getAttribute('aria-label') || '')).length
    );
    if (glowGraftable >= 2) break;
    for (let k = 0; k < 2; k++) {
      const plants = await page.locator('#camas > .cama:has(.planta:not(.eco))').count();
      const empty = await page.locator('#camas > .cama:not(:has(.planta:not(.eco))):not(.congelada)').count();
      const seeds = await page.locator('#semillas > .semilla').count();
      const actions = await page.locator('#acciones-restantes').textContent();
      if (plants < 2 && empty > 0 && seeds > 0 && !actions.startsWith('○')) {
        await page.locator('#camas > .cama:not(:has(.planta:not(.eco))):not(.congelada)').first().click();
      }
    }
    for (const bed of await page.locator('#camas > .cama:has(.planta:not(.eco))').all()) {
      if (!/≈/.test(await bed.locator('.estado').textContent())) {
        await page.click('button[data-modo="regar"]');
        await bed.click();
        await expect(bed.locator('.estado')).toContainText('≈');
      }
    }
    await page.click('#noche');
  }
  await page.click('button[data-modo="injertar"]');
  const glow = page.locator('#camas > .cama.objetivo');
  await expect(glow).toHaveCount(2);
  const parentA = (await glow.nth(0).getAttribute('aria-label')).match(/bed \d+, (\w+),/)[1];
  const parentB = (await glow.nth(1).getAttribute('aria-label')).match(/bed \d+, (\w+),/)[1];
  await glow.nth(0).click();
  await glow.nth(1).click();
  await page.click('button[data-modo="injertar"]'); // confirm the trade the preview showed
  const echoes = page.locator('#camas > .cama:has(.planta.eco.injerto-echo)');
  await expect(echoes).toHaveCount(2); // both parents leave their tendrils
  await expect(echoes.nth(0)).toHaveAttribute('aria-label', new RegExp('«' + parentA + '» and «' + parentB + '» intertwined here into «\\w+»'));
  await expect(echoes.nth(0).locator('.estado')).toHaveText('born here this night');
  // replanting one of the beds retires its echo
  await echoes.nth(0).click();
  await expect(page.locator('#camas > .cama:has(.planta.eco.injerto-echo)')).toHaveCount(1);
});

test('mobile layout: no horizontal overflow at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await begin(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBe(false);
});

// Controlled local fixtures check the card against the engine's actual growth rules.
async function beginWithSeed(page, word, vigorous = false, day = 1) {
  await page.goto('/index.html');
  await page.evaluate(({ word, vigorous, day }) => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const state = original(code || 'hoardcheck');
      state.pouch = [word]; state.day = day; state.forecast = 0;
      if (vigorous) state.vigorous[word] = true;
      return state;
    };
  }, { word, vigorous, day });
  await page.click('#comenzar');
}

test('fire seed card uses triple lit growth, not double', async ({ page }) => {
  await beginWithSeed(page, 'lantern');
  await expect(page.locator('#pista')).toContainText('8 watered nights (3 with light every night)');
});

test('night seed card does not promise faster growth under light', async ({ page }) => {
  await beginWithSeed(page, 'marrow');
  await expect(page.locator('#pista')).toContainText('8 watered nights (light does not speed it up)');
});

test('vigorous seed head start agrees across card and late-night planting glow', async ({ page }) => {
  await beginWithSeed(page, 'lantern', true, 13);
  await expect(page.locator('#pista')).toContainText('6 watered nights (2 with light every night)');
  await expect(page.locator('#pista')).not.toContainText('too late');
  await expect(page.locator('.cama.objetivo')).toHaveCount(9);
  await page.locator('.cama').first().click();
  // Inspect the planted child, whose progress already includes that same head start.
  await page.locator('.cama').first().click();
  await expect(page.locator('#pista')).toContainText('6 more watered nights (2 with light every night)');
});

test('selected seed card updates its late warning when the night changes', async ({ page }) => {
  await beginWithSeed(page, 'marrow', false, 7);
  await expect(page.locator('#pista')).not.toContainText('too late');
  await page.click('#noche');
  await expect(page.locator('#dia')).toHaveText('8');
  await expect(page.locator('#pista')).toContainText('too late');
  await expect(page.locator('.semilla.elegida')).toHaveClass(/tarde/);
});

test('inspected planted word refreshes its remaining growth after dawn', async ({ page }) => {
  await beginWithSeed(page, 'ash');
  await page.locator('.cama').first().click();
  await page.click('button[data-modo="regar"]');
  await page.locator('.cama').first().click();
  await page.click('button[data-modo="luz"]');
  await page.locator('.cama').first().click();
  // No actions left; plant mode cannot be armed by its disabled button.
  await page.click('#noche');
  await page.click('button[data-modo="plantar"]');
  await page.locator('.cama').first().click();
  await expect(page.locator('#pista')).toContainText('1 more watered night');
  await page.click('#noche');
  await expect(page.locator('#pista')).not.toContainText('1 more watered night');
  await expect(page.locator('#tesoro')).toContainText('ash');
  const selected = await page.locator('.semilla.elegida').textContent();
  await expect(page.locator('#pista')).toContainText('«' + selected.trim() + '»');
});

test('empty-garden advice distinguishes one late seed from an entirely late pouch', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const state = original(code || 'hoardcheck');
      state.pouch = ['marrow', 'lantern']; state.day = 8; state.forecast = 0;
      return state;
    };
  });
  await page.click('#comenzar');
  await expect(page.locator('#guia')).toContainText('pick another seed from the pouch');
  await expect(page.locator('#guia')).not.toContainText('any of these');
  await page.locator('.semilla').filter({ hasText: /^lantern$/ }).click();
  await expect(page.locator('.cama.objetivo')).toHaveCount(9);
  await expect(page.locator('#guia')).toContainText('plant «lantern»');
});

test('beds and seeds work with keyboard and keep focus across redraws', async ({ page }) => {
  await begin(page, 'keyboard-garden');
  await expect(page.getByRole('button', { name: 'bed 1, empty', exact: true })).toBeFocused();
  const seed = page.locator('.semilla').nth(1);
  const word = (await seed.textContent()).trim();
  await seed.focus();
  await page.keyboard.press('Enter');
  await expect(seed).toBeFocused();
  await expect(seed).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.cama.objetivo').first().hover();
  await expect(page.locator('.cama.objetivo').first()).toHaveCSS('border-top-color', 'rgb(232, 200, 114)');
  await expect(page.locator('#pista')).toContainText('«' + word + '»');
  const bed = page.getByRole('button', { name: 'bed 1, empty', exact: true });
  await bed.focus();
  await page.keyboard.press('Space');
  const planted = page.getByRole('button', { name: new RegExp('^bed 1, ' + word + ',') });
  await expect(planted).toBeFocused();
  await expect(page.locator('.cama').first().locator('.palabra')).toHaveText(word);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'bed 2, empty', exact: true })).toBeFocused();
});

test('thaw and another-seed screens keep keyboard focus out of the covered garden', async ({ page }) => {
  await begin(page, 'keyboard-thaw');
  for (let i = 0; i < 14; i++) await page.locator('#noche').press('Enter');
  await expect(page.locator('#pantalla-final')).toBeVisible();
  await expect(page.locator('#copiar-poema')).toBeFocused();
  await expect(page.locator('#app')).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  await expect(page.locator('#otra-siembra')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#pantalla-inicio')).toBeVisible();
  await expect(page.locator('#entrada-siembra')).toBeFocused();
  await expect(page.locator('#app')).toHaveAttribute('inert', '');
  await page.keyboard.type('keyboard-again');
  await page.keyboard.press('Enter');
  await expect(page.locator('#codigo')).toHaveText('keyboard-again');
  await expect(page.locator('#app')).not.toHaveAttribute('inert', '');
  await expect(page.getByRole('button', { name: 'bed 1, empty', exact: true })).toBeFocused();
});

test('intro fits narrow phones and can scroll on a short landscape screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/index.html');
  const title = await page.locator('#intro-titulo').boundingBox();
  expect(title.x).toBeGreaterThanOrEqual(0);
  expect(title.x + title.width).toBeLessThanOrEqual(320);
  await page.locator('#comenzar').scrollIntoViewIfNeeded();
  await expect(page.locator('#comenzar')).toBeInViewport();
  await page.setViewportSize({ width: 667, height: 320 });
  await page.locator('#intro-titulo').scrollIntoViewIfNeeded();
  await expect(page.locator('#intro-titulo')).toBeInViewport();
  const top = await page.locator('#intro-titulo').boundingBox();
  expect(top.y).toBeGreaterThanOrEqual(0);
  await page.locator('#comenzar').scrollIntoViewIfNeeded();
  await expect(page.locator('#comenzar')).toBeInViewport();
  await page.click('#comenzar');
  await expect(page.locator('#pantalla-inicio')).toBeHidden();
});

test('repeating a lamp, full watering or shelter does not burn an action', async ({ page }) => {
  for (const mode of ['luz', 'regar', 'abrigar']) {
    await page.goto('/index.html');
    await page.evaluate(() => {
      const original = VERBO.newGame;
      VERBO.newGame = code => {
        const state = original(code || 'careful-tending');
        state.pouch = ['lantern']; state.forecast = 3;
        return state;
      };
    });
    await page.click('#comenzar');
    await page.locator('.cama').first().click();
    await page.click('button[data-modo="' + mode + '"]');
    await page.locator('.cama').first().click();
    await expect(page.locator('#acciones-restantes')).toHaveText('●○○');
    await page.locator('.cama').first().click();
    await expect(page.locator('#acciones-restantes')).toHaveText('●○○');
    await expect(page.locator('#guia')).toContainText('no action spent');
  }
});

test('watering a full bed still spends an action when its neighbor needs the sip', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const state = original(code || 'neighbor-sip');
      state.pouch = ['lantern', 'marrow']; state.forecast = 0;
      VERBO.plantAt(state, 0, 'lantern'); VERBO.plantAt(state, 1, 'marrow');
      state.beds[0].water = 2; state.actions = 3;
      return state;
    };
  });
  await page.click('#comenzar');
  await page.click('button[data-modo="regar"]');
  await page.locator('.cama').first().click();
  await expect(page.locator('.cama').nth(1).locator('.estado')).toContainText('≈1');
  await expect(page.locator('#acciones-restantes')).toHaveText('●●○');
  await page.locator('.cama').first().click();
  await expect(page.locator('#acciones-restantes')).toHaveText('●●○');
});

test('a night word gets honest water advice and cannot waste a lamp action', async ({ page }) => {
  await beginWithSeed(page, 'marrow');
  await page.locator('.cama').first().click();
  await expect(page.locator('#guia')).toContainText('this night word does not need a lamp');
  await page.click('button[data-modo="luz"]');
  await page.locator('.cama').first().click();
  await expect(page.locator('#acciones-restantes')).toHaveText('●●○');
  await expect(page.locator('#guia')).toContainText('no action spent');
});

test('empty garden tells a non-plant mode to arm plant before promising glowing beds', async ({ page }) => {
  await begin(page, 'after-rain-24');
  await page.click('button[data-modo="luz"]');
  await expect(page.locator('.cama.objetivo')).toHaveCount(0);
  await expect(page.locator('#guia')).toContainText('press plant, then click a glowing bed');
  await page.click('button[data-modo="plantar"]');
  await expect(page.locator('.cama.objetivo')).toHaveCount(9);
  await expect(page.locator('#guia')).toContainText('your move: click a glowing bed');
  await expect(page.locator('#guia')).not.toContainText('press plant');
});

test('legacy poem copy keeps focus on copy so Tab reaches another seed', async ({ page }) => {
  await beginWithSeed(page, 'marrow', false, 14);
  await page.click('#noche');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
  await page.click('#copiar-poema');
  await expect(page.locator('#copiar-poema')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#otra-siembra')).toBeFocused();
});

test('last-night empty-garden advice does not promise useful future wind', async ({ page }) => {
  await beginWithSeed(page, 'marrow', false, 14);
  await expect(page.locator('#guia')).toContainText('none of these words could bloom tonight');
  await expect(page.locator('#guia')).not.toContainText('wind');
});

test('seed codes remain literal text in the thaw stats, never HTML', async ({ page }) => {
  const code = 'winter <b>garden</b> & snow';
  await begin(page, code);
  await expect(page.locator('#codigo')).toHaveText(code);
  for (let i = 0; i < 14; i++) await page.locator('#noche').click();
  await expect(page.locator('#final-stats')).toContainText('seed: ' + code);
  await expect(page.locator('#final-stats b')).toHaveCount(0);
});

test('bed accessible names expose water and nightly care, including resets', async ({ page }) => {
  await beginWithSeed(page, 'ash');
  const bed = page.locator('#camas > .cama').first();
  await bed.click();
  await expect(bed).toHaveAccessibleName(/water 0, unlit, unsheltered$/);
  await page.click('button[data-modo="regar"]');
  await bed.click();
  await expect(bed).toHaveAccessibleName(/water 2, unlit, unsheltered$/);
  await page.click('button[data-modo="luz"]');
  await bed.click();
  await expect(bed).toHaveAccessibleName(/water 2, lit, unsheltered$/);
  await page.click('#noche');
  await expect(bed).toHaveAccessibleName(/water 1, unlit, unsheltered, will bloom tonight$/);
});

test('action buttons expose which tool is armed and reset to plant each night', async ({ page }) => {
  await beginWithSeed(page, 'ash');
  const plant = page.locator('button[data-modo="plantar"]');
  const water = page.locator('button[data-modo="regar"]');
  await expect(plant).toHaveAttribute('aria-pressed', 'true');
  await expect(water).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#camas > .cama').first().click();
  await water.click();
  await expect(water).toHaveAttribute('aria-pressed', 'true');
  await expect(plant).toHaveAttribute('aria-pressed', 'false');
  await page.click('#noche');
  await expect(plant).toHaveAttribute('aria-pressed', 'true');
  await expect(water).toHaveAttribute('aria-pressed', 'false');
});

test('word bodies and care marks follow growth and nightly care', async ({ page }) => {
  await beginWithSeed(page, 'ash');
  const bed = page.locator('#camas > .cama').first();
  await bed.click();
  await expect(bed.locator('svg.planta')).toBeVisible();
  const seedBody = await bed.locator('svg').innerHTML();
  await page.click('button[data-modo="regar"]'); await bed.click();
  await expect(bed).toHaveClass(/watered/);
  await page.click('button[data-modo="luz"]'); await bed.click();
  await expect(bed).toHaveClass(/sunlit/);
  await page.click('#noche');
  await expect(bed.locator('svg')).not.toHaveJSProperty('innerHTML', seedBody);
  await expect(bed).not.toHaveClass(/sunlit/);
  await expect(bed.locator('.palabra')).toHaveText('ash');
});

test('a bloom keeps its flower on the bed that night and the hoard shows flowers', async ({ page }) => {
  await begin(page, 'seed-2xk5l0');
  const bed = page.locator('#camas > .cama').first();
  for (let n = 0; n < 3; n++) {
    if (n === 0) await bed.click(); // plant lantern, the auto-selected first seed
    await page.click('button[data-modo="regar"]');
    await bed.click();
    await page.click('button[data-modo="luz"]');
    await bed.click();
    await page.click('#noche');
  }
  // the payoff stays where the player can see it: golden echo on the bed
  await expect(bed).toHaveAttribute('aria-label', /bloomed here and is safe in the hoard/);
  await expect(bed.locator('svg.planta.eco')).toBeVisible();
  await expect(bed.locator('.palabra')).toHaveText('lantern');
  // and the hoard is a visible collection of flowers, not only words
  await expect(page.locator('#tesoro .tesoro-flor svg')).toHaveCount(1);
  await expect(page.locator('#tesoro .tesoro-flor').first()).toHaveClass(/fam-water/); // lantern: l → water family
  await expect(page.locator('#tesoro')).toContainText('«lantern»');
  await expect(page.locator('#tesoro')).toHaveAttribute('aria-label', /the hoard: «lantern»/);
  // replanting the same word in that bed retires the echo
  await page.locator('#semillas .semilla', { hasText: 'lantern' }).click();
  await bed.click();
  await expect(bed).toHaveAttribute('aria-label', /lantern, seed/);
  await expect(bed.locator('svg.planta.eco')).toHaveCount(0);
});

test('a word that blooms bursts a golden ring at dawn', async ({ page }) => {
  await begin(page, 'seed-2xk5l0');
  const bed = page.locator('#camas > .cama').first();
  for (let n = 0; n < 3; n++) {
    if (n === 0) await bed.click(); // plant lantern, the auto-selected first seed
    await page.click('button[data-modo="regar"]');
    await bed.click();
    await page.click('button[data-modo="luz"]');
    await bed.click();
    await page.click('#noche');
    if (n < 2) await expect(bed.locator('.flash-flor')).toHaveCount(0); // no bloom, no burst
  }
  await expect(bed).toHaveAttribute('aria-label', /bloomed here and is safe in the hoard/);
  await expect(bed.locator('.flash-flor')).toHaveCount(1); // the burst rings where it opened
  await expect(bed.locator('.flash-flor')).toHaveCount(0, { timeout: 4000 }); // and fades
});

test('frost is visible: cold garden, ice on the threatened plant, frost on the shelter glass', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // night 1 forecast: frost, force 1
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern (flame): frostDamage = 1, threatened
  await expect(page.locator('#camas')).toHaveClass(/helada/);
  await expect(bed.locator('svg.planta path.escarcha-planta')).toHaveCount(2);
  await expect(bed).toHaveAttribute('aria-label', /frost threatens it tonight/);
  await page.click('button[data-modo="abrigar"]');
  await bed.click();
  await expect(bed).toHaveAttribute('aria-label', /frost held off by the shelter/);
  await expect(bed.locator('svg.planta path.escarcha-planta')).toHaveCount(0);
  await expect(bed.locator('svg.planta path.escarcha-refugio')).toHaveCount(2);
  // after the night passes the frost cue is gone on a calm night
  await page.click('#noche');
  await expect(page.locator('#camas')).not.toHaveClass(/helada/);
});

test('the moon waxes across the season: shadow recedes from night 1 toward the thaw', async ({ page }) => {
  await begin(page);
  const moon = page.locator('#luna');
  await expect(moon).toHaveAttribute('aria-label', /waxing moon, night 1 of 14/);
  const cxNight1 = await page.locator('#luna .luna-sombra').getAttribute('cx');
  await page.click('#noche');
  await expect(page.locator('#dia')).toHaveText('2');
  await expect(moon).toHaveAttribute('aria-label', /waxing moon, night 2 of 14/);
  const cxNight2 = await page.locator('#luna .luna-sombra').getAttribute('cx');
  expect(parseFloat(cxNight2)).toBeLessThan(parseFloat(cxNight1)); // more of the moon is lit
});

test('a word the frost takes keeps its withered stem on the bed that night', async ({ page }) => {
  await begin(page, 'seed-2xk5l0');
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern, then neglect it: frost + thirst take it by night 3
  await page.click('#noche');
  await page.click('#noche');
  await page.click('#noche');
  await expect(page.locator('#registro')).toContainText('«lantern» went dark');
  await expect(bed).toHaveAttribute('aria-label', /«lantern» went dark here this night/);
  await expect(bed.locator('svg.planta.marchita')).toBeVisible();
  await expect(bed.locator('.palabra.marchita-word')).toHaveText('lantern');
  // replanting retires the withered echo
  await page.locator('#semillas .semilla', { hasText: 'crow' }).click();
  await bed.click();
  await expect(bed).toHaveAttribute('aria-label', /crow, seed/);
  await expect(bed.locator('svg.planta.marchita')).toHaveCount(0);
});

test('the thaw poem rises verse by verse', async ({ page }) => {
  await beginWithSeed(page, 'lantern', false, 12); // day 12: bloom at 14, ending right after
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern
  for (let n = 0; n < 3; n++) {
    await page.click('[data-modo="regar"]');
    await bed.click();
    await page.click('[data-modo="luz"]');
    await bed.click();
    await page.click('#noche');
  }
  const versos = page.locator('#final-poema .verso');
  await expect(page.locator('#pantalla-final')).toBeVisible();
  const count = await versos.count();
  expect(count).toBeGreaterThan(1); // a real poem, more than one verse
  const delays = await versos.evaluateAll(els => els.map(el => parseFloat(el.style.animationDelay)));
  expect(delays[1]).toBeGreaterThan(delays[0]); // later verses wait their turn
  await expect(async () => { // and every verse ends fully shown
    const opacities = await versos.evaluateAll(els => els.map(el => getComputedStyle(el).opacity));
    expect(opacities.every(o => o === '1')).toBe(true);
  }).toPass({ timeout: count * 700 + 3000 });
  // one bloom reads as one word, not "1 words bloomed"
  await expect(page.locator('#final-stats')).toContainText('1 word bloomed');
  await expect(page.locator('#final-stats')).not.toContainText('1 words');
});

test('a bloomed word stands in flower in the thaw garden', async ({ page }) => {
  await beginWithSeed(page, 'lantern', false, 12);
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern
  for (let n = 0; n < 3; n++) {
    await page.click('[data-modo="regar"]');
    await bed.click();
    await page.click('[data-modo="luz"]');
    await bed.click();
    await page.click('#noche');
  }
  await expect(page.locator('#pantalla-final')).toBeVisible();
  const jardin = page.locator('#final-jardin');
  await expect(jardin.locator('.final-flor')).toHaveCount(1);
  await expect(jardin.locator('.final-flor')).toContainText('lantern');
  await expect(jardin.locator('.final-marchita')).toHaveCount(0);
  await expect(jardin).toHaveAttribute('aria-label', /the garden the thaw found: «lantern»/);
});

test('a word winter keeps lies withered in the thaw garden', async ({ page }) => {
  await begin(page, 'seed-2xk5l0');
  await page.locator('#camas > .cama').first().click(); // plant lantern, then neglect it
  for (let n = 0; n < 14; n++) await page.click('#noche');
  await expect(page.locator('#pantalla-final')).toBeVisible();
  await expect(page.locator('#final-titulo')).toHaveText('Silence');
  const jardin = page.locator('#final-jardin');
  await expect(jardin.locator('.final-marchita')).toHaveCount(1);
  await expect(jardin.locator('.final-marchita')).toContainText('lantern');
  await expect(jardin.locator('.final-flor')).toHaveCount(0);
  await expect(jardin).toHaveAttribute('aria-label', /winter keeps «lantern»/);
});

test('watering a bed lets a drop fall where you clicked', async ({ page }) => {
  await beginWithSeed(page, 'lantern');
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern
  await expect(bed.locator('.gota-cayendo')).toHaveCount(0); // planting drops nothing
  await page.click('[data-modo="regar"]');
  await bed.click();
  await expect(bed.locator('.gota-cayendo')).toHaveCount(1); // the drop falls
  await expect(bed.locator('.gota-cayendo')).toHaveCount(0, { timeout: 3000 }); // and is gone
  await bed.click(); // already watered: nothing spent, nothing falls
  await expect(page.locator('#guia')).toContainText('already have water');
  await expect(bed.locator('.gota-cayendo')).toHaveCount(0);
});

test('giving light flashes a warm lamp over the whole row', async ({ page }) => {
  await beginWithSeed(page, 'lantern');
  const beds = page.locator('#camas > .cama');
  await beds.first().click(); // plant lantern in bed 1
  await expect(beds.nth(0).locator('.flash-lampara')).toHaveCount(0); // planting lights nothing
  await page.click('[data-modo="luz"]');
  await beds.first().click(); // give light: the lamp covers the whole row
  await expect(beds.nth(0).locator('.flash-lampara')).toHaveCount(1); // the flash blooms
  await expect(beds.nth(1).locator('.flash-lampara')).toHaveCount(1); // across all three beds
  await expect(beds.nth(2).locator('.flash-lampara')).toHaveCount(1);
  await expect(beds.nth(0).locator('.flash-lampara')).toHaveCount(0, { timeout: 4000 }); // and fades
  await beds.first().click(); // already lit: nothing spent, no flash
  await expect(page.locator('#guia')).toContainText('no word in this row needs more light');
  await expect(beds.nth(0).locator('.flash-lampara')).toHaveCount(0);
});

test('light armed names what the lamp would buy, word by word (fixture)', async ({ page }) => {
  await beginWithSeed(page, 'lantern'); // declared fixture: one fire word, calm night
  const beds = page.locator('#camas > .cama');
  await beds.first().click(); // plant lantern in bed 1
  await page.click('button[data-modo="regar"]');
  await beds.first().click(); // water it
  await page.click('button[data-modo="luz"]');
  await expect(page.locator('#guia')).toContainText('«lantern» would feed on the light');
  await expect(beds.first()).toHaveAttribute('aria-label', /would feed on the light tonight/);
  await beds.first().click(); // commit the lamp
  await expect(page.locator('#guia')).toContainText('the lamp covers the row tonight — «lantern» feeds on it.');
});

test('a dry word says the light pays only if watered too (fixture)', async ({ page }) => {
  await beginWithSeed(page, 'lantern'); // declared fixture: one fire word, calm night
  const beds = page.locator('#camas > .cama');
  await beds.first().click(); // plant lantern, leave it dry
  await page.click('button[data-modo="luz"]');
  await expect(page.locator('#guia')).toContainText('«lantern» is dry — the light pays only if watered tonight too');
  await expect(beds.first()).toHaveAttribute('aria-label', /dry — the light pays only if it is watered tonight too/);
  await beds.first().click(); // light the dry row anyway: the lamp teaches, does not block
  await expect(page.locator('#guia')).toContainText('water them and the light pays off');
});

test('watering next to a frost-threatened word warns that the damp deepens its bite (real seed)', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // night 1: frost force 1; pouch starts with lantern, crow
  const beds = page.locator('#camas > .cama');
  await beds.nth(0).click(); // plant lantern in bed 1
  await beds.nth(1).click(); // plant crow in bed 2
  await expect(beds.nth(0)).toHaveAttribute('aria-label', /frost threatens it tonight \(−2\)/);
  await page.click('button[data-modo="regar"]');
  // the hidden cost is named before the click, in coach and aria
  await expect(page.locator('#guia')).toContainText('the damp would also reach');
  await expect(page.locator('#guia')).toContainText('«lantern»');
  await expect(page.locator('#guia')).toContainText('wet, it would freeze harder tonight');
  await expect(beds.nth(1)).toHaveAttribute('aria-label', /watering it would also dampen «lantern» — wet, the frost would bite harder tonight/);
  await beds.nth(1).click(); // commit: crow drinks, lantern catches the splash
  await expect(page.locator('#guia')).toContainText('the damp reaches «lantern» — wet now, the frost bites harder tonight.');
  await expect(beds.nth(0)).toHaveAttribute('aria-label', /frost threatens it tonight \(−3\)/);
});

test('watering between words shares the damp with both neighbors (fixture)', async ({ page }) => {
  // declared fixture: three dry words in one row, calm night
  await page.goto('/index.html');
  await page.evaluate(() => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const s = original('seed-2xk5l0');
      s.forecast = 0; s.pouch = ['crow'];
      VERBO.plantAt(s, 0, 'moss'); VERBO.plantAt(s, 1, 'crow'); VERBO.plantAt(s, 2, 'bark');
      s.actions = 3;
      return s;
    };
  });
  await page.click('#comenzar');
  await page.click('button[data-modo="regar"]');
  const beds = page.locator('#camas > .cama');
  await expect(page.locator('#guia')).toContainText('Its row neighbors catch a sip of the damp for free.');
  await expect(beds.nth(1)).toHaveAttribute('aria-label', /watering it would also dampen «moss», «bark»/);
  await beds.nth(1).click();
  await expect(page.locator('#guia')).toContainText('the damp reaches «moss», «bark».');
});

test('a word the frost takes is closed in by the cold at dawn', async ({ page }) => {
  await begin(page, 'seed-2xk5l0');
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern, then neglect it
  for (let n = 0; n < 3; n++) {
    await page.click('#noche');
    if (n < 2) await expect(bed.locator('.flash-escarcha')).toHaveCount(0); // still alive, no cold
  }
  await expect(bed).toHaveAttribute('aria-label', /went dark here this night/);
  await expect(bed.locator('.flash-escarcha')).toHaveCount(1); // the cold closes in
  await expect(bed.locator('.flash-escarcha')).toHaveCount(0, { timeout: 4000 }); // and lifts
});

test('ending the night blinks the garden into the new night', async ({ page }) => {
  await beginWithSeed(page, 'lantern');
  await page.locator('#camas > .cama').first().click(); // plant lantern
  await page.click('#noche');
  await expect(page.locator('#camas')).toHaveClass(/paso-noche/);
});

test('a frost forecast blinks colder', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // night 5 forecast: frost force 2
  await page.locator('#camas > .cama').first().click(); // plant lantern
  for (let n = 0; n < 4; n++) await page.click('#noche');
  await expect(page.locator('#camas')).toHaveClass(/paso-noche-fria/);
});

test('a word the frost bites carries the mark while it grows', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // night 1 frost force 1: unsheltered lantern takes −2 and lives
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern
  await page.click('[data-modo="regar"]');
  await bed.click(); // water it through the frost night
  await page.click('#noche');
  await expect(bed).toHaveAttribute('aria-label', /frost-bitten/);
  await page.click('[data-modo="regar"]');
  await bed.click(); // water again: sprout by dawn
  await page.click('#noche');
  await expect(bed).toHaveAttribute('aria-label', /frost-bitten/);
  await expect(bed.locator('svg.planta .cicatriz')).toBeVisible();
});

test('the title screen shows a word growing before any rules', async ({ page }) => {
  await page.goto('/index.html');
  const muestra = page.locator('#muestra-inicio .muestra');
  await expect(muestra).toHaveCount(3);
  await expect(muestra.locator('svg.planta')).toHaveCount(3);
  await expect(muestra.first().locator('.muestra-word')).toHaveText('«ember»');
  // the second is lit: a lamp sun hangs over it
  await expect(muestra.nth(1).locator('svg.planta circle[fill="#e8c872"]')).toHaveCount(1);
  // the third is in bloom: the amber petal is open
  await expect(muestra.nth(2).locator('svg.planta path[fill="#e8c872"]')).toHaveCount(1);
});

test('on a frost night the coach names the watering gamble', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // night 1: frost force 1
  await page.locator('#camas > .cama').first().click(); // plant lantern
  await expect(page.locator('#guia')).toContainText('wets it for the frost');
  // a wet word warns harder in its bed label than a dry one would
  await page.click('[data-modo="regar"]');
  await page.locator('#camas > .cama').first().click();
  await expect(page.locator('#camas > .cama').first()).toHaveAttribute('aria-label', /frost threatens it tonight/);
});

test('a wet word facing frost unsheltered shows frozen droplets', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // night 1: frost force 1
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern
  await page.click('[data-modo="regar"]');
  await bed.click(); // water it into the frost night
  await expect(bed.locator('svg.planta .gota-helada')).not.toHaveCount(0);
  await expect(bed).toHaveAttribute('aria-label', /the water on it is freezing/);
  await page.click('[data-modo="abrigar"]');
  await bed.click(); // shelter holds the frost off: droplets thaw
  await expect(bed.locator('svg.planta .gota-helada')).toHaveCount(0);
  await expect(bed).toHaveAttribute('aria-label', /frost held off by the shelter/);
});

test('a word the frost wounds shows its toll drifting over the bed at dawn', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // night 1 frost force 1: unsheltered wet lantern takes −3 and lives
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern
  await page.click('[data-modo="regar"]');
  await bed.click(); // water it into the frost night
  await page.click('#noche');
  const merma = bed.locator('.merma');
  await expect(merma).toHaveCount(1);
  await expect(merma).toHaveText('−3'); // base 1 + wet 1 + flame theme 1
  await expect(merma).toHaveClass(/merma-helada/);
  // the wound is also told in words: the bed label carries the bite
  await expect(bed).toHaveAttribute('aria-label', /frost-bitten/);
});

test('a word that went thirsty shows a dry toll, not an icy one', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // night 1 frost force 1, night 2 calm; lantern (thirst 1) parches from age 2
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern
  await page.click('[data-modo="abrigar"]');
  await bed.click(); // shelter keeps the frost off so only thirst can bite later
  await page.click('#noche'); // night 1: sheltered, unwatered — no wound yet
  await expect(bed.locator('.merma')).toHaveCount(0);
  await page.click('#noche'); // night 2: calm, still unwatered — thirst bites
  const merma = bed.locator('.merma');
  await expect(merma).toHaveCount(1);
  await expect(merma).toHaveText('−1');
  await expect(merma).toHaveClass(/merma-seca/);
});

test('a word that lived through the frost keeps its mark in the hoard when it blooms', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // lantern: frost-bitten night 1, blooms at dawn of night 8 if tended
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern
  for (let n = 1; n <= 8; n++) {
    await page.click('[data-modo="regar"]');
    await bed.click(); // water
    const frost = await page.locator('#pronostico').textContent();
    if (/frost/.test(frost) && n > 1) { // night 1 it takes the bite that marks it
      await page.click('[data-modo="abrigar"]');
      await bed.click(); // shelter holds the frost off
    }
    await page.click('#noche');
  }
  const chip = page.locator('#tesoro .tesoro-flor.marcada');
  await expect(chip).toHaveCount(1);
  await expect(chip.locator('b')).toHaveText('«lantern»');
  await expect(page.locator('#tesoro')).toHaveAttribute('aria-label', /frost-marked/);
});

test('a bloomed word that never met the frost carries no mark', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // crow: unplanted nights 1-8, planted night 9, no scars
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern
  for (let n = 1; n <= 8; n++) {
    await page.click('[data-modo="regar"]');
    await bed.click();
    const frost = await page.locator('#pronostico').textContent();
    if (/frost/.test(frost) && n > 1) {
      await page.click('[data-modo="abrigar"]');
      await bed.click();
    }
    await page.click('#noche');
  }
  // lantern bloomed frost-marked; now grow crow (pouch got lantern back, pick crow)
  await page.locator('#semillas > .semilla', { hasText: 'crow' }).click();
  await page.locator('#camas > .cama').nth(1).click(); // plant crow in bed 2
  for (let n = 9; n <= 14 && !await page.locator('#tesoro .tesoro-flor', { hasText: 'crow' }).count(); n++) {
    await page.click('[data-modo="regar"]');
    await page.locator('#camas > .cama').nth(1).click();
    const frost = await page.locator('#pronostico').textContent();
    if (/frost/.test(frost)) {
      await page.click('[data-modo="abrigar"]');
      await page.locator('#camas > .cama').nth(1).click();
    }
    await page.click('#noche');
  }
  const crowChip = page.locator('#tesoro .tesoro-flor', { hasText: 'crow' });
  await expect(crowChip).toHaveCount(1);
  await expect(crowChip).not.toHaveClass(/marcada/);
});

test('the sky shows tomorrow, and tomorrow keeps its promise', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // dealt sky: [1,0,0,0,2,1,1,2,...] — night 5 is frost force 2
  const manana = page.locator('#manana');
  const bed = page.locator('#camas > .cama').first();
  await expect(manana).toHaveText('clear'); // night 2 is calm
  await bed.click(); // plant lantern
  for (let n = 1; n <= 3; n++) { // nights 1-3: calm tomorrows
    await page.click('[data-modo="regar"]');
    await bed.click();
    await page.click('#noche');
    if (n === 1) { // night-1 frost bit the unsheltered wet flame word at dawn (−3); it lives
      await expect(bed).toHaveAttribute('aria-label', /health 1, water 1/);
      await expect(bed).toHaveAttribute('aria-label', /frost-bitten/);
    }
  }
  await expect(page.locator('#dia')).toHaveText('4');
  await expect(manana).toHaveText('frost, force 2'); // night 5, seen one night ahead
  await expect(manana).toHaveClass(/pronostico-frio/);
  // honesty: yesterday's tomorrow is today's tonight
  await page.click('[data-modo="regar"]');
  await bed.click();
  await page.click('[data-modo="abrigar"]');
  await bed.click();
  await page.click('#noche');
  await expect(page.locator('#dia')).toHaveText('5');
  await expect(page.locator('#pronostico')).toHaveText('frost, force 2');
});

test('the last night promises the thaw', async ({ page }) => {
  await beginWithSeed(page, 'marrow', false, 14);
  await expect(page.locator('#manana')).toHaveText('the thaw');
  await expect(page.locator('#manana')).toHaveClass(/pronostico-deshielo/);
});

test('a word still wet at dusk is named before tomorrow\'s frost, and a dry one is not', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const state = original('hoardcheck');
      state.day = 4; state.forecast = 0;
      state.sky = state.sky.map(() => 0); state.sky[4] = 2; // night 5: frost force 2
      state.pouch = ['lantern'];
      VERBO.plantAt(state, 0, 'lantern');
      state.beds[0].water = 2; // topped up: tonight's growth drinks one, one stays
      state.actions = 3;
      return state;
    };
  });
  await page.click('#comenzar');
  const guia = page.locator('#guia');
  await expect(guia).toContainText('Tomorrow brings frost (force 2)');
  await expect(guia).toContainText('«lantern» would still be wet at dusk');
  await expect(page.locator('#noche')).toHaveClass(/listo/); // the warning asks nothing of tonight
  // drink it down to one: tonight's growth will finish it, no warning
  await page.evaluate(() => {
    // the same garden, one sip less
    const ev = new Event('noop'); void ev;
  });
  await page.reload();
  await page.evaluate(() => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const state = original('hoardcheck');
      state.day = 4; state.forecast = 0;
      state.sky = state.sky.map(() => 0); state.sky[4] = 2;
      state.pouch = ['lantern'];
      VERBO.plantAt(state, 0, 'lantern');
      state.beds[0].water = 1; // growth drinks it tonight: dry at tomorrow's dusk
      state.actions = 3;
      return state;
    };
  });
  await page.click('#comenzar');
  await expect(page.locator('#guia')).not.toContainText('still be wet at dusk');
});

test('a bed the frost kills on lies frozen for two nights, then takes root again', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const state = original('hoardcheck');
      state.sky = state.sky.map(() => 0); state.sky[0] = 3; // night 1: force-3 frost
      state.forecast = 3; // newGame computed it from the original sky before we overrode
      state.pouch = ['ember', 'crow'];
      return state;
    };
  });
  await page.click('#comenzar');
  const bed1 = page.locator('#camas > .cama').nth(0);
  const bed2 = page.locator('#camas > .cama').nth(1);
  await bed1.click(); // plant ember (flame, no hardiness): force 3 takes it whole
  await page.click('#noche');
  // night 2: the loss and the frozen bed are both where the player can see them
  await expect(page.locator('#registro')).toContainText('the bed lies frozen');
  await expect(bed1).toHaveClass(/congelada/);
  await expect(bed1).toHaveAttribute('aria-label', /went dark here this night/);
  await expect(bed1).toHaveAttribute('aria-label', /the bed lies frozen/);
  await expect(bed1).not.toHaveClass(/objetivo/); // no planting glow on ice
  await expect(bed2).toHaveClass(/objetivo/); // but the next bed takes seeds
  // clicking the frozen bed explains and spends nothing
  await bed1.click();
  await expect(page.locator('#guia')).toContainText('no action spent');
  await expect(page.locator('#acciones-restantes')).toHaveText('●●●');
  // plant crow in the free bed, then wait out the freeze
  await bed2.click();
  await expect(bed2).toHaveAttribute('aria-label', /crow, seed/);
  await page.click('#noche'); // night 3: still frozen (alone now, the echo retired by crow? no — bed 1 echo persists)
  await expect(bed1).toHaveAttribute('aria-label', /frozen from the frost|the bed lies frozen/);
  await expect(bed1).not.toHaveClass(/objetivo/);
  await page.click('#noche'); // night 4: thawed
  await expect(bed1).not.toHaveClass(/congelada/);
  await expect(bed1).toHaveClass(/objetivo/);
});

test('a threatened word shows the bite coming, and watering deepens it', async ({ page }) => {
  await begin(page, 'seed-2xk5l0'); // night 1: frost force 1
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern (flame, no hardiness): the frost bites −2 dry
  await expect(bed.locator('.aviso-helada')).toHaveText('the frost will bite tonight (−2)');
  await expect(bed).toHaveAttribute('aria-label', /frost threatens it tonight \(−2\)/);
  await page.click('[data-modo="regar"]');
  await bed.click(); // water it into the frost: the bite deepens the moment you commit
  await expect(bed.locator('.aviso-helada')).toHaveText('the frost will bite tonight (−3)');
  await expect(bed).toHaveAttribute('aria-label', /frost threatens it tonight \(−3\)/);
  await expect(bed).toHaveAttribute('aria-label', /the water on it is freezing/);
});

test('a word the frost would take tonight says so, and shelter lifts the sentence', async ({ page }) => {
  // declared fixture: force-2 frost tonight, flame word — not a played run
  await page.goto('/index.html');
  await page.evaluate(() => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const state = original('hoardcheck');
      state.sky = state.sky.map(() => 0); state.sky[0] = 2; state.forecast = 2;
      state.pouch = ['lantern', 'crow'];
      return state;
    };
  });
  await page.click('#comenzar');
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern: force 2 + flame = −3 dry, it would live
  await expect(bed.locator('.aviso-helada')).toHaveText('the frost will bite tonight (−3)');
  await expect(bed.locator('.aviso-helada')).not.toHaveClass(/mortal/);
  await page.click('[data-modo="regar"]');
  await bed.click(); // wet: the bite deepens to −4 — its whole health
  await expect(bed.locator('.aviso-helada')).toHaveText('the frost tonight would take it (−4)');
  await expect(bed.locator('.aviso-helada')).toHaveClass(/mortal/);
  await expect(bed).toHaveAttribute('aria-label', /the frost tonight would kill it \(−4\)/);
  await page.click('[data-modo="abrigar"]');
  await bed.click(); // the shelter lifts the sentence
  await expect(bed.locator('.aviso-helada')).toHaveText('');
  await expect(bed).toHaveAttribute('aria-label', /frost held off by the shelter/);
});

test('a dry word that will go thirsty tonight says so, and watering lifts it', async ({ page }) => {
  await begin(page, 'seed-2xk5l0');
  const bed = page.locator('#camas > .cama').nth(1);
  await page.locator('#semillas .semilla', { hasText: 'kettle' }).click();
  await bed.click(); // plant kettle (thirst normal), never water it
  await page.click('#noche'); // night 2: calm, kettle is now old enough to thirst
  await expect(bed.locator('.aviso-sed')).toHaveText('it will go thirsty tonight (−1)');
  await expect(bed).toHaveAttribute('aria-label', /will go thirsty tonight/);
  await expect(bed).toHaveClass(/sedienta/); // the plant itself droops
  await page.click('[data-modo="regar"]');
  await bed.click(); // water it: the warning lifts
  await expect(bed.locator('.aviso-sed')).toHaveCount(0);
  await expect(bed).not.toHaveAttribute('aria-label', /will go thirsty tonight/);
  await expect(bed).not.toHaveClass(/sedienta/);
});

test('a word that lost health without reaching ailing fades on the board', async ({ page }) => {
  // declared fixture: force-1 frost on the first night — not a played run
  await page.goto('/index.html');
  await page.evaluate(() => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const state = original('hoardcheck');
      state.sky = state.sky.map(() => 0); state.sky[1] = 1;
      state.pouch = ['crow', 'lantern'];
      return state;
    };
  });
  await page.click('#comenzar');
  const bed = page.locator('#camas > .cama').first();
  await page.locator('#semillas .semilla', { hasText: 'crow' }).click();
  await bed.click(); // plant crow (thirst none, resists frost 0)
  await page.click('#noche'); // night 1 is calm
  await page.click('#noche'); // night 2 carries the force-1 frost: one bite, health 4 -> 3
  await expect(bed).toHaveClass(/magullada/); // faded, not yet ailing
  await expect(bed).not.toHaveClass(/ailing/);
});

test('a word without thirst never shows the thirsty warning', async ({ page }) => {
  await begin(page, 'seed-2xk5l0');
  const bed = page.locator('#camas > .cama').nth(1);
  await page.locator('#semillas .semilla', { hasText: 'crow' }).click();
  await bed.click(); // plant crow (thirst none), never water it
  await page.click('#noche');
  await expect(bed.locator('.aviso-sed')).toHaveCount(0);
  await expect(bed).not.toHaveAttribute('aria-label', /will go thirsty tonight/);
  await expect(bed).not.toHaveClass(/sedienta/);
});

test('frost and thirst warnings stack on a word that faces both', async ({ page }) => {
  // declared fixture: calm first night, force-1 frost on night 2 — not a played run
  await page.goto('/index.html');
  await page.evaluate(() => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const state = original('hoardcheck');
      state.sky = state.sky.map(() => 0); state.sky[1] = 1;
      state.pouch = ['lantern', 'crow'];
      return state;
    };
  });
  await page.click('#comenzar');
  const bed = page.locator('#camas > .cama').first();
  await bed.click(); // plant lantern (flame, thirst normal), never water it
  await page.click('#noche'); // night 2: frost force 1, lantern dry and old enough to thirst
  await expect(bed.locator('.aviso-helada')).toHaveText('the frost will bite tonight (−2)');
  await expect(bed.locator('.aviso-sed')).toHaveText('it will go thirsty tonight (−1)');
  await expect(bed).toHaveAttribute('aria-label', /frost threatens it tonight \(−2\)/);
  await expect(bed).toHaveAttribute('aria-label', /will go thirsty tonight/);
});

test('a graft shows its child and its cost before committing, and lets you reconsider', async ({ page }) => {
  test.setTimeout(60000);
  await begin(page, 'seed-graft8'); // same engine-verified setup as the other graft tests
  const actionsLeft = async () => !(await page.locator('#acciones-restantes').textContent()).startsWith('○');
  const arm = async modo => {
    const btn = page.locator('button[data-modo="' + modo + '"]');
    if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
  };
  for (let night = 0; night < 14; night++) {
    const graftable = await page.locator('#camas > .cama').evaluateAll(
      els => els.filter(el => /, (stem|bud),/.test(el.getAttribute('aria-label') || '')).length
    );
    if (graftable >= 2) break;
    for (const bed of await page.locator('#camas > .cama:has(.planta:not(.eco))').all()) {
      if (!(await actionsLeft())) break;
      if (/frost threatens/.test(await bed.getAttribute('aria-label') || '')) {
        await arm('abrigar');
        await bed.click();
      }
    }
    while ((await page.locator('#camas > .cama:has(.planta:not(.eco))').count()) < 2 && (await actionsLeft())) {
      const empty = page.locator('#camas > .cama:not(:has(.planta:not(.eco))):not(.congelada)');
      if ((await empty.count()) === 0 || (await page.locator('#semillas > .semilla').count()) === 0) break;
      await arm('plantar');
      await empty.first().click();
    }
    for (const bed of await page.locator('#camas > .cama:has(.planta:not(.eco))').all()) {
      if (!(await actionsLeft())) break;
      const aria = (await bed.getAttribute('aria-label')) || '';
      if (/frost threatens|frost held off/.test(aria)) continue;
      if (!/≈/.test(await bed.locator('.estado').textContent())) {
        await arm('regar');
        await bed.click();
      }
    }
    await page.click('#noche');
  }
  const blend = (a, b) => a.slice(0, Math.ceil(a.length / 2)) + b.slice(Math.floor(b.length / 2));
  await page.click('button[data-modo="injertar"]');
  const glow = page.locator('#camas > .cama.objetivo');
  await expect(glow).toHaveCount(2);
  const wordAt = async loc => ((await loc.getAttribute('aria-label')) || '').match(/bed \d+, (\w+),/)[1];
  const A = await wordAt(glow.nth(0)), B = await wordAt(glow.nth(1));
  const accionesAntes = await page.locator('#acciones-restantes').textContent();
  await glow.nth(0).click();
  await glow.nth(1).click();
  // the trade is on the table, nothing committed yet
  await expect(page.locator('#guia')).toContainText('«' + A + '» + «' + B + '» = «' + blend(A, B) + '»');
  await expect(page.locator('#guia')).toContainText('both parents go');
  await expect(page.locator('#guia')).toContainText('press graft again to confirm');
  await expect(page.locator('#pista')).toContainText('would be born: «' + blend(A, B) + '»');
  await expect(page.locator('#pista')).toContainText('vigorous');
  await expect(page.locator('button[data-modo="injertar"]')).toHaveText('graft «' + blend(A, B) + '» (2) →');
  await expect(page.locator('#registro')).not.toContainText('you grafted');
  await expect(page.locator('#acciones-restantes')).toHaveText(accionesAntes);
  await expect(glow.nth(0)).toHaveAttribute('aria-label', /chosen for the graft/);
  // letting the first word go drops the preview
  await glow.nth(0).click();
  await expect(page.locator('#guia')).toContainText('click a second glowing word');
  await expect(page.locator('button[data-modo="injertar"]')).toHaveText('graft (2)');
  // re-picking the same word makes it the SECOND pick: the preview names the pair in order
  await glow.nth(0).click();
  await expect(page.locator('#guia')).toContainText('«' + B + '» + «' + A + '» = «' + blend(B, A) + '»');
  // and confirming grafts exactly the pair shown
  await page.click('button[data-modo="injertar"]');
  await expect(page.locator('#registro')).toContainText('you grafted «' + B + '» with «' + A + '»');
});

test('a watered word one night from blooming glows and says so, then blooms', async ({ page }) => {
  await beginWithSeed(page, 'ash');
  const bed = page.locator('#camas > .cama').first();
  await bed.click();
  await page.click('button[data-modo="regar"]');
  await bed.click();
  await expect(bed).not.toHaveClass(/florece/);
  await page.click('button[data-modo="luz"]');
  await bed.click();
  await page.click('#noche');
  await expect(bed).toHaveClass(/florece/);
  await expect(bed).toHaveAccessibleName(/will bloom tonight/);
  await expect(bed.locator('.estado')).toContainText('blooms tonight');
  await page.click('#noche');
  await expect(bed).not.toHaveClass(/florece/);
});

test('a word the frost would kill tonight does not claim it will bloom', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    const original = VERBO.newGame;
    VERBO.newGame = code => {
      const state = original(code || 'hoardcheck');
      state.pouch = ['ash']; state.forecast = 0; state.sky = state.sky.map((_, i) => (i === 0 ? 0 : 9));
      return state;
    };
  });
  await page.click('#comenzar');
  const bed = page.locator('#camas > .cama').first();
  await bed.click();
  await page.click('button[data-modo="regar"]');
  await bed.click();
  await page.click('button[data-modo="luz"]');
  await bed.click();
  await page.click('#noche');
  await page.click('button[data-modo="regar"]');
  await bed.click();
  await expect(bed.locator('.aviso-helada')).toHaveClass(/mortal/);
  await expect(bed).not.toHaveClass(/florece/);
  await expect(bed.locator('.estado')).not.toContainText('blooms tonight');
});

test('a bed status line has readable contrast (not the dim UI green)', async ({ page }) => {
  await beginWithSeed(page, 'ash');
  const bed = page.locator('#camas > .cama').first();
  await bed.click();
  await expect(bed.locator('.estado')).toHaveCSS('color', 'rgb(134, 181, 138)');
});
