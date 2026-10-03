import * as THREE from 'three';
import { createFluidVortex } from './fluid-vortex.js';

const MOBILE_QUERY = '(pointer: coarse)';
const DESKTOP_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SECTION_IDS = ['hero', 'about', 'work', 'research', 'contact'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const damp = (current, target, lambda, delta) => {
  const amount = 1 - Math.exp(-lambda * Math.min(delta, 0.1));
  return lerp(current, target, amount);
};

const keyframes = [
  { x: 3.0, y: 0.12, z: 13.5, scale: 1.0, rx: 0.025, ry: 0, rz: -0.035, expansion: 1, progress: 0 },
  { x: 3.15, y: 0.18, z: 13.8, scale: 0.94, rx: -0.025, ry: 0.4, rz: 0.015, expansion: 0, progress: 0.48 },
  { x: 2.7, y: 0.08, z: 14.0, scale: 0.96, rx: 0.035, ry: 0.82, rz: -0.04, expansion: 0.96, progress: 1 },
  { x: 3.3, y: 0.16, z: 14.0, scale: 0.95, rx: -0.025, ry: 1.5, rz: 0.02, expansion: 0, progress: 2 },
  { x: 2.4, y: 0.1, z: 15.2, scale: 0.8, rx: 0.02, ry: 2.15, rz: -0.025, expansion: 0.78, progress: 3 },
];

function mediaQuery(query) {
  if (typeof window.matchMedia === 'function') return window.matchMedia(query);
  return {
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  };
}

function listenToMediaQuery(query, listener) {
  if (query.addEventListener) {
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }

  query.addListener?.(listener);
  return () => query.removeListener?.(listener);
}

function markUnavailable(canvas) {
  canvas.hidden = true;
  canvas.dataset.state = 'unavailable';
  document.documentElement.classList.add('webgl-unavailable');
}

function sectionElements() {
  const known = SECTION_IDS
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (known.length > 1) return known;
  return [...document.querySelectorAll('[data-scene-section], main > section, section')];
}

function measureAnchors(sections) {
  return sections.map((section) => section.getBoundingClientRect().top + window.scrollY);
}

function getThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    bg: styles.getPropertyValue('--bg').trim(),
    surface: styles.getPropertyValue('--surface').trim(),
    accent: styles.getPropertyValue('--accent').trim(),
    highlight: styles.getPropertyValue('--highlight').trim(),
  };
}

function setCanvasLayout(canvas, compact) {
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    display: 'block',
    zIndex: '0',
    pointerEvents: 'none',
    // Opacity belongs to CSS so reduced-motion and theme rules can override it.
  });
}

function disposeMaterial(material, disposedTextures) {
  Object.keys(material).forEach((property) => {
    const value = material[property];
    if (!value?.isTexture || disposedTextures.has(value)) return;
    disposedTextures.add(value);
    value.dispose();
  });
  material.dispose();
}

function copyState(target, source) {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
  target.scale = source.scale;
  target.rx = source.rx;
  target.ry = source.ry;
  target.rz = source.rz;
  target.expansion = source.expansion;
  target.progress = source.progress;
}

function sampleKeyframes(progress, output) {
  const scaled = clamp(progress, 0, 1) * (keyframes.length - 1);
  const index = Math.min(keyframes.length - 2, Math.floor(scaled));
  const blend = scaled - index;
  const from = keyframes[index];
  const to = keyframes[index + 1];

  output.x = lerp(from.x, to.x, blend);
  output.y = lerp(from.y, to.y, blend);
  output.z = lerp(from.z, to.z, blend);
  output.scale = lerp(from.scale, to.scale, blend);
  output.rx = lerp(from.rx, to.rx, blend);
  output.ry = lerp(from.ry, to.ry, blend);
  output.rz = lerp(from.rz, to.rz, blend);
  output.expansion = lerp(from.expansion, to.expansion, blend);
  output.progress = lerp(from.progress, to.progress, blend);
}

