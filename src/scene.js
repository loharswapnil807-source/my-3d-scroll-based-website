import * as THREE from 'three';
import { createSiliconWorld, createStudioEnvironment } from './silicon-world.js';
import { sampleJourney, sectionProgress } from './journey.js';

const SECTION_IDS = ['hero', 'about', 'work', 'research', 'contact'];
const damp = (current, target, speed, delta) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));

function readColors() {
  const style = getComputedStyle(document.documentElement);
  const color = (name) => style.getPropertyValue(name).trim();
  return { bg: color('--bg'), accent: color('--accent'), highlight: color('--highlight'), metal: color('--scene-metal') };
}

/** One render loop, one perspective camera, native document scrolling. */
export function initScene({ onReady, onFailure, motionEnabled = true } = {}) {
  const canvas = document.getElementById('scene');
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const isCompact = () => innerWidth < 769 || coarse.matches;
  let colors = readColors();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isCompact(), alpha: false, powerPreference: 'high-performance' });
  } catch {
    canvas.hidden = true;
    document.documentElement.classList.add('webgl-unavailable');
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.bg);
  scene.fog = new THREE.FogExp2(colors.bg, .018);
  let environment;
  let world;
  try {
    environment = createStudioEnvironment(renderer);
    scene.environment = environment.texture;
    world = createSiliconWorld({ colors, compact: isCompact() });
  } catch (error) {
    environment?.dispose();
    renderer.dispose();
    throw error;
  }
  scene.add(world.group);
  const camera = new THREE.PerspectiveCamera(44, 1, .1, 140);
  const ambient = new THREE.HemisphereLight('#eefaff', '#152028', 1.5);
  const key = new THREE.DirectionalLight('#edfaff', 3.5);
  key.position.set(-6, 10, 8);
  const rim = new THREE.DirectionalLight(colors.accent, 2.5);
  rim.position.set(6, -1, -8);
  scene.add(ambient, key, rim);

  const sections = SECTION_IDS.map(id => document.getElementById(id)).filter(Boolean);
  let anchors = [];
  let progress = 0;
  let targetProgress = 0;
  let time = 0;
  let lastTime = 0;
  let frame = 0;
  let frames = 0;
  let diagnosticsTime = -Infinity;
  let ready = false;
  let disposed = false;
  let failed = false;
  let pagePaused = false;
  let requested = Boolean(motionEnabled);
  let resizeTimer = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  const position = new Float32Array(6);
  const listeners = [];
  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    listeners.push(() => target.removeEventListener(name, callback, options));
  };
  const canAnimate = () => !disposed && !failed && !pagePaused && !document.hidden && requested && !reduced.matches;
  const canPoint = () => canAnimate() && fine.matches && !isCompact();
  const state = () => {
    canvas.dataset.state = disposed ? 'disposed' : failed ? 'unavailable' : reduced.matches ? 'static' : canAnimate() ? 'ready' : 'paused';
  };
  const diagnostics = (force = false) => {
    const now = performance.now();
    if (!force && now - diagnosticsTime < 350) return;
    diagnosticsTime = now;
    Object.assign(canvas.dataset, {
      sceneShape: 'silicon-journey', frames: String(frames),
      drawCalls: String(renderer.info.render.calls), triangles: String(renderer.info.render.triangles),
      dpr: renderer.getPixelRatio().toFixed(2), quality: isCompact() ? 'mobile' : 'standard',
      particles: String(world.particleCount), journey: progress.toFixed(3),
      camera: camera.position.toArray().map(value => value.toFixed(3)).join(','),
      hoverStrength: world.hoverStrength.toFixed(3),
    });
  };
  const apply = (delta = 0) => {
    sampleJourney(progress, isCompact(), position);
    camera.position.set(position[0] + pointerX * .32, position[1] - pointerY * .2, position[2]);
    camera.lookAt(position[3] + pointerX * .08, position[4] - pointerY * .06, position[5]);
    world.setProgress(progress);
    world.update(time, delta);
  };
  const render = () => {
    if (disposed || failed || document.hidden) return;
    renderer.render(scene, camera);
    frames += 1;
    diagnostics();
    state();
    if (!ready) { ready = true; onReady?.(controller); }
  };
  const cancel = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
  const schedule = () => {
    if (frame || !canAnimate()) return;
    frame = requestAnimationFrame(tick);
  };
  function tick(timestamp) {
    frame = 0;
    if (!canAnimate()) { state(); return; }
    const elapsed = Math.min(.25, Math.max(0, (timestamp - lastTime) / 1000));
    const delta = Math.min(.05, elapsed);
    lastTime = timestamp;
    time += delta;
    progress = damp(progress, targetProgress, 7, elapsed);
    pointerX = damp(pointerX, targetPointerX, 4, elapsed);
    pointerY = damp(pointerY, targetPointerY, 4, elapsed);
    apply(delta);
    render();
    schedule();
  }
  const clearPointer = () => {
    targetPointerX = targetPointerY = 0;
    world.resetInteraction();
  };
  const measure = () => {
    anchors = sections.map(section => section.getBoundingClientRect().top + scrollY);
    targetProgress = sectionProgress(scrollY, anchors);
  };
  const staticFrame = () => {
    cancel();
    clearPointer();
    pointerX = pointerY = 0;
    // Reduced motion is a static, composed hero view, including at deep links.
    if (reduced.matches) progress = 0;
    apply();
    render();
    diagnostics(true);
  };
  const resize = () => {
    if (disposed || failed) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isCompact() ? 1.5 : 2));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / Math.max(1, innerHeight);
    camera.fov = isCompact() ? 48 : 44;
    camera.updateProjectionMatrix();
    world.resize(innerWidth, innerHeight, renderer.getPixelRatio(), isCompact());
    measure();
    apply();
    if (ready) render();
    diagnostics(true);
  };
  const onScroll = () => {
    if (disposed || failed) return;
    targetProgress = sectionProgress(scrollY, anchors);
    document.body.classList.toggle('scene-past-hero', scrollY > innerHeight * .7);
    if (canAnimate()) schedule();
  };
  const resume = () => {
    if (disposed || failed) return;
    lastTime = performance.now();
    if (canAnimate()) schedule();
    else staticFrame();
    state();
  };
  const onNavigation = () => { measure(); onScroll(); resume(); };
  const onTheme = () => {
    if (disposed || failed) return;
    colors = readColors();
    world.setTheme(colors);
    scene.background.set(colors.bg);
    scene.fog.color.set(colors.bg);
    rim.color.set(colors.accent);
    canvas.dataset.theme = document.documentElement.dataset.theme || 'teal';
    render();
  };
  const controller = {
    setMotion(enabled) {
      if (disposed || failed) return;
      requested = Boolean(enabled);
      clearPointer();
      if (!requested) { cancel(); state(); }
      else { measure(); resume(); }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      clearTimeout(resizeTimer);
      listeners.forEach(remove => remove());
      observer?.disconnect();
      world.dispose();
      environment.dispose();
      scene.environment = null;
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.hidden = true;
      state();
    },
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!disposed) measure(); }) : null;
  sections.forEach(section => observer?.observe(section));
  listen(window, 'scroll', onScroll, { passive: true });
  listen(window, 'resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 100); }, { passive: true });
  listen(window, 'hashchange', onNavigation);
  listen(window, 'popstate', onNavigation);
  listen(window, 'portfolio:themechange', onTheme);
  listen(window, 'pointermove', (event) => {
    if (!canPoint() || event.pointerType !== 'mouse') return;
    targetPointerX = THREE.MathUtils.clamp(event.clientX / innerWidth * 2 - 1, -1, 1);
    targetPointerY = THREE.MathUtils.clamp(event.clientY / innerHeight * 2 - 1, -1, 1);
    world.setHover(event.target instanceof Element && Boolean(event.target.closest('[data-project], .selected-work-card')));
  }, { passive: true });
  listen(document.documentElement, 'pointerleave', clearPointer);
  listen(window, 'blur', clearPointer);
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { cancel(); clearPointer(); state(); }
    else resume();
  });
  listen(window, 'pagehide', (event) => {
    if (!event.persisted) { controller.dispose(); return; }
    pagePaused = true;
    cancel(); clearPointer(); state();
  });
  listen(window, 'pageshow', (event) => {
    if (!event.persisted) return;
    pagePaused = false;
    measure(); resume();
  });
  listen(canvas, 'webglcontextlost', (event) => {
    event.preventDefault();
    failed = true;
    cancel(); clearPointer();
    canvas.hidden = true;
    document.documentElement.classList.add('webgl-unavailable');
    state(); onFailure?.();
  });
  listen(reduced, 'change', () => { clearPointer(); measure(); resume(); });
  listen(coarse, 'change', () => { clearPointer(); resize(); });
  listen(fine, 'change', clearPointer);
  document.fonts?.ready.then(() => { if (!disposed) measure(); });
  canvas.hidden = false;
  canvas.dataset.theme = document.documentElement.dataset.theme || 'teal';
  document.documentElement.classList.remove('webgl-unavailable');
  resize();
  progress = reduced.matches ? 0 : targetProgress;
  apply(); render();
  lastTime = performance.now();
  schedule();
  return controller;
}
