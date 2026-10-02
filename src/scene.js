import * as THREE from 'three';

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

const createSeededRandom = (seed = 6566) => {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

const keyframes = [
  { x: 2.65, y: 0.15, z: 13.5, scale: 1.0, rx: 0.12, ry: -0.42, rz: 0.02 },
  { x: 3.25, y: 0.35, z: 14.6, scale: 0.84, rx: 0.7, ry: 0.5, rz: -0.12 },
  { x: 2.0, y: -0.25, z: 12.25, scale: 1.08, rx: 1.2, ry: 1.35, rz: 0.24 },
  { x: -1.15, y: 0.52, z: 14.5, scale: 0.84, rx: 1.72, ry: 2.18, rz: -0.34 },
  { x: 0.1, y: 0.0, z: 16.5, scale: 0.64, rx: 2.25, ry: 3.12, rz: 0.05 },
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

function projectElements() {
  const explicit = [...document.querySelectorAll('[data-project]')];
  if (explicit.length) return explicit;
  return [...document.querySelectorAll('.card')];
}

function measureAnchors(sections) {
  return sections.map((section) => section.getBoundingClientRect().top + window.scrollY);
}

function createStarField(count, trackGeometry, trackMaterial) {
  const random = createSeededRandom();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const theme = getThemeColors();
  const indigo = new THREE.Color(theme.highlight);
  const cyan = new THREE.Color(theme.accent);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 9 + random() * 17;
    const y = (random() - 0.5) * 17;
    const depth = Math.sqrt(Math.max(0, 1 - Math.min(1, Math.abs(y) / 18)));
    positions[index * 3] = Math.cos(angle) * radius * depth;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = Math.sin(angle) * radius - 5;

    color.copy(indigo).lerp(cyan, random() * 0.75);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  const geometry = trackGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = trackMaterial(new THREE.PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    sizeAttenuation: true,
  }));
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
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
}