function sampleAtSectionAnchors(anchors, output) {
  if (anchors.length < 2) {
    copyState(output, keyframes[0]);
    return;
  }

  // Existing section-top anchors and interpolation stay unchanged. Shape
  // progress adds choreography without introducing new scroll triggers.
  const focus = window.scrollY;
  if (focus <= anchors[0]) {
    copyState(output, keyframes[0]);
    return;
  }
  if (focus >= anchors[anchors.length - 1]) {
    copyState(output, keyframes[keyframes.length - 1]);
    return;
  }

  let segment = 0;
  while (segment < anchors.length - 2 && focus > anchors[segment + 1]) segment += 1;
  const span = Math.max(1, anchors[segment + 1] - anchors[segment]);
  const localProgress = clamp((focus - anchors[segment]) / span, 0, 1);
  const sectionProgress = (segment + localProgress) / (anchors.length - 1);
  sampleKeyframes(sectionProgress, output);
}

function currentQuality(compact) {
  const dpr = window.devicePixelRatio || 1;
  if (compact || window.innerWidth < 720) return 'mobile';
  if (dpr > 1.7) return 'balanced';
  return 'standard';
}

/**
 * Create the atmospheric Three.js layer. The host owns invocation and can
 * pause or dispose the returned controller without this module self-starting.
 */
