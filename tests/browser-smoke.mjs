// Optional browser smoke check: uses an existing Playwright installation.
// See tests/README.md. No browser/testing code ships with the portfolio.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'portfolio-qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
});
const checks = [];
const passed = (name) => { checks.push(name); console.log(`PASS ${name}`); };
const wait = (page, ms = 400) => page.waitForTimeout(ms);
const scrollTo = (page, selector, offset = 100) => page.evaluate(({ selector, offset }) => {
  const element = document.querySelector(selector);
  window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - offset, behavior: 'instant' });
}, { selector, offset });
const layout = (page) => page.evaluate(() => ({
  width: innerWidth, content: document.documentElement.scrollWidth,
  headerTop: document.querySelector('.site-header').getBoundingClientRect().top,
  blur: getComputedStyle(document.querySelector('.site-header')).backdropFilter,
}));
async function openContext(options = {}, init) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', ...options });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('js-ready'));
  return { context, page, errors };
}
const disableWebGL = () => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    return String(type).includes('webgl') ? null : getContext.call(this, type, ...args);
  };
};

try {
  // Real shader compilation, live rendering, reversible scroll, themes and lifecycle.
  {
    const { context, page, errors } = await openContext();
    await page.waitForFunction(() => document.querySelector('#scene').dataset.state === 'ready', null, { timeout: 30000 });
    await page.waitForFunction(() => Number(document.querySelector('#scene').dataset.frames) > 2, null, { timeout: 30000 });
    assert.equal(await page.locator('#scene').getAttribute('data-scene-shape'), 'ember-chrysalis');
    assert.equal(await page.locator('#scene').getAttribute('data-scatter-count'), '0');
    assert.equal(await page.locator('#scene').getAttribute('data-vortex-strands'), '1');
    assert.equal(await page.locator('#scene').getAttribute('data-vortex-cilia'), '220');
    assert.equal(await page.locator('#scene').getAttribute('data-vortex-draw-calls'), '3');
    await page.screenshot({ path: join(output, 'desktop-ember-hero.png') });
    assert.equal(await page.locator('#scene').getAttribute('data-draw-calls'), '3');
    assert.deepEqual(errors, []);
    passed('live Ember Chrysalis renders as one membrane, one cilia system, and one heart without shader errors');
    await page.waitForFunction(() => Number(document.querySelector('#scene').dataset.vortexShape) < 0.06, null, { timeout: 30000 });
    await scrollTo(page, '#about', 0);
    await page.waitForFunction(() => { const shape = Number(document.querySelector('#scene').dataset.vortexShape); return shape > 0.3 && shape < 0.7; }, null, { timeout: 30000 });
    await scrollTo(page, '#work', 0);
    await page.waitForFunction(() => { const shape = Number(document.querySelector('#scene').dataset.vortexShape); return shape > 0.9 && shape < 1.1; }, null, { timeout: 30000 });
    for (const project of ['sweets', 'terminal', 'bunk', 'environment', 'stickman']) {
      await scrollTo(page, `#project-${project}-title`);
      await page.waitForFunction(() => { const shape = Number(document.querySelector('#scene').dataset.vortexShape); return shape >= 0.98 && shape < 1.3; }, null, { timeout: 30000 });
    }
    assert.equal(await page.locator('#scene').getAttribute('data-draw-calls'), '2');
    await page.locator('.project--stickman .project-copy').hover();
    await page.waitForFunction(() => Number(document.querySelector('#scene').dataset.hoverStrength) > 0.5, null, { timeout: 15000 });
    await page.mouse.move(10, 100);
    await page.waitForFunction(() => Number(document.querySelector('#scene').dataset.hoverStrength) < 0.01, null, { timeout: 15000 });
    passed('one ribbon persists through all five projects; hovering the nearest card segment pulses and settles');
    await scrollTo(page, '#research', 0);
    await page.waitForFunction(() => { const shape = Number(document.querySelector('#scene').dataset.vortexShape); return shape > 1.9 && shape < 2.1; }, null, { timeout: 30000 });
    await page.screenshot({ path: join(output, 'research-lanes.png') });
    await scrollTo(page, '#contact', 0);
    await page.waitForFunction(() => Number(document.querySelector('#scene').dataset.vortexShape) > 2.9, null, { timeout: 30000 });
    await scrollTo(page, '#research', 0);
    await page.waitForFunction(() => { const shape = Number(document.querySelector('#scene').dataset.vortexShape); return shape > 1.9 && shape < 2.1; }, null, { timeout: 30000 });
    passed('scroll morphs hero orb → work weave → research lanes → thin contact tail and reverses');
    await scrollTo(page, '#hero', 64);
    await page.waitForFunction(() => Number(document.querySelector('#scene').dataset.vortexShape) < 0.01, null, { timeout: 30000 });
    for (let i = 0; i < 45; i += 1) {
      await page.mouse.move(1000 + Math.sin(i * 0.5) * 80, 480 + Math.cos(i * 0.5) * 60);
      await wait(page, 35);
    }
    assert.ok(Number(await page.locator('#scene').getAttribute('data-pointer-strength')) > 0.02);
    await page.waitForFunction(() => Number(document.querySelector('#scene').dataset.pointerStrength) < 0.005, null, { timeout: 20000 });
    passed('desktop pointer reaches local membrane deformation and settles after movement');
    await page.locator('#motion-toggle').click();
    const paused = await page.locator('#scene').getAttribute('data-frames');
    await wait(page, 1200);
    assert.equal(await page.locator('#scene').getAttribute('data-state'), 'paused');
    assert.equal(await page.locator('#scene').getAttribute('data-frames'), paused);
    await scrollTo(page, '#hero', 64);
    for (const theme of ['violet', 'warm', 'teal']) {
      await page.locator('#theme-toggle').click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.equal(await page.locator('#scene').getAttribute('data-theme'), theme);
      const palette = { teal: 'rgb(45, 212, 191)', violet: 'rgb(167, 139, 250)', warm: 'rgb(157, 67, 43)' };
      await page.waitForFunction((color) => getComputedStyle(document.querySelector('.hero h1 em')).color === color, palette[theme]);
      await wait(page, 300);
      await page.screenshot({ path: join(output, `theme-${theme}.png`) });
    }
    await page.locator('#theme-toggle').click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#scene').dataset.state === 'ready', null, { timeout: 30000 });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'violet');
    passed('manual pause freezes frames; teal → violet → warm light cycle and persistence remain intact');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('#motion-toggle').disabled, null, { timeout: 10000 });
    assert.equal(await page.locator('#motion-toggle').isDisabled(), true);
    assert.equal(await page.locator('#motion-toggle').textContent(), 'Motion disabled');
    assert.equal(await page.locator('.cursor-glow').evaluate((el) => getComputedStyle(el).display), 'none');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForFunction(() => document.querySelector('#scene').dataset.vortexCilia === '110', null, { timeout: 10000 });
    assert.equal(await page.locator('#scene').getAttribute('data-vortex-strands'), '1');
    assert.equal(await page.locator('#scene').getAttribute('data-vortex-cilia'), '110');
    assert.equal(await page.locator('#scene').getAttribute('data-scatter-count'), '0');
    assert.equal(await page.locator('#scene').getAttribute('data-pointer-strength'), '0.0000');
    await page.screenshot({ path: join(output, 'mobile-reduced.png') });
    passed('runtime reduced motion stops effects; paused resize reframes and selects mobile detail');
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.querySelector('#scene').dataset.state === 'ready');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    assert.equal(await page.locator('#scene').getAttribute('data-state'), 'paused');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await page.waitForFunction(() => document.querySelector('#scene').dataset.state === 'ready');
    passed('simulated BFCache pagehide/pageshow pauses and resumes the scene');
    await page.evaluate(() => document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-unavailable'));
    assert.equal(await page.locator('#scene').isHidden(), true);
    assert.equal(await page.locator('#loader').isHidden(), true);
    assert.equal(await page.locator('#motion-toggle').isHidden(), true);
    assert.deepEqual(errors, []);
    passed('actual WebGL context loss hides canvas/loader and leaves the page usable');
    await context.close();
  }

  // Keep UI stress tests independent of GPU speed; real WebGL was tested above.
  {
    const { context, page, errors } = await openContext({}, disableWebGL);
    await page.waitForFunction(() => document.documentElement.classList.contains('webgl-unavailable'));
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 1000 });
      for (const selector of ['#hero', '.project--bunk[data-project]', '.project--environment[data-project]', '#contact', '.site-footer']) {
        await scrollTo(page, selector);
        await wait(page, 1100);
        const metrics = await layout(page);
        assert.ok(metrics.content <= metrics.width, `${width}px overflow at ${selector}: ${metrics.content}`);
        assert.ok(Math.abs(metrics.headerTop) < 1, `header scrolled offscreen at ${width}px`);
        assert.notEqual(metrics.blur, 'none');
      }
      passed(`${width}px: no horizontal overflow; blurred navigation stays pinned through footer`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { history.scrollRestoration = 'manual'; window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.reload({ waitUntil: 'networkidle' });
    await scrollTo(page, '.project--bunk[data-project]');
    await page.waitForFunction(() => document.querySelector('.project--bunk .screenshot-panel').getAnimations().length > 0);
    const arrival = await page.locator('.project--bunk .screenshot-panel').first().evaluate((element) => {
      const animation = element.getAnimations()[0];
      animation.pause(); animation.currentTime = 0;
      const style = getComputedStyle(element);
      const start = { scale: style.scale, translate: style.translate };
      animation.finish();
      return start;
    });
    assert.equal(Number(arrival.scale), 0.28);
    assert.notEqual(arrival.translate, '0px');
    await wait(page, 1000);
    const corners = await page.locator('.project--bunk .screenshot-panel').evaluateAll((elements) => elements.map((e) => e.dataset.arrivalCorner));
    assert.notEqual(corners[0], corners[1]);
    passed('independent image entrances start small, come from different corners, and settle at full size');
    for (const project of ['bunk', 'environment']) {
      const panels = page.locator(`.project--${project} .screenshot-panel`);
      assert.equal(await panels.count(), 2);
      const accents = await panels.evaluateAll((elements) => elements.map((e) => getComputedStyle(e).getPropertyValue('--panel-accent').trim()));
      assert.notEqual(accents[0], accents[1]);
      await scrollTo(page, `.project--${project}[data-project]`);
      await wait(page, 1200);
      await page.screenshot({ path: join(output, `${project}-gallery.png`) });
    }
    for (const link of await page.locator('[data-preview]').all()) {
      await link.scrollIntoViewIfNeeded();
      await wait(page, 1000);
      await link.click();
      await page.waitForFunction(() => { const img = document.querySelector('.image-preview-image'); return img.complete && img.naturalWidth > 0; });
      assert.equal(await page.locator('#image-preview').evaluate((el) => el.open), true);
      assert.ok((await page.locator('#preview-caption').textContent()).length > 10);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#image-preview').evaluate((el) => el.open), false);
      assert.equal(await link.evaluate((el) => el === document.activeElement), true);
    }
    passed('all six image previews load, close with Escape, and restore keyboard focus');
    await scrollTo(page, '.project--bunk[data-project]');
    const panel = page.locator('.project--bunk .screenshot-panel').first();
    await panel.hover(); await wait(page);
    assert.notEqual(await panel.evaluate((el) => getComputedStyle(el).boxShadow), 'none');
    assert.notEqual(await panel.evaluate((el) => getComputedStyle(el).transform), 'none');
    assert.ok((await panel.getAttribute('style')).includes('--pointer-x'));
    assert.equal(await page.locator('.cursor-glow').evaluate((el) => el.classList.contains('is-visible')), true);
    assert.equal(await page.locator('.cursor-trail.is-visible').count(), 3);
    await scrollTo(page, '.contact-links');
    await page.locator('a.contact-row').first().hover(); await wait(page);
    assert.notEqual(await page.locator('a.contact-row').first().evaluate((el) => getComputedStyle(el).boxShadow), 'none');
    await page.screenshot({ path: join(output, 'contact-hover.png') });
    passed('image tilt/glow, contact link glow, pointer-following light and three trail dots respond');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('#menu-toggle').click();
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
    await page.locator('#nav-links a[href="#work"]').click();
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#work').evaluate((el) => el === document.activeElement), true);
    await page.locator('#menu-toggle').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#nav-links').evaluate((el) => el.inert), true);
    passed('mobile menu opens, navigates with focus, closes with Escape, and hides links from tab order');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await scrollTo(page, '.project--environment[data-project]');
    assert.equal(await page.locator('.cursor-glow').evaluate((el) => getComputedStyle(el).display), 'none');
    assert.equal(await page.locator('.project--environment .screenshot-panel').first().evaluate((el) => el.getAnimations().length), 0);
    passed('reduced motion cancels image entrances and cursor effects without hiding images');
    for (let index = 0; index < 20; index += 1) {
      await page.setViewportSize({ width: [320, 768, 1440, 375][index % 4], height: 812 });
      await page.evaluate((index) => scrollTo({ top: index % 2 ? document.body.scrollHeight : 0, behavior: 'instant' }), index);
    }
    assert.ok((await layout(page)).content <= (await layout(page)).width);
    const urls = await page.locator('a[href], img[src]').evaluateAll((elements) => [...new Set(elements
      .map((el) => el instanceof HTMLImageElement ? el.src : el.href)
      .filter((url) => url.startsWith(location.origin) && !url.includes('#')))]);
    for (const url of urls) assert.equal((await page.request.get(url)).ok(), true, `missing deployed asset/link: ${url}`);
    assert.equal((await page.request.get(`${baseURL}/resume.html`)).ok(), true);
    // Renderer initialization error is expected in this intentionally no-WebGL context.
    assert.deepEqual(errors.filter((error) => !error.includes('Error creating WebGL context')), []);
    passed('20 rapid resizes/scroll reversals remain usable; all local images, documents and resume links resolve');
    await page.locator('#theme-toggle').click(); // violet
    await page.locator('#theme-toggle').click(); // warm
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'warm');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.contact-scene')).backgroundColor === 'rgba(0, 0, 0, 0)');
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 1000 });
      await scrollTo(page, '#contact');
      const metrics = await layout(page);
      assert.ok(metrics.content <= width, `warm contact overflow at ${width}px`);
      const panel = await page.locator('.contact-scene').evaluate((el) => ({ border: getComputedStyle(el).borderTopWidth, background: getComputedStyle(el).backgroundColor, padding: getComputedStyle(el).paddingTop }));
      assert.equal(panel.border, '0px');
      assert.equal(panel.background, 'rgba(0, 0, 0, 0)');
      assert.ok(parseFloat(panel.padding) <= 32);
      await page.screenshot({ path: join(output, `warm-contact-${width}.png`) });
    }
    passed('warm contact is unboxed, slimmer, and overflow-free at 320/375/768/1440px');
    await context.close();
  }
  {
    const { context, page, errors } = await openContext({ isMobile: true, hasTouch: true, viewport: { width: 375, height: 812 } }, () => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) { return String(type).includes('webgl') ? null : getContext.call(this, type, ...args); };
      Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
      Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
    });
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'violet');
    assert.equal(await page.locator('.cursor-glow').evaluate((el) => getComputedStyle(el).display), 'none');
    await scrollTo(page, '.project--environment[data-project]');
    await page.locator('.project--environment [data-preview]').first().tap();
    assert.equal(await page.locator('#image-preview').evaluate((el) => el.open), true);
    await page.locator('.preview-close').tap();
    assert.deepEqual(errors.filter((error) => !error.includes('Error creating WebGL context')), []);
    passed('touch previews work without cursor effects; blocked storage does not break theme switching');
    await context.close();
  }
  {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 812 } });
    const page = await context.newPage();
    await page.goto(baseURL);
    assert.equal(await page.locator('#nav-links a[href="#work"]').isVisible(), true);
    assert.equal(await page.locator('.project--environment img').count(), 2);
    assert.equal(await page.locator('.project--environment [data-preview]').first().isVisible(), true);
    passed('no-JavaScript page keeps navigation, screenshots and direct full-image links');
    await context.close();
  }
  await writeFile(join(output, 'browser-results.json'), JSON.stringify({ passed: checks, failed: [] }, null, 2));
  console.log(`\n${checks.length} browser check groups passed. Evidence: ${output}`);
} finally {
  await browser.close();
}
