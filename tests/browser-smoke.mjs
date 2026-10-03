// Optional production-build browser check. See tests/README.md for environment paths.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'silicon-qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
});
const checks = [];
const passed = name => { checks.push(name); console.log(`PASS ${name}`); };
const wait = (page, duration = 400) => page.waitForTimeout(duration);
const scrollTo = (page, selector, offset = 100) => page.evaluate(({ selector, offset }) => {
  const element = document.querySelector(selector);
  window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - offset, behavior: 'instant' });
}, { selector, offset });
const layout = page => page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth, headerTop: document.querySelector('.site-header').getBoundingClientRect().top }));
const disableWebGL = () => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    return String(type).includes('webgl') ? null : getContext.call(this, type, ...args);
  };
};
async function openContext(options = {}, init) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', ...options });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('js-ready'));
  return { context, page, errors };
}
const waitJourney = (page, expected) => page.waitForFunction(expected => Math.abs(Number(document.querySelector('#scene').dataset.journey) - expected) < .025, expected, { timeout: 40000 });
const waitReveals = page => page.waitForFunction(() => [...document.querySelectorAll('[data-reveal]')].filter(el => {
  const rect = el.getBoundingClientRect(); return rect.bottom > 150 && rect.top < innerHeight - 100;
}).every(el => +getComputedStyle(el).opacity > .95), null, { timeout: 20000 });