export function initScene({ onReady, onFailure, motionEnabled = true } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const canvas = document.getElementById('scene');
  if (!(canvas instanceof HTMLCanvasElement)) return null;

  const reducedMotionQuery = mediaQuery(REDUCED_MOTION_QUERY);
  const coarseQuery = mediaQuery(MOBILE_QUERY);
  const desktopPointerQuery = mediaQuery(DESKTOP_POINTER_QUERY);
  const compact = coarseQuery.matches || window.innerWidth < 720;
  setCanvasLayout(canvas, compact);
  canvas.hidden = false;
  canvas.dataset.state = 'paused';
  document.documentElement.classList.remove('webgl-unavailable');

  let renderer;
  const themeColors = getThemeColors();
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !compact,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });
  } catch (error) {
    markUnavailable(canvas);
    return null;
  }

  renderer.setClearColor(themeColors.bg, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const resources = {
    geometries: new Set(),
    materials: new Set(),
  };
  const trackGeometry = (geometry) => {
    resources.geometries.add(geometry);
    return geometry;
  };
  const trackMaterial = (material) => {
    resources.materials.add(material);
    return material;
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(themeColors.bg, 0.025);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0.06, 0, keyframes[0].z);

  const world = new THREE.Group();
  const heroObject = new THREE.Group();
  world.add(heroObject);
  scene.add(world);

  const vortex = createFluidVortex({
    trackGeometry,
    trackMaterial,
    colors: themeColors,
    compact,
  });
  heroObject.add(vortex.group);

  // No orbiting markers, stars, or cursor-particle cloud: only the organism.
  let scrollEnergy = 0;
  const resetInteraction = () => {
    scrollEnergy = 0;
    vortex.resetInteraction();
  };

  const hemisphereLight = new THREE.HemisphereLight(themeColors.accent, themeColors.bg, 1.4);
  scene.add(hemisphereLight);
  const cyanLight = new THREE.PointLight(themeColors.accent, 13, 24, 2);
  cyanLight.position.set(4.5, 4.5, 6);
  scene.add(cyanLight);
  const indigoLight = new THREE.PointLight(themeColors.highlight, 9, 25, 2);
  indigoLight.position.set(-5, -2.5, 3);
  scene.add(indigoLight);

  const sections = sectionElements();
  let anchors = measureAnchors(sections);
  const targetState = { ...keyframes[0] };
  const state = { ...keyframes[0] };
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerPresent = false;
  let pointerClientX = 0;
  let pointerClientY = 0;
  let workTravel = 0;
  let animationFrame = 0;
  let lastTime = performance.now();
  let motionTime = 0;
  let lastScrollY = window.scrollY;
  let lastDiagnostics = -Infinity;
  let renderedFrames = 0;
  let active = !document.hidden;
  let canvasVisible = true;
  let bfcachePaused = false;
  let disposed = false;
  let contextLost = false;
  let failureNotified = false;
  let readyNotified = false;
  let motionRequested = Boolean(motionEnabled);
  let pointerListening = false;
  const pointerNdc = new THREE.Vector2();
  // Project the desktop pointer onto the organism's local plane. No triangle
  // raycasts (including on touch), and no per-event geometry allocations.
  const raycaster = new THREE.Raycaster();
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const worldHit = new THREE.Vector3();
  const mediaCleanup = [];

  const isReduced = () => reducedMotionQuery.matches;
  const canAnimate = () => (
    !disposed
    && !contextLost
    && active
    && canvasVisible
    && !canvas.hidden
    && !bfcachePaused
    && !document.hidden
    && motionRequested
    && !isReduced()
  );

  const updateStateAttribute = () => {
    if (disposed) return;
    if (contextLost) {
      canvas.dataset.state = 'lost';
    } else if (!active || !canvasVisible || bfcachePaused || !motionRequested || document.hidden) {
      canvas.dataset.state = 'paused';
    } else if (isReduced()) {
      canvas.dataset.state = 'static';
    } else if (readyNotified) {
      canvas.dataset.state = 'ready';
    }
  };

  const updateDiagnostics = (force = false) => {
    const now = performance.now();
    if (!force && now - lastDiagnostics < 1000) return;
    lastDiagnostics = now;
    canvas.dataset.drawCalls = String(renderer.info.render.calls || 0);
    canvas.dataset.triangles = String(renderer.info.render.triangles || 0);
    canvas.dataset.dpr = Number(renderer.getPixelRatio()).toFixed(2);
    canvas.dataset.frames = String(renderedFrames);
    canvas.dataset.quality = currentQuality(coarseQuery.matches || window.innerWidth < 720);
    canvas.dataset.particles = '0';
    canvas.dataset.pointerStrength = vortex.pointerStrength.toFixed(4);
    canvas.dataset.hoverStrength = vortex.hoverStrength.toFixed(3);
    canvas.dataset.emberEnergy = vortex.energy.toFixed(3);
    canvas.dataset.vortexExpansion = vortex.expansion.toFixed(3);
    canvas.dataset.vortexStrands = String(vortex.strandCount);
    canvas.dataset.scatterCount = String(vortex.scatterCount);
    canvas.dataset.vortexCilia = String(vortex.ciliaCount);
    canvas.dataset.vortexShape = vortex.shape.toFixed(3);
    canvas.dataset.vortexDrawCalls = String(vortex.drawCalls);
    canvas.dataset.sceneShape = 'ember-chrysalis';
  };

  const notifyReady = () => {
    if (readyNotified) return;
    readyNotified = true;
    updateStateAttribute();
    onReady?.(controller);
  };

  const render = () => {
    if (disposed || contextLost || document.hidden || !canvasVisible) return;
    renderer.render(scene, camera);
    renderedFrames += 1;
    updateDiagnostics();
    notifyReady();
  };

  const updateTargetFromScroll = () => {
    if (isReduced() || !motionRequested) return;
    sampleAtSectionAnchors(anchors, targetState);
  };

  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const narrow = width < 720;
    const maxDpr = narrow || coarseQuery.matches ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(width, height, false);
    vortex.resize(width, height, renderer.getPixelRatio(), narrow || coarseQuery.matches);
    camera.aspect = width / height;
    camera.fov = narrow ? 47 : 42;
    camera.updateProjectionMatrix();
    anchors = measureAnchors(sections);
    if (!isReduced() || !readyNotified) updateTargetFromScroll();
    updateDiagnostics(true);
    if (readyNotified && (isReduced() || !motionRequested)) {
      // Reframe a paused/static scene after orientation or viewport changes,
      // without advancing its clock or starting an animation loop.
      applyVisuals(motionTime, isReduced() ? 0 : 1, 0);
      render();
    }
  };

  const applyVisuals = (time, motion, delta) => {
    const mobileFrame = coarseQuery.matches || window.innerWidth < 960;
    // Keep a glimpse of the upright silhouette at the right edge on mobile,
    // using the camera's visible width rather than pushing it entirely offscreen.
    const viewWidth = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * state.z * camera.aspect;
    const uncoil = THREE.MathUtils.smoothstep(state.progress, 0, 1);
    const depart = THREE.MathUtils.smoothstep(state.progress, 2, 3);
    const centerX = lerp(lerp(state.x, 0.3, uncoil), viewWidth * 0.38, depart);
    world.position.set(
      mobileFrame ? viewWidth * 0.31 : centerX,
      mobileFrame ? 0.45 + state.y * 0.5 : state.y,
      0,
    );
    world.scale.setScalar(state.scale * (mobileFrame ? 0.46 : 0.82));
    // The coil rotates in the shared shader; technical lanes stay face-on.
    heroObject.rotation.set(state.rx * (1 - uncoil), 0, state.rz * (1 - uncoil));
    // Hold the ribbon state through all five projects, then resolve into the
    // research lanes near that section. Existing anchors aren't moved.
    const shape = state.progress < 1 ? state.progress
      : state.progress < 2 ? 1 + THREE.MathUtils.smoothstep(state.progress, 1.86, 2)
      : 2 + THREE.MathUtils.smoothstep(state.progress, 2.72, 3);
    vortex.setProgress(shape, workTravel);
    if (shape > 2.7) { vortex.setPointer(0, 0, false); vortex.setHover(-1); }
    vortex.update(time * 0.001, state.expansion, scrollEnergy * motion);

    // The target includes all offsets before damping; adding them after damp
    // would feed an offset back into the next frame and cause camera drift.
    const cameraTargetX = state.x * 0.02 + pointerX * 0.32;
    const cameraTargetY = state.y * 0.02 - pointerY * 0.24;
    camera.position.x = motion ? damp(camera.position.x, cameraTargetX, 3.6, delta) : cameraTargetX;
    camera.position.y = motion ? damp(camera.position.y, cameraTargetY, 3.6, delta) : cameraTargetY;
    camera.position.z = motion ? damp(camera.position.z, state.z, 3.6, delta) : state.z;
    camera.lookAt(world.position.x * 0.12, world.position.y * 0.1, 0);
  };

  const cancelFrame = () => {
    if (!animationFrame) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };

  const scheduleFrame = () => {
    if (animationFrame || !canAnimate()) return;
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(onFrame);
  };

  const onFrame = (time) => {
    animationFrame = 0;
    if (!canAnimate()) {
      updateStateAttribute();
      return;
    }

    const delta = Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    motionTime += delta * 1000;
    scrollEnergy *= Math.exp(-3.4 * delta);
    state.x = damp(state.x, targetState.x, 4.6, delta);
    state.y = damp(state.y, targetState.y, 4.6, delta);
    state.z = damp(state.z, targetState.z, 4.6, delta);
    state.scale = damp(state.scale, targetState.scale, 4.6, delta);
    state.rx = damp(state.rx, targetState.rx, 4.6, delta);
    state.ry = damp(state.ry, targetState.ry, 4.6, delta);
    state.rz = damp(state.rz, targetState.rz, 4.6, delta);
    state.expansion = damp(state.expansion, targetState.expansion, 5.2, delta);
    state.progress = damp(state.progress, targetState.progress, 5.2, delta);
    pointerX = damp(pointerX, pointerTargetX, 5.5, delta);
    pointerY = damp(pointerY, pointerTargetY, 5.5, delta);
    applyVisuals(motionTime, 1, delta);
    render();
    scheduleFrame();
  };

  const renderStaticFrame = () => {
    if (disposed || contextLost || document.hidden) return;
    cancelFrame();
    copyState(state, targetState);
    pointerX = 0;
    pointerY = 0;
    pointerTargetX = 0;
    pointerTargetY = 0;
    resetInteraction();
    applyVisuals(0, 0, 0);
    render();
    updateStateAttribute();
  };

  const clearHover = () => vortex.setHover(-1);
  const updateProjectHover = (element) => {
    const project = element instanceof Element ? element.closest('[data-project], .selected-work-card') : null;
    if (!project) { clearHover(); return; }
    // Pulse the nearest visible part, not a fixed index unrelated to the card.
    const rect = project.getBoundingClientRect();
    const screenY = clamp((rect.top + rect.height * 0.5) / window.innerHeight, 0.05, 0.95);
    vortex.setHover(screenY);
  };

  const updatePointer = (event) => {
    if (!pointerListening || event.pointerType !== 'mouse' || !canAnimate()) return;
    pointerTargetX = clamp((event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2, -1, 1);
    pointerTargetY = clamp((event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2, -1, 1);
    pointerPresent = true;
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
    pointerNdc.set(pointerTargetX, -pointerTargetY);
    camera.updateMatrixWorld();
    vortex.group.updateWorldMatrix(true, false);
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(pointerPlane, worldHit)) {
      vortex.group.worldToLocal(worldHit);
      vortex.setPointer(worldHit.x, worldHit.y, true);
    }
    updateProjectHover(event.target);
  };

  const onPointerLeave = () => {
    clearHover();
    pointerTargetX = 0;
    pointerTargetY = 0;
    pointerPresent = false;
    vortex.setPointer(0, 0, false);
  };

  const syncPointerListener = () => {
    const shouldListen = (
      motionRequested
      && !isReduced()
      && desktopPointerQuery.matches
      && !coarseQuery.matches
      && !disposed
    );
    if (shouldListen === pointerListening) return;
    pointerListening = shouldListen;
    if (shouldListen) {
      window.addEventListener('pointermove', updatePointer, { passive: true });
      document.documentElement.addEventListener('pointerleave', onPointerLeave, { passive: true });
      window.addEventListener('blur', onPointerLeave);
    } else {
      window.removeEventListener('pointermove', updatePointer);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
      onPointerLeave();
      resetInteraction();
    }
  };

  const onScroll = () => {
    const scrollDelta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    document.body.classList.toggle('scene-past-hero', window.scrollY > window.innerHeight * 0.72);
    if (!isReduced() && motionRequested) updateTargetFromScroll();
    if (canAnimate()) {
      const velocity = clamp(scrollDelta / Math.max(1, window.innerHeight) * 8, -1, 1);
      scrollEnergy = Math.min(1, scrollEnergy + Math.abs(velocity));
      vortex.setScrollVelocity(velocity);
      const workIndex = sections.findIndex((section) => section.id === 'work');
      const researchIndex = sections.findIndex((section) => section.id === 'research');
      workTravel = clamp((window.scrollY - anchors[workIndex]) / Math.max(1, anchors[researchIndex] - anchors[workIndex]), 0, 1);
      if (pointerPresent) updateProjectHover(document.elementFromPoint(pointerClientX, pointerClientY));
    }
  };

  const onNavigationStateChange = () => {
    anchors = measureAnchors(sections);
    onScroll();
    if (isReduced() || !motionRequested) renderStaticFrame();
    else scheduleFrame();
  };

  const onVisibilityChange = () => {
    active = !document.hidden;
    if (!active) {
      cancelFrame();
      onPointerLeave();
      resetInteraction();
      updateStateAttribute();
      return;
    }

    lastTime = performance.now();
    if (isReduced()) renderStaticFrame();
    else scheduleFrame();
    updateStateAttribute();
  };

  const onContextLost = (event) => {
    event.preventDefault();
    contextLost = true;
    cancelFrame();
    onPointerLeave();
    resetInteraction();
    if (!failureNotified) {
      failureNotified = true;
      markUnavailable(canvas);
      onFailure?.();
    }
    updateStateAttribute();
  };

  const onContextRestored = () => {
    if (disposed || failureNotified) return;
    contextLost = false;
    canvas.hidden = false;
    document.documentElement.classList.remove('webgl-unavailable');
    renderer.resetState?.();
    canvasVisible = true;
    resize();
    lastTime = performance.now();
    if (isReduced() || !motionRequested) renderStaticFrame();
    else scheduleFrame();
    updateStateAttribute();
  };

  const onPageHide = (event) => {
    if (event.persisted) {
      bfcachePaused = true;
      active = false;
      cancelFrame();
      onPointerLeave();
      resetInteraction();
      updateStateAttribute();
      return;
    }
    controller.dispose();
  };

  const onPageShow = (event) => {
    if (!event.persisted || disposed) return;
    bfcachePaused = false;
    active = !document.hidden;
    lastTime = performance.now();
    if (isReduced()) renderStaticFrame();
    else scheduleFrame();
    updateStateAttribute();
  };

  const onReducedMotionChange = () => {
    if (disposed) return;
    syncPointerListener();
    if (isReduced()) {
      cancelFrame();
      renderStaticFrame();
    } else {
      updateTargetFromScroll();
      scheduleFrame();
    }
    updateStateAttribute();
  };

  const measure = () => {
    if (disposed) return;
    anchors = measureAnchors(sections);
    if (!isReduced() || !readyNotified) updateTargetFromScroll();
  };

  const onThemeChange = () => {
    if (disposed) return;
    const next = getThemeColors();
    vortex.setTheme(next);
    renderer.setClearColor(next.bg, 0);
    scene.fog.color.set(next.bg);
    hemisphereLight.color.set(next.accent);
    hemisphereLight.groundColor.set(next.bg);
    cyanLight.color.set(next.accent);
    indigoLight.color.set(next.highlight);
    canvas.dataset.theme = document.documentElement.dataset.theme || 'teal';
    render();
  };

  const canvasObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([entry]) => {
      canvasVisible = entry.isIntersecting;
      if (!canvasVisible) {
        cancelFrame();
        onPointerLeave();
        resetInteraction();
      } else if (canAnimate()) scheduleFrame();
      else render();
      updateStateAttribute();
    })
    : null;
  canvasObserver?.observe(canvas);

  let resizeObserver;
  let resizeTimer = 0;
  const scheduleResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 120);
  };
  const controller = {
    setMotion(enabled) {
      if (disposed) return;
      motionRequested = Boolean(enabled);
      syncPointerListener();
      if (!motionRequested) {
        cancelFrame();
        resetInteraction();
        updateStateAttribute();
        return;
      }
      if (isReduced()) renderStaticFrame();
      else {
        updateTargetFromScroll();
        scheduleFrame();
      }
      updateStateAttribute();
    },
    dispose() {
      if (disposed) return;
      cancelFrame();
      window.removeEventListener('pointermove', updatePointer);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
      resetInteraction();
      pointerListening = false;
      disposed = true;
       window.removeEventListener('resize', scheduleResize);
       window.clearTimeout(resizeTimer);
       window.removeEventListener('scroll', onScroll);
       window.removeEventListener('hashchange', onNavigationStateChange);
       window.removeEventListener('popstate', onNavigationStateChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      resizeObserver?.disconnect();
      canvasObserver?.disconnect();
      window.removeEventListener('portfolio:themechange', onThemeChange);
      mediaCleanup.forEach((remove) => remove());
      clearHover();
      document.body.classList.remove('scene-past-hero');

      vortex.dispose();
      const disposedTextures = new Set();
      resources.materials.forEach((material) => disposeMaterial(material, disposedTextures));
      resources.geometries.forEach((geometry) => geometry.dispose());
      renderer.renderLists?.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.dataset.state = 'disposed';
    },
  };

  resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(measure)
    : null;
  sections.forEach((section) => resizeObserver?.observe(section));

   window.addEventListener('resize', scheduleResize, { passive: true });
   window.addEventListener('scroll', onScroll, { passive: true });
   window.addEventListener('hashchange', onNavigationStateChange);
   window.addEventListener('popstate', onNavigationStateChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);
  mediaCleanup.push(listenToMediaQuery(reducedMotionQuery, onReducedMotionChange));
  mediaCleanup.push(listenToMediaQuery(coarseQuery, () => {
    setCanvasLayout(canvas, coarseQuery.matches || window.innerWidth < 720);
    resize();
    syncPointerListener();
  }));
  mediaCleanup.push(listenToMediaQuery(desktopPointerQuery, syncPointerListener));
  document.fonts?.ready?.then(measure, () => {});
  window.addEventListener('portfolio:themechange', onThemeChange);
  canvas.dataset.theme = document.documentElement.dataset.theme || 'teal';

  resize();
  onScroll();
  syncPointerListener();
  renderStaticFrame();
  if (!isReduced()) scheduleFrame();
  else updateStateAttribute();

  return controller;
}
