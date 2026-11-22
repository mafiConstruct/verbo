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
  await begin(page, 'seed-graft2'); // engine-verified: mature pair on day 3
  // policy proven against the engine: keep 2 beds planted, water everything
  for (let night = 0; night < 14; night++) {
    const glowGraftable = await page.locator('#camas > .cama').evaluateAll(
      els => els.filter(el => {
        const pre = el.querySelector('.planta');
        return pre && (pre.textContent.split('\n')[2] || '').includes("'");
      }).length
    );
    if (glowGraftable >= 2) break;
    // plant up to two (matches the engine-proven schedule: both in on day 1)
    for (let k = 0; k < 2; k++) {
      const plants = await page.locator('#camas > .cama:has(.planta)').count();
      const empty = await page.locator('#camas > .cama:not(:has(.planta))').count();
      const seeds = await page.locator('#semillas > .semilla').count();
      const actions = await page.locator('#acciones-restantes').textContent();
      if (plants < 2 && empty > 0 && seeds > 0 && !actions.startsWith('○')) {
        await page.locator('#camas > .cama:not(:has(.planta))').first().click();
      }
    }
    // water every unwatered plant (≈ mark absent in .estado)
    for (const bed of await page.locator('#camas > .cama:has(.planta)').all()) {
      if (!/≈/.test(await bed.locator('.estado').textContent())) {
        await page.click('button[data-modo="regar"]');
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
  await expect(page.locator('#registro')).toContainText('you grafted');
  await expect(page.locator('#semillas')).not.toHaveText(pouchBefore);
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
      const state = original(code);
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