function sampleAtSectionAnchors(anchors, output) {
  if (anchors.length < 2) {
    copyState(output, keyframes[0]);
    return;
  }

  const focus = window.scrollY + window.innerHeight * 0.48;
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
  camera.position.set(2.7, 0.25, 13.4);

  const world = new THREE.Group();
  const heroObject = new THREE.Group();
  const markerOrbit = new THREE.Group();
  world.add(heroObject, markerOrbit);
  scene.add(world);

  const core = new THREE.Mesh(
    trackGeometry(new THREE.TorusKnotGeometry(
      2.15,
      0.56,
      compact ? 80 : 128,
      compact ? 12 : 18,
      2,
      3,
    )),
    trackMaterial(new THREE.MeshPhysicalMaterial({
      color: themeColors.surface,
      metalness: 0.8,
      roughness: 0.22,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
      emissive: themeColors.accent,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.42,
      wireframe: true,
      depthWrite: false,
    })),
  );
  heroObject.add(core);

  const shell = new THREE.Mesh(
    trackGeometry(new THREE.TorusKnotGeometry(
      2.42,
      0.025,
      compact ? 64 : 96,
      compact ? 6 : 8,
      2,
      3,
    )),
    trackMaterial(new THREE.MeshBasicMaterial({
       color: themeColors.accent,
      transparent: true,
      opacity: 0.34,
      wireframe: true,
      depthWrite: false,
    })),
  );
  shell.rotation.set(0.25, -0.3, 0.18);
  heroObject.add(shell);

  const ringGeometry = trackGeometry(new THREE.TorusGeometry(3.55, 0.014, 6, compact ? 64 : 96));
  const ringMaterials = [
    trackMaterial(new THREE.MeshBasicMaterial({ color: themeColors.accent, transparent: true, opacity: 0.48 })),
    trackMaterial(new THREE.MeshBasicMaterial({ color: themeColors.highlight, transparent: true, opacity: 0.28 })),
    trackMaterial(new THREE.MeshBasicMaterial({ color: themeColors.accent, transparent: true, opacity: 0.22 })),
  ];
  const rings = [];
  for (let index = 0; index < ringMaterials.length; index += 1) {
    const ring = new THREE.Mesh(ringGeometry, ringMaterials[index]);
    ring.rotation.set(0.55 + index * 0.47, index * 0.72, index * 0.35);
    ring.scale.setScalar(1 + index * 0.2);
    heroObject.add(ring);
    rings.push(ring);
  }

  const markerGeometry = trackGeometry(new THREE.SphereGeometry(0.095, compact ? 8 : 12, compact ? 6 : 8));
  const markerGlowGeometry = trackGeometry(new THREE.SphereGeometry(0.17, compact ? 6 : 8, compact ? 4 : 6));
  const projectTargets = projectElements();
  const markerCount = Math.max(1, projectTargets.length);
  const markerEntries = [];
  const markerObjects = [];
  for (let index = 0; index < markerCount; index += 1) {
    const target = projectTargets[index] || null;
    const markerMaterial = trackMaterial(new THREE.MeshStandardMaterial({
      color: themeColors.accent,
      emissive: themeColors.accent,
      emissiveIntensity: 1.15,
      roughness: 0.2,
      metalness: 0.15,
    }));
    const glowMaterial = trackMaterial(new THREE.MeshBasicMaterial({
      color: themeColors.accent,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    }));
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    const glow = new THREE.Mesh(markerGlowGeometry, glowMaterial);
    const entry = { marker, glow, material: markerMaterial, target };
    marker.add(glow);
    marker.userData.entry = entry;
    marker.userData.angle = (index / markerCount) * Math.PI * 2;
    marker.userData.radius = 3.7 + (index % 3) * 0.44;
    marker.userData.height = (index % 2 ? 1 : -1) * (0.2 + (index % 4) * 0.18);
    marker.userData.speed = 0.08 + (index % 3) * 0.018;
    markerOrbit.add(marker);
    markerEntries.push(entry);
    markerObjects.push(marker);
  }

  const stars = createStarField(
    compact ? 90 : reducedMotionQuery.matches ? 140 : 280,
    trackGeometry,
    trackMaterial,
  );
  scene.add(stars);

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
  let hovered = null;
  let animationFrame = 0;
  let lastTime = performance.now();
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
  const raycaster = new THREE.Raycaster();
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

  const updateDiagnostics = () => {
    const now = performance.now();
    if (now - lastDiagnostics < 1000) return;
    lastDiagnostics = now;
    canvas.dataset.drawCalls = String(renderer.info.render.calls || 0);
    canvas.dataset.triangles = String(renderer.info.render.triangles || 0);
    canvas.dataset.dpr = Number(renderer.getPixelRatio()).toFixed(2);
    canvas.dataset.frames = String(renderedFrames);
    canvas.dataset.quality = currentQuality(coarseQuery.matches || window.innerWidth < 720);
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
    camera.aspect = width / height;
    camera.fov = narrow ? 47 : 42;
    camera.updateProjectionMatrix();
    anchors = measureAnchors(sections);
    if (!isReduced() || !readyNotified) updateTargetFromScroll();
    updateDiagnostics();
    if (readyNotified && (isReduced() || !motionRequested)) render();
  };

  const applyVisuals = (time, motion, delta) => {
    const mobileFrame = coarseQuery.matches || window.innerWidth < 960;
    // Keep the field to the right on narrow screens so it does not sit over copy.
    world.position.set(
      mobileFrame ? 4.8 + state.x * 0.08 : state.x,
      mobileFrame ? state.y * 0.72 : state.y,
      0,
    );
    world.scale.setScalar(mobileFrame ? state.scale * 0.52 : state.scale * 0.86);
    heroObject.rotation.set(
      state.rx + pointerY * 0.08,
      state.ry + pointerX * 0.11 + time * 0.00007 * motion,
      state.rz,
    );
    core.rotation.x += delta * 0.12 * motion;
    core.rotation.y += delta * 0.2 * motion;
    shell.rotation.y -= delta * 0.13 * motion;
    for (let index = 0; index < rings.length; index += 1) {
      rings[index].rotation.z += delta * (0.045 + index * 0.018) * (index % 2 ? 1 : -1) * motion;
    }
    stars.rotation.y += delta * 0.004 * motion;
    stars.rotation.x = pointerY * 0.018;

    for (let index = 0; index < markerEntries.length; index += 1) {
      const entry = markerEntries[index];
      const { angle, radius, height, speed } = entry.marker.userData;
      const orbitAngle = angle + time * 0.001 * speed * motion;
      entry.marker.position.set(
        Math.cos(orbitAngle) * radius,
        height + Math.sin(time * 0.001 * (0.45 + index * 0.025)) * 0.11 * motion,
        Math.sin(orbitAngle) * radius * 0.5,
      );
      entry.glow.scale.setScalar(1 + Math.sin(time * 0.0014 + index) * 0.12 * motion);
    }

    // The target includes all offsets before damping; adding them after damp
    // would feed an offset back into the next frame and cause camera drift.
    const cameraTargetX = state.x * 0.02 + pointerX * 0.32;
    const cameraTargetY = state.y * 0.02 - pointerY * 0.24;
    camera.position.x = damp(camera.position.x, cameraTargetX, 3.6, delta);
    camera.position.y = damp(camera.position.y, cameraTargetY, 3.6, delta);
    camera.position.z = damp(camera.position.z, state.z, 3.6, delta);
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
    state.x = damp(state.x, targetState.x, 4.6, delta);
    state.y = damp(state.y, targetState.y, 4.6, delta);
    state.z = damp(state.z, targetState.z, 4.6, delta);
    state.scale = damp(state.scale, targetState.scale, 4.6, delta);
    state.rx = damp(state.rx, targetState.rx, 4.6, delta);
    state.ry = damp(state.ry, targetState.ry, 4.6, delta);
    state.rz = damp(state.rz, targetState.rz, 4.6, delta);
    pointerX = damp(pointerX, pointerTargetX, 5.5, delta);
    pointerY = damp(pointerY, pointerTargetY, 5.5, delta);
    applyVisuals(time, 1, delta);
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
    applyVisuals(0, 0, 0);
    render();
    updateStateAttribute();
  };

  const clearHover = () => {
    if (!hovered) return;
    hovered.material.emissiveIntensity = 1.15;
    hovered.marker.scale.setScalar(1);
    hovered.target?.classList.remove('is-3d-hovered');
    hovered = null;
  };

  const updatePointer = (event) => {
    if (!pointerListening || !canAnimate()) return;
    pointerTargetX = clamp((event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2, -1, 1);
    pointerTargetY = clamp((event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2, -1, 1);
    pointerNdc.set(pointerTargetX, -pointerTargetY);
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(markerObjects, false)[0];
    const next = hit?.object.userData.entry || null;
    if (next === hovered) return;
    clearHover();
    hovered = next;
    if (!hovered) return;
    hovered.material.emissiveIntensity = 2.3;
    hovered.marker.scale.setScalar(1.45);
    hovered.target?.classList.add('is-3d-hovered');
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
    } else {
      window.removeEventListener('pointermove', updatePointer);
      clearHover();
      pointerTargetX = 0;
      pointerTargetY = 0;
    }
  };

  const onScroll = () => {
    document.body.classList.toggle('scene-past-hero', window.scrollY > window.innerHeight * 0.72);
    if (!isReduced() && motionRequested) updateTargetFromScroll();
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
    renderer.setClearColor(next.bg, 0);
    scene.fog.color.set(next.bg);
    core.material.color.set(next.surface);
    core.material.emissive.set(next.accent);
    shell.material.color.set(next.accent);
    ringMaterials.forEach((material, index) => material.color.set(index === 1 ? next.highlight : next.accent));
    markerEntries.forEach(({ material, glow }) => {
      material.color.set(next.accent);
      material.emissive.set(next.accent);
      glow.material.color.set(next.accent);
    });
    hemisphereLight.color.set(next.accent);
    hemisphereLight.groundColor.set(next.bg);
    cyanLight.color.set(next.accent);
    indigoLight.color.set(next.highlight);
    const colors = stars.geometry.getAttribute('color');
    const accent = new THREE.Color(next.accent);
    const highlight = new THREE.Color(next.highlight);
    const color = new THREE.Color();
    for (let index = 0; index < colors.count; index += 1) {
      color.copy(highlight).lerp(accent, (index % 10) / 12);
      colors.setXYZ(index, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
    canvas.dataset.theme = document.documentElement.dataset.theme || 'teal';
    render();
  };

  const canvasObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([entry]) => {
      canvasVisible = entry.isIntersecting;
      if (!canvasVisible) cancelFrame();
      else if (canAnimate()) scheduleFrame();
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
