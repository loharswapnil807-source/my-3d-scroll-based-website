import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const random = (index) => {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

// A machined, rounded-square aperture, deliberately distinct from a logo.
function apertureCurve(radius, depth = 0) {
  const points = Array.from({ length: 80 }, (_, i) => {
    const angle = i / 80 * TAU;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    return new THREE.Vector3(
      Math.sign(x) * Math.pow(Math.abs(x), .52) * radius,
      Math.sign(y) * Math.pow(Math.abs(y), .52) * radius,
      Math.sin(angle * 2) * depth,
    );
  });
  return new THREE.CatmullRomCurve3(points, true, 'centripetal');
}

function combineTubes(curves, radius, segments = 72) {
  const positions = [];
  const normals = [];
  const uvs = [];
  curves.forEach((curve) => {
    const source = new THREE.TubeGeometry(curve, segments, radius, 5, false);
    const geometry = source.toNonIndexed();
    positions.push(...geometry.attributes.position.array);
    normals.push(...geometry.attributes.normal.array);
    uvs.push(...geometry.attributes.uv.array);
    geometry.dispose();
    source.dispose();
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

const lineVertex = `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;
const lineFragment = `
  uniform float uTime;
  uniform float uGlow;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    float packet = pow(max(0.0, sin(vUv.x * 72.0 + uTime * 1.4)), 18.0);
    float fade = 1.0 - smoothstep(30.0, 95.0, vDepth);
    float intensity = mix(0.22, 1.0, packet);
    gl_FragColor = vec4(uColor * (1.0 + packet * 0.7), intensity * fade * uGlow);
  }
`;

/** Procedural environment, generated once; no borrowed models or texture downloads. */
export function createStudioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#263036');
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  for (const [x, y, z, width, height] of [[-5, 3, 1, 3, 12], [5, 1, -2, 2, 14], [0, 7, 0, 12, 5], [0, 0, 7, 8, 2]]) {
    const panel = new THREE.Mesh(geometry, material);
    panel.position.set(x, y, z);
    panel.scale.set(width, height, 1);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, .08, .1, 100, { size: 128 });
  generator.dispose();
  geometry.dispose();
  material.dispose();
  return environment;
}

/** One continuous 110-unit environment. The host owns camera, RAF and listeners. */
export function createSiliconWorld({ colors, compact = false }) {
  const group = new THREE.Group();
  const geometries = new Set();
  const materials = new Set();
  const trackGeometry = (geometry) => { geometries.add(geometry); return geometry; };
  const trackMaterial = (material) => { materials.add(material); return material; };
  const mesh = (geometry, material, parent = group) => {
    const object = new THREE.Mesh(trackGeometry(geometry), material);
    parent.add(object);
    return object;
  };
  const metal = trackMaterial(new THREE.MeshStandardMaterial({ color: '#6d8189', metalness: .96, roughness: .2, envMapIntensity: 1.3 }));
  const graphite = trackMaterial(new THREE.MeshStandardMaterial({ color: '#17242a', metalness: .75, roughness: .32 }));
  const ceramic = trackMaterial(new THREE.MeshStandardMaterial({ color: '#0d161b', metalness: .45, roughness: .3 }));
  const light = trackMaterial(new THREE.MeshBasicMaterial({ color: colors.highlight, toneMapped: false }));
  const clock = { value: 0 };
  const lineColor = { value: new THREE.Color(colors.highlight) };
  const streamMaterial = (glow) => trackMaterial(new THREE.ShaderMaterial({
    uniforms: { uTime: clock, uColor: lineColor, uGlow: { value: glow } },
    vertexShader: lineVertex, fragmentShader: lineFragment,
    transparent: true, depthWrite: false, toneMapped: false,
    blending: THREE.AdditiveBlending,
  }));
  const streams = streamMaterial(.9);
  const halos = streamMaterial(.08);

  const portal = new THREE.Group();
  portal.position.set(3.5, .9, 0);
  portal.rotation.set(.15, -.48, -.32);
  group.add(portal);
  const portalLayers = [];
  for (let i = 0; i < 3; i += 1) {
    const layer = new THREE.Group();
    const radius = 2.45 - i * .25;
    const curve = apertureCurve(radius, .24);
    layer.position.z = -i * .24;
    mesh(new THREE.TubeGeometry(curve, 160, i === 0 ? .14 : .07, 10, true), metal, layer);
    const outline = mesh(new THREE.TubeGeometry(apertureCurve(radius + .012, .24), 160, .014, 5, true), light, layer);
    outline.position.z = .13;
    portalLayers.push(layer);
    portal.add(layer);
  }

  const box = trackGeometry(new THREE.BoxGeometry(1, 1, 1));
  const dummy = new THREE.Object3D();
  const teeth = new THREE.InstancedMesh(box, graphite, 64);
  const rim = apertureCurve(2.65, .24);
  for (let i = 0; i < 64; i += 1) {
    const point = rim.getPointAt(i / 64);
    dummy.position.copy(point);
    dummy.rotation.set(0, 0, Math.atan2(point.y, point.x));
    dummy.scale.set(.3, .055, .28);
    dummy.updateMatrix();
    teeth.setMatrixAt(i, dummy.matrix);
  }
  portal.add(teeth);

  // Long helical paths create true perspective and continue beyond the camera.
  const curves = Array.from({ length: 24 }, (_, i) => {
    const angle = i / 24 * TAU;
    const radius = 4.2 + random(i) * 5.8;
    const points = Array.from({ length: 55 }, (_, j) => {
      const z = 12 - j * 2.5;
      const twist = angle + z * .035;
      return new THREE.Vector3(2 + Math.cos(twist) * radius, .3 + Math.sin(twist) * radius, z);
    });
    return new THREE.CatmullRomCurve3(points);
  });
  mesh(combineTubes(curves, .011), streams);
  const haloMesh = mesh(combineTubes(curves, .048), halos);

  // Transition gates give the scroll camera physical thresholds to pass through.
  const gateGeometry = trackGeometry(new THREE.TorusGeometry(5.8, .1, 8, 100));
  const gateLightGeometry = trackGeometry(new THREE.TorusGeometry(5.65, .017, 4, 100));
  for (const z of [-14, -24, -53, -94]) {
    const gate = new THREE.Group();
    gate.position.set(2, .2, z);
    gate.rotation.y = -.16;
    gate.add(new THREE.Mesh(gateGeometry, metal), new THREE.Mesh(gateLightGeometry, light));
    group.add(gate);
  }

  // Instanced silicon city: two precisely spaced banks and a clear central aisle.
  const towers = new THREE.InstancedMesh(box, graphite, 180);
  const caps = new THREE.InstancedMesh(box, metal, 180);
  const ports = new THREE.InstancedMesh(box, light, 180);
  for (let i = 0; i < 180; i += 1) {
    const side = i % 2 ? 1 : -1;
    const row = Math.floor(i / 6);
    const column = Math.floor(i / 2) % 3;
    const height = .4 + random(i + 40) * 3.4;
    const x = 2 + side * (5.4 + column * 2.3);
    const z = -9 - row * 3.2;
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, -4 + height * .5, z);
    dummy.scale.set(1.55, height, 2.1);
    dummy.updateMatrix(); towers.setMatrixAt(i, dummy.matrix);
    dummy.position.y = -4 + height;
    dummy.scale.set(1.6, .035, 2.15);
    dummy.updateMatrix(); caps.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x - side * .78, -4 + height * .8, z);
    dummy.scale.set(.025, .032, 1.5);
    dummy.updateMatrix(); ports.setMatrixAt(i, dummy.matrix);
  }
  group.add(towers, caps, ports);
  const floor = mesh(new THREE.PlaneGeometry(60, 150), ceramic);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(2, -4.08, -48);

  const traces = [];
  for (let i = 0; i < 50; i += 1) {
    const x = -20 + i * .9;
    const shift = i % 2 ? 1.2 : -1.2;
    traces.push(x, -4.04, 4, x, -4.04, -25, x, -4.04, -25, x + shift, -4.04, -29, x + shift, -4.04, -29, x + shift, -4.04, -110);
  }
  const traceGeometry = trackGeometry(new THREE.BufferGeometry());
  traceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(traces, 3));
  const traceMaterial = trackMaterial(new THREE.LineBasicMaterial({ color: colors.accent, transparent: true, opacity: .14 }));
  group.add(new THREE.LineSegments(traceGeometry, traceMaterial));

  const core = new THREE.Group();
  core.position.set(-4.8, .9, -78);
  core.rotation.set(.4, .3, .4);
  group.add(core);
  const wafers = [];
  for (let i = 0; i < 5; i += 1) {
    const wafer = mesh(new THREE.BoxGeometry(3.4 - i * .25, .12, 3.4 - i * .25), i % 2 ? metal : ceramic, core);
    wafer.position.y = (i - 2) * .58;
    wafers.push(wafer);
    const frame = mesh(new THREE.TubeGeometry(apertureCurve(1.75 - i * .125), 80, .009, 4, true), light, wafer);
    frame.rotation.x = Math.PI / 2;
    frame.position.y = .07;
  }

  const particleGeometry = trackGeometry(new THREE.BufferGeometry());
  const positions = new Float32Array(1100 * 3);
  const seeds = new Float32Array(1100);
  for (let i = 0; i < 1100; i += 1) {
    positions[i * 3] = (random(i + 700) - .5) * 36;
    positions[i * 3 + 1] = (random(i + 1700) - .5) * 22;
    positions[i * 3 + 2] = 12 - random(i + 2700) * 128;
    seeds[i] = random(i + 3700);
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const particleMaterial = trackMaterial(new THREE.ShaderMaterial({
    uniforms: { uTime: clock, uColor: lineColor, uDpr: { value: 1 } },
    vertexShader: `
      uniform float uTime;
      uniform float uDpr;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * .15 + aSeed * 30.0) * .15;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        vAlpha = (0.2 + aSeed * .55) * (1.0 - smoothstep(20.0, 75.0, -view.z));
        gl_PointSize = clamp((1.0 + aSeed) * 15.0 / max(6.0, -view.z), .7, 2.4) * uDpr;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float point = 1.0 - smoothstep(.12, .5, length(gl_PointCoord - .5));
        gl_FragColor = vec4(uColor, point * vAlpha);
      }
    `,
    transparent: true, depthWrite: false, toneMapped: false,
  }));
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  group.add(particles);

  let disposed = false;
  let lowPower = compact;
  let hover = 0;
  let hoverTarget = 0;
  let progress = 0;
  function setTheme(next) {
    if (disposed) return;
    const lightTheme = new THREE.Color(next.bg).getHSL({}).l > .5;
    metal.color.set(next.metal || '#52666d');
    graphite.color.set(lightTheme ? '#7b8d90' : '#24333a');
    ceramic.color.set(lightTheme ? '#a8b6b7' : '#111c22');
    metal.envMapIntensity = lightTheme ? .7 : 1.35;
    light.color.set(next.highlight);
    lineColor.value.set(next.highlight);
    traceMaterial.color.set(next.accent);
    streams.blending = halos.blending = lightTheme ? THREE.NormalBlending : THREE.AdditiveBlending;
    streams.needsUpdate = halos.needsUpdate = true;
  }
  function resize(width, height, dpr, isCompact) {
    if (disposed) return;
    lowPower = isCompact;
    particleGeometry.setDrawRange(0, lowPower ? 440 : 1100);
    particleMaterial.uniforms.uDpr.value = Math.min(dpr, lowPower ? 1.5 : 2);
    haloMesh.visible = !lowPower;
  }
  function update(time, delta = 0) {
    if (disposed) return;
    clock.value = time;
    hover += (hoverTarget - hover) * (1 - Math.exp(-5 * delta));
    portal.rotation.y = -.48 + Math.sin(time * .18) * .08;
    portal.rotation.z = -.32 + Math.sin(time * .12) * .035;
    portalLayers.forEach((layer, i) => {
      layer.position.z = -i * .24 - Math.sin(time * .4 + i * .5) * .07;
    });
    core.rotation.y = .3 + time * .06;
    wafers.forEach((wafer, i) => { wafer.position.y = (i - 2) * (.58 + Math.sin(time * .4) * .04 + hover * .1); });
  }
  setTheme(colors);
  resize(1440, 900, 1, compact);
  return {
    group, portal, core, setTheme, resize, update,
    setProgress(value) { if (!disposed) progress = clamp(Number.isFinite(value) ? value : 0, 0, 4); },
    setHover(active) { if (!disposed) hoverTarget = active ? 1 : 0; },
    resetInteraction() { hover = 0; hoverTarget = 0; },
    get progress() { return progress; },
    get hoverStrength() { return hover; },
    get particleCount() { return lowPower ? 440 : 1100; },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.visible = false;
      group.traverse((object) => { if (object.isInstancedMesh) object.dispose(); });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}
