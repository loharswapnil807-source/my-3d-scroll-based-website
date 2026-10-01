import * as THREE from 'three';

/*
 * Standalone scene runtime for the portfolio.
 *
 * The module intentionally owns only the canvas with id="scene". All copy,
 * section markup, and project metadata remain in the host document.
 */

const MOBILE_QUERY = '(pointer: coarse)';
const DESKTOP_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const SECTION_IDS = ['hero', 'about', 'work', 'research', 'contact'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const damp = (current, target, lambda, delta) => {
  const amount = 1 - Math.exp(-lambda * Math.min(delta, 0.1));
  return lerp(current, target, amount);
};

function createSeededRandom(seed = 0x19a6) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function markUnavailable(canvas) {
  canvas.hidden = true;
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
  // Existing portfolio cards are safe enhancement targets, without relying on
  // their labels or inventing any project data.
  return [...document.querySelectorAll('.card')];
}

function getScrollAnchors(sections) {
  return sections.map((section) => section.getBoundingClientRect().top + window.scrollY);
}

function scrollProgress(anchors) {
  if (anchors.length < 2) return 0;
  const focus = window.scrollY + window.innerHeight * 0.48;
  const start = anchors[0];
  const end = anchors[anchors.length - 1];
  return clamp((focus - start) / Math.max(1, end - start), 0, 1);
}

function sampleKeyframes(keyframes, progress) {
  if (keyframes.length < 2) return keyframes[0];
  const scaled = progress * (keyframes.length - 1);
  const index = Math.min(keyframes.length - 2, Math.floor(scaled));
  const blend = scaled - index;
  const from = keyframes[index];
  const to = keyframes[index + 1];
  return Object.keys(from).reduce((result, property) => {
    result[property] = lerp(from[property], to[property], blend);
    return result;
  }, {});
}

function createStarField(count) {
  const random = createSeededRandom();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const indigo = new THREE.Color(0x6575ff);
  const cyan = new THREE.Color(0x00d4ff);
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function setCanvasLayout(canvas) {
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    display: 'block',
    zIndex: '0',
    pointerEvents: 'none',
  });
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

function initScene() {
  const canvas = document.getElementById('scene');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  setCanvasLayout(canvas);

  const isCoarse = window.matchMedia(MOBILE_QUERY).matches;
  const isDesktopPointer = window.matchMedia(DESKTOP_POINTER_QUERY).matches;
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  const sections = sectionElements();
  const projectTargets = projectElements();
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !isCoarse,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });
  } catch (error) {
    markUnavailable(canvas);
    return;
  }

  renderer.setClearColor(0x050711, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050711, 0.025);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(2.7, 0.25, 13.4);

  const world = new THREE.Group();
  const heroObject = new THREE.Group();
  const markerOrbit = new THREE.Group();
  world.add(heroObject, markerOrbit);
  scene.add(world);

  const coreGeometry = new THREE.TorusKnotGeometry(2.15, 0.56, 144, 20, 2, 3);
  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x18295d,
    metalness: 0.8,
    roughness: 0.22,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
    emissive: 0x06152f,
    emissiveIntensity: 0.9,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  heroObject.add(core);

  const shell = new THREE.Mesh(
    new THREE.TorusKnotGeometry(2.42, 0.025, 112, 8, 2, 3),
    new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.34,
      wireframe: true,
      depthWrite: false,
    }),
  );
  shell.rotation.set(0.25, -0.3, 0.18);
  heroObject.add(shell);

  const ringGeometry = new THREE.TorusGeometry(3.55, 0.014, 6, 100);
  const ringMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.48 }),
    new THREE.MeshBasicMaterial({ color: 0x6b72ff, transparent: true, opacity: 0.28 }),
    new THREE.MeshBasicMaterial({ color: 0xb9ecff, transparent: true, opacity: 0.22 }),
  ];
  const rings = ringMaterials.map((material, index) => {
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.rotation.set(0.55 + index * 0.47, index * 0.72, index * 0.35);
    ring.scale.setScalar(1 + index * 0.2);
    heroObject.add(ring);
    return ring;
  });

  const markerGeometry = new THREE.SphereGeometry(0.095, 12, 8);
  const markerGlowGeometry = new THREE.SphereGeometry(0.17, 8, 6);
  const markerEntries = projectTargets.slice(0, 10).map((target, index) => {
    const material = new THREE.MeshStandardMaterial({
      color: 0x8deaff,
      emissive: 0x0d5b7c,
      emissiveIntensity: 1.15,
      roughness: 0.2,
      metalness: 0.15,
    });
    const marker = new THREE.Mesh(markerGeometry, material);
    const glow = new THREE.Mesh(
      markerGlowGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      }),
    );
    marker.add(glow);
    marker.userData.projectTarget = target;
    marker.userData.angle = (index / Math.max(1, projectTargets.length)) * Math.PI * 2;
    marker.userData.radius = 3.7 + (index % 3) * 0.44;
    marker.userData.height = (index % 2 ? 1 : -1) * (0.2 + (index % 4) * 0.18);
    marker.userData.speed = 0.08 + (index % 3) * 0.018;
    markerOrbit.add(marker);
    return { marker, glow, material, target };
  });

  const stars = createStarField(isCoarse ? 110 : reducedMotion.matches ? 150 : 330);
  scene.add(stars);

  scene.add(new THREE.HemisphereLight(0x8ea8ff, 0x02030b, 1.4));
  const cyanLight = new THREE.PointLight(0x00d4ff, 13, 24, 2);
  cyanLight.position.set(4.5, 4.5, 6);
  scene.add(cyanLight);
  const indigoLight = new THREE.PointLight(0x514dff, 9, 25, 2);
  indigoLight.position.set(-5, -2.5, 3);
  scene.add(indigoLight);

  const keyframes = [
    { x: 2.65, y: 0.15, z: 13.5, scale: 1.0, rx: 0.12, ry: -0.42, rz: 0.02 },
    { x: 3.25, y: 0.35, z: 14.6, scale: 0.84, rx: 0.7, ry: 0.5, rz: -0.12 },
    { x: 2.0, y: -0.25, z: 12.25, scale: 1.08, rx: 1.2, ry: 1.35, rz: 0.24 },
    { x: -1.15, y: 0.52, z: 14.5, scale: 0.84, rx: 1.72, ry: 2.18, rz: -0.34 },
    { x: 0.1, y: 0.0, z: 16.5, scale: 0.64, rx: 2.25, ry: 3.12, rz: 0.05 },
  ];
  const state = { ...keyframes[0] };
  let anchors = getScrollAnchors(sections);
  let targetProgress = scrollProgress(anchors);
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let hovered = null;
  let frame = 0;
  let lastTime = performance.now();
  let active = !document.hidden;
  let disposed = false;
  let contextLost = false;

  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const maxDpr = isCoarse ? 1.35 : 1.8;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 640 ? 47 : 42;
    camera.updateProjectionMatrix();
  };

  const updateScroll = () => {
    anchors = getScrollAnchors(sections);
    targetProgress = scrollProgress(anchors);
    document.body.classList.toggle('scene-past-hero', window.scrollY > window.innerHeight * 0.72);
  };

  const updatePointer = (event) => {
    if (!isDesktopPointer || reducedMotion.matches || contextLost) return;
    pointerTargetX = clamp((event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2, -1, 1);
    pointerTargetY = clamp((event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2, -1, 1);

    if (!markerEntries.length) return;
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    const pointer = new THREE.Vector2(ndcX, ndcY);
    const raycaster = updatePointer.raycaster || (updatePointer.raycaster = new THREE.Raycaster());
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(markerEntries.map((entry) => entry.marker), false)[0];
    const next = hit ? markerEntries.find((entry) => entry.marker === hit.object) : null;
    if (next === hovered) return;
    if (hovered) {
      hovered.material.emissiveIntensity = 1.15;
      hovered.marker.scale.setScalar(1);
      hovered.target.classList.remove('is-3d-hovered');
    }
    hovered = next;
    if (hovered) {
      hovered.material.emissiveIntensity = 2.3;
      hovered.marker.scale.setScalar(1.45);
      hovered.target.classList.add('is-3d-hovered');
    }
  };

  const render = (time) => {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    if (!active || contextLost) {
      lastTime = time;
      return;
    }

    const delta = Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    const sampled = sampleKeyframes(keyframes, targetProgress);
    const stateLambda = reducedMotion.matches ? 18 : 4.6;
    Object.keys(state).forEach((property) => {
      state[property] = damp(state[property], sampled[property], stateLambda, delta);
    });

    const motion = reducedMotion.matches ? 0 : 1;
    pointerX = damp(pointerX, pointerTargetX, 5.5, delta) * motion;
    pointerY = damp(pointerY, pointerTargetY, 5.5, delta) * motion;

    world.position.set(state.x + pointerX * 0.28, state.y - pointerY * 0.22, 0);
    world.scale.setScalar(state.scale);
    heroObject.rotation.set(
      state.rx + pointerY * 0.08,
      state.ry + pointerX * 0.11 + time * 0.00007 * motion,
      state.rz,
    );
    core.rotation.x += delta * 0.12 * motion;
    core.rotation.y += delta * 0.2 * motion;
    shell.rotation.y -= delta * 0.13 * motion;
    rings.forEach((ring, index) => {
      ring.rotation.z += delta * (0.045 + index * 0.018) * (index % 2 ? 1 : -1) * motion;
    });
    stars.rotation.y += delta * 0.004 * motion;
    stars.rotation.x = pointerY * 0.018;

    markerEntries.forEach(({ marker, glow }, index) => {
      const { angle, radius, height, speed } = marker.userData;
      const orbitAngle = angle + time * 0.001 * speed * motion;
      marker.position.set(
        Math.cos(orbitAngle) * radius,
        height + Math.sin(time * 0.001 * (0.45 + index * 0.025)) * 0.11 * motion,
        Math.sin(orbitAngle) * radius * 0.5,
      );
      const pulse = 1 + Math.sin(time * 0.0014 + index) * 0.12 * motion;
      glow.scale.setScalar(pulse);
    });

    camera.position.x = damp(camera.position.x, pointerX * 0.32, 3.6, delta) + state.x * 0.02;
    camera.position.y = damp(camera.position.y, -pointerY * 0.24, 3.6, delta) + state.y * 0.02;
    camera.position.z = damp(camera.position.z, state.z, 3.6, delta);
    camera.lookAt(world.position.x * 0.12, world.position.y * 0.1, 0);
    renderer.render(scene, camera);
  };

  const onVisibilityChange = () => {
    active = !document.hidden;
    lastTime = performance.now();
  };

  const onContextLost = (event) => {
    event.preventDefault();
    contextLost = true;
    active = false;
    markUnavailable(canvas);
  };

  const onContextRestored = () => {
    if (disposed) return;
    contextLost = false;
    active = !document.hidden;
    canvas.hidden = false;
    document.documentElement.classList.remove('webgl-unavailable');
    resize();
    lastTime = performance.now();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', updateScroll);
    window.removeEventListener('pointermove', updatePointer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    if (hovered) hovered.target.classList.remove('is-3d-hovered');
    disposeObject(world);
    disposeObject(stars);
    renderer.dispose();
    renderer.forceContextLoss?.();
  };

  resize();
  updateScroll();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', updateScroll, { passive: true });
  if (isDesktopPointer) window.addEventListener('pointermove', updatePointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);
  window.addEventListener('pagehide', dispose, { once: true });
  reducedMotion.addEventListener?.('change', () => {
    lastTime = performance.now();
  });
  frame = requestAnimationFrame(render);
}

function initInterface() {
  const loader = document.getElementById('loader');
  const loaderStatus = document.getElementById('loader-status');
  const loaderProgress = document.getElementById('loader-progress');
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);

  const finishLoading = () => {
    if (!loader) return;
    if (loaderStatus) loaderStatus.textContent = '04 / 04';
    if (loaderProgress) loaderProgress.textContent = 'Field online';
    requestAnimationFrame(() => {
      loader.classList.add('loaded');
      loader.setAttribute('aria-hidden', 'true');
    });
  };

  const revealElements = [...document.querySelectorAll('[data-reveal]')];
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealElements.forEach((element) => {
      element.dataset.reveal = 'visible';
    });
  } else {
    revealElements.forEach((element) => {
      element.dataset.reveal = 'pending';
    });
    const observer = new IntersectionObserver((entries, io) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.dataset.reveal = 'visible';
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealElements.forEach((element) => observer.observe(element));
  }

  const menu = document.getElementById('nav-links');
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenuQuery = window.matchMedia('(max-width: 48rem)');
  const syncMenuAccessibility = () => {
    if (!menu) return;
    if (mobileMenuQuery.matches) {
      menu.setAttribute('aria-hidden', String(!menu.classList.contains('is-open')));
    } else {
      menu.removeAttribute('aria-hidden');
    }
  };
  const closeMenu = () => {
    if (!menu || !menuToggle) return;
    menu.classList.remove('is-open');
    syncMenuAccessibility();
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
  };
  const toggleMenu = () => {
    if (!menu || !menuToggle) return;
    const isOpen = menu.classList.toggle('is-open');
    syncMenuAccessibility();
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  };

  if (menu && menuToggle) {
    syncMenuAccessibility();
    mobileMenuQuery.addEventListener?.('change', () => {
      closeMenu();
      syncMenuAccessibility();
    });
    window.addEventListener('resize', syncMenuAccessibility, { passive: true });
    menuToggle.addEventListener('click', toggleMenu);
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
    document.addEventListener('click', (event) => {
      if (!menu.classList.contains('is-open')) return;
      if (!(event.target instanceof Node) || menu.contains(event.target) || menuToggle.contains(event.target)) return;
      closeMenu();
    });
  }

  const navLinks = [...document.querySelectorAll('.nav-links a')];
  const sections = [...document.querySelectorAll('[data-scene-section]')];
  if ('IntersectionObserver' in window && navLinks.length && sections.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-42% 0px -48% 0px', threshold: 0 });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  if (loader) {
    if (loaderProgress) loaderProgress.textContent = 'Mapping the interface';
    finishLoading();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initScene();
    initInterface();
  }, { once: true });
} else {
  initScene();
  initInterface();
}