try {
  if (process.env.CHECK_GROUP !== 'ui') {
    const { context, page, errors } = await openContext();
    const canvas = page.locator('#scene');
    await page.waitForFunction(() => document.querySelector('#scene').dataset.state === 'ready' && +document.querySelector('#scene').dataset.frames > 2, null, { timeout: 40000 });
    assert.equal(await canvas.getAttribute('data-scene-shape'), 'silicon-journey');
    assert.ok(+await canvas.getAttribute('data-draw-calls') <= 40);
    assert.ok(+await canvas.getAttribute('data-triangles') < 90000);
    assert.equal(await canvas.getAttribute('data-particles'), '1100');
    await page.screenshot({ path: join(output, 'desktop-hero.png') });
    assert.deepEqual(errors, []);
    passed('real WebGL renders lit silicon geometry, flowing tubes and particles within the draw budget');

    await scrollTo(page, '#about', 0); await waitJourney(page, 1);
    await scrollTo(page, '#work', 0); await waitJourney(page, 2);
    let previousZ = Infinity;
    for (const project of ['sweets', 'terminal', 'bunk', 'environment', 'stickman']) {
      await scrollTo(page, `#project-${project}-title`);
      const expected = await page.evaluate(() => {
        const top = id => document.getElementById(id).getBoundingClientRect().top + scrollY;
        return 2 + (scrollY - top('work')) / (top('research') - top('work'));
      });
      await waitJourney(page, expected);
      const z = Number((await canvas.getAttribute('data-camera')).split(',')[2]);
      assert.ok(z < previousZ, `camera travels forward at ${project}`);
      previousZ = z;
    }
    await page.locator('.project--stickman .project-copy').hover();
    await page.waitForFunction(() => +document.querySelector('#scene').dataset.hoverStrength > .6, null, { timeout: 20000 });
    await page.mouse.move(8, 90);
    await page.waitForFunction(() => +document.querySelector('#scene').dataset.hoverStrength < .05, null, { timeout: 20000 });
    passed('camera travels through all five projects; pointer and project hover update the live environment');

    await scrollTo(page, '#research', 0); await waitJourney(page, 3); await waitReveals(page);
    await page.screenshot({ path: join(output, 'research-core.png') });
    await scrollTo(page, '#contact', 0); await waitJourney(page, 4); await waitReveals(page);
    await page.screenshot({ path: join(output, 'contact.png') });
    await scrollTo(page, '#hero', 88); await waitJourney(page, 0);
    const start = (await canvas.getAttribute('data-camera')).split(',').map(Number);
    assert.ok(Math.abs(start[2] - 13.6) < .2);
    passed('camera passes the research core and final gate, then reverses back to the hero');

    await page.locator('#motion-toggle').click();
    const frames = await canvas.getAttribute('data-frames');
    await wait(page, 1200);
    assert.equal(await canvas.getAttribute('data-state'), 'paused');
    assert.equal(await canvas.getAttribute('data-frames'), frames);
    for (const theme of ['violet', 'warm', 'teal']) {
      await page.locator('#theme-toggle').click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.equal(await canvas.getAttribute('data-theme'), theme);
      await page.screenshot({ path: join(output, `theme-${theme}.png`) });
    }
    await page.locator('#theme-toggle').click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#scene').dataset.state === 'ready', null, { timeout: 40000 });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'violet');
    passed('manual pause freezes frames; theme switching updates the renderer and survives reload');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('#motion-toggle').disabled);
    assert.equal(await page.locator('#motion-toggle').textContent(), 'Motion disabled');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForFunction(() => document.querySelector('#scene').dataset.particles === '440');
    assert.ok(+await canvas.getAttribute('data-dpr') <= 1.5);
    await page.screenshot({ path: join(output, 'mobile-static.png') });
    passed('reduced motion uses a static composition; resize reframes and selects mobile detail');

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.querySelector('#scene').dataset.state === 'ready');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    assert.equal(await canvas.getAttribute('data-state'), 'paused');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await page.waitForFunction(() => document.querySelector('#scene').dataset.state === 'ready');
    await page.evaluate(() => document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-unavailable'));
    assert.equal(await canvas.isHidden(), true);
    assert.equal(await page.locator('#loader').isHidden(), true);
    assert.equal(await page.locator('#motion-toggle').isHidden(), true);
    assert.deepEqual(errors, []);
    passed('BFCache pauses/resumes; real context loss switches to the usable static fallback');
    await context.close();
  }

  // UI checks are isolated from the software GPU; actual rendering is checked above.
  {
    const { context, page, errors } = await openContext({}, disableWebGL);
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-unavailable'));
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 1000 });
      for (const selector of ['#hero', '#about', '.project--bunk[data-project]', '#research', '#contact', '.site-footer']) {
        await scrollTo(page, selector); await wait(page, 1100);
        const metrics = await layout(page);
        assert.ok(metrics.content <= width, `${width}px overflow at ${selector}: ${metrics.content}`);
        assert.ok(Math.abs(metrics.headerTop) < 1, `header scrolled away at ${width}px`);
      }
      passed(`${width}px layout has no overflow and keeps navigation available`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { history.scrollRestoration = 'manual'; scrollTo({ top: 0, behavior: 'instant' }); });
    await page.reload({ waitUntil: 'networkidle' });
    await scrollTo(page, '.project--bunk[data-project]');
    await page.waitForFunction(() => document.querySelector('.project--bunk .screenshot-panel').getAnimations().length > 0);
    const entrance = await page.locator('.project--bunk .screenshot-panel').first().evaluate(el => {
      const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = 0;
      const start = { scale: getComputedStyle(el).scale, opacity: getComputedStyle(el).opacity };
      animation.finish(); return start;
    });
    assert.equal(+entrance.scale, .94);
    assert.ok(+entrance.opacity >= .6, 'entrance never hides the screenshot');
    await wait(page, 1100);
    for (const project of ['bunk', 'environment']) {
      assert.equal(await page.locator(`.project--${project} .screenshot-panel`).count(), 2);
      await scrollTo(page, `.project--${project}[data-project]`); await wait(page, 1100);
      await page.screenshot({ path: join(output, `${project}-gallery.png`) });
    }
    for (const link of await page.locator('[data-preview]').all()) {
      await link.scrollIntoViewIfNeeded(); await wait(page, 1100); await link.click();
      await page.waitForFunction(() => { const img = document.querySelector('.image-preview-image'); return img.complete && img.naturalWidth > 0; });
      assert.equal(await page.locator('#image-preview').evaluate(el => el.open), true);
      assert.ok((await page.locator('#preview-caption').textContent()).length > 10);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#image-preview').evaluate(el => el.open), false);
      assert.equal(await link.evaluate(el => el === document.activeElement), true);
    }
    passed('restrained image entrances and all six full-size previews preserve images, captions and focus');

    await scrollTo(page, '.project--bunk[data-project]');
    const panel = page.locator('.project--bunk .screenshot-panel').first();
    await panel.hover(); await wait(page);
    assert.notEqual(await panel.evaluate(el => getComputedStyle(el).transform), 'none');
    assert.ok((await panel.getAttribute('style')).includes('--pointer-x'));
    assert.equal(await page.locator('.cursor-glow').evaluate(el => el.classList.contains('is-visible')), true);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('#menu-toggle').click();
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
    await page.locator('#nav-links a[href="#work"]').click();
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#work').evaluate(el => el === document.activeElement), true);
    await page.locator('#menu-toggle').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#nav-links').evaluate(el => el.inert), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await scrollTo(page, '.project--environment[data-project]');
    assert.equal(await page.locator('.cursor-glow').evaluate(el => getComputedStyle(el).display), 'none');
    assert.equal(await page.locator('.project--environment .screenshot-panel').first().evaluate(el => el.getAnimations().length), 0);
    passed('pointer tilt, keyboard/mobile navigation and runtime reduced motion remain usable');

    for (const theme of ['violet', 'warm', 'teal']) {
      await page.locator('#theme-toggle').click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        // Chromium can expose the new innerWidth before recalculating vw units.
        // Measure the settled responsive layout, as in the main width matrix.
        await wait(page, 600);
        await scrollTo(page, '#contact');
        assert.ok((await layout(page)).content <= width, `${theme} contact overflows ${width}px`);
      }
    }
    for (let index = 0; index < 16; index += 1) {
      await page.setViewportSize({ width: [320, 768, 1440, 375][index % 4], height: 812 });
      await page.evaluate(index => scrollTo({ top: index % 2 ? document.body.scrollHeight : 0, behavior: 'instant' }), index);
    }
    await wait(page, 600);
    assert.ok((await layout(page)).content <= (await layout(page)).width);
    const urls = await page.locator('a[href], img[src]').evaluateAll(elements => [...new Set(elements.map(el => el instanceof HTMLImageElement ? el.src : el.href).filter(url => url.startsWith(location.origin) && !url.includes('#')))]);
    for (const url of urls) assert.equal((await page.request.get(url)).ok(), true, `missing asset: ${url}`);
    assert.equal((await page.request.get(`${baseURL}/resume.html`)).ok(), true);
    assert.deepEqual(errors.filter(error => !error.includes('Error creating WebGL context')), []);
    passed('all palettes, rapid resize/scroll, images, documents and resume links pass');
    await context.close();
  }
  {
    const { context, page } = await openContext({ isMobile: true, hasTouch: true, viewport: { width: 375, height: 812 } }, () => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) { return String(type).includes('webgl') ? null : getContext.call(this, type, ...args); };
      Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
      Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
    });
    await page.locator('#theme-toggle').tap();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'violet');
    await scrollTo(page, '.project--environment[data-project]');
    await page.locator('.project--environment [data-preview]').first().tap();
    assert.equal(await page.locator('#image-preview').evaluate(el => el.open), true);
    await page.locator('.preview-close').tap();
    passed('touch previews and theme controls work with blocked storage');
    await context.close();
  }
  {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 812 } });
    const page = await context.newPage(); await page.goto(baseURL);
    assert.equal(await page.locator('#nav-links a[href="#work"]').isVisible(), true);
    assert.equal(await page.locator('[data-preview]').count(), 6);
    assert.equal(await page.locator('.project--environment [data-preview]').first().isVisible(), true);
    passed('no-JavaScript content, navigation, screenshots and direct image links remain available');
    await context.close();
  }
  await writeFile(join(output, 'browser-results.json'), JSON.stringify({ passed: checks, failed: [] }, null, 2));
  console.log(`\n${checks.length} check groups passed. Evidence: ${output}`);
} finally { await browser.close(); }
