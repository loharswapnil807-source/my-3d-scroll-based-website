import * as THREE from 'three';

const PATCHES = 480;
const PATCH_SEGMENTS = 4;
const CILIA = 220;
const CILIA_SEGMENTS = 6;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

/** Critically damped, exact step; 98% of an impulse settles in about 0.8s. */
function settle(position, velocity, target, delta, frequency = 7.3) {
  const offset = position - target;
  const impulse = velocity + frequency * offset;
  const decay = Math.exp(-frequency * delta);
  return [(offset + impulse * delta) * decay + target, (velocity - frequency * impulse * delta) * decay];
}

// Both draw calls include this exact path. Each membrane instance is an adjacent
// interval of ONE global curve, not another ribbon. Cilia sample its actual edge.
const organismGLSL = `
  uniform float uShape;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uTwist;
  uniform float uWorkTravel;
  uniform float uHover;
  uniform float uHoverStrength;
  uniform vec4 uPointer;
  uniform vec2 uPointerImpulse;
  const float PI = 3.14159265359;
  const float TAU = 6.28318530718;

  float ease(float value) { return smoothstep(0.0, 1.0, value); }
  float hash(float value) { return fract(sin(value * 127.1 + 311.7) * 43758.5453); }
  float researchAmount() { return 1.0 - ease(abs(uShape - 2.0)); }
  float goodbye() { return ease((uShape - 2.0) / 1.0); }

  vec3 orb(float t) {
    float latitude = (t - 0.5) * PI;
    float angle = t * TAU * 10.0 + uTime * 0.13;
    float radius = 1.8 * (1.0 + 0.018 * sin(uTime * 1.65));
    radius += 0.025 * sin(angle * 3.0 - uTime * 0.7) * cos(latitude);
    return radius * vec3(cos(latitude) * cos(angle), sin(latitude), cos(latitude) * sin(angle));
  }

  vec3 weave(float t) {
    // One S down the viewport. Its phase tracks the five project chapters;
    // the brightest ribbon stays in the gutter between image and copy.
    float angle = (t * 1.25 + uWorkTravel * 0.9) * TAU;
    return vec3(0.76 * sin(angle), (0.5 - t) * 9.4, 0.34 * cos(angle));
  }

  vec3 lanePoint(float index) {
    float row = floor(index * 0.5);
    float edge = mod(index, 2.0);
    float side = mod(row, 2.0) < 0.5 ? edge : 1.0 - edge;
    return vec3(mix(-2.6, 2.6, side), 1.7 - row * 0.85, 0.0);
  }

  vec3 lanes(float t) {
    // A serpentine circuit: five horizontal lanes joined by four short
    // vertical returns. These are still successive intervals of the ribbon.
    float along = t * 9.0;
    float segment = min(8.0, floor(along));
    return mix(lanePoint(segment), lanePoint(segment + 1.0), along - segment);
  }

  vec3 farewell(float t) {
    float taper = 1.0 - t;
    return vec3(0.7 * sin(t * TAU * 0.8 + 0.3) * taper,
      -2.8 + t * 6.5 + 0.035 * sin(uTime * 0.4),
      0.22 * cos(t * TAU) * taper);
  }

  vec3 centerline(float t) {
    vec3 p;
    if (uShape < 1.0) p = mix(orb(t), weave(t), ease(uShape));
    else if (uShape < 2.0) p = mix(weave(t), lanes(t), ease(uShape - 1.0));
    else p = mix(lanes(t), farewell(t), ease(uShape - 2.0));
    float fluidity = 1.0 - researchAmount();
    p.x += sin(t * TAU * 5.0 - uTime * 1.4) * uEnergy * 0.08 * fluidity;
    p.z += cos(t * TAU * 3.0 + uTime) * uEnergy * 0.08 * fluidity;
    return p;
  }

  vec3 deformed(vec3 p) {
    vec2 delta = p.xy - uPointer.xy;
    float distance = length(delta);
    float local = exp(-dot(delta, delta) / 0.56);
    float dent = uPointer.z * local;
    // Actual local surface displacement, not camera tilt or cursor particles.
    p.z -= dent * 0.3;
    p.xy -= delta * dent * 0.08;
    p.xy += uPointerImpulse * local * 0.12;
    p.z += sin(distance * 12.0 - uTime * 7.0) * exp(-distance * 2.5) * uPointer.w * 0.13;
    return p;
  }

  vec3 sideAt(float t) {
    vec3 p = centerline(t);
    vec3 tangent = normalize(centerline(min(1.0, t + 0.0003)) - centerline(max(0.0, t - 0.0003)) + vec3(0.000001));
    vec3 radial = normalize(orb(t) + vec3(0.000001));
    vec3 coilSide = normalize(cross(tangent, radial) + vec3(0.000001));
    vec3 flatSide = normalize(cross(tangent, vec3(0.0, 0.0, 1.0)) + vec3(0.000001));
    vec3 side = normalize(mix(coilSide, flatSide, ease(uShape)) + vec3(0.000001));
    float twist = (sin(t * TAU * 2.0 + uTime * 0.32) * 0.45 + uTwist * 0.8) * (1.0 - researchAmount());
    return side * cos(twist) + cross(tangent, side) * sin(twist);
  }

  float halfWidth(float t) {
    float coil = 0.095 * (0.25 + 0.75 * cos((t - 0.5) * PI));
    float width = mix(coil, 0.075, ease(uShape));
    width = mix(width, 0.018, ease(uShape - 1.0));
    width = mix(width, 0.045 * pow(max(0.0, 1.0 - t), 1.8) + 0.001, goodbye());
    return width;
  }

  vec3 edgeAt(float t, float across) {
    return deformed(centerline(t) + sideAt(t) * halfWidth(t) * across);
  }
`;

const membraneVertex = `${organismGLSL}
  attribute float aPatch;
  uniform float uPatchCount;
  uniform float uDpr;
  uniform vec2 uResolution;
  varying float vAcross;
  varying float vAlong;
  varying float vShard;
  varying float vDissolve;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float t = (aPatch + position.x) / uPatchCount;
    float centerT = (aPatch + 0.5) / uPatchCount;
    float across = position.y;
    vec3 p = edgeAt(t, across);
    vec3 tangent = normalize(edgeAt(min(1.0, t + 0.0003), across) - edgeAt(max(0.0, t - 0.0003), across) + vec3(0.000001));
    vec3 side = sideAt(t);
    vec3 normal = normalize(cross(tangent, side));
    // At contact the SAME patches progressively detach into small ember flecks.
    // No new particle object, random geometry, or state-dependent mesh swapping.
    float detach = goodbye() * ease((centerT - 0.17) / 0.72);
    float drift = uTime * 0.23 + aPatch * 2.39996;
    float random = hash(aPatch);
    vec3 emberCenter = edgeAt(centerT, 0.0);
    emberCenter += vec3(sin(drift) * (0.25 + random * 0.75),
      0.4 + random * 1.1 + sin(drift * 0.45) * 0.15,
      cos(drift) * 0.3) * detach;
    vec3 ember = emberCenter + vec3(across * 0.007, (position.x - 0.5) * 0.04, 0.0);
    p = mix(p, ember, detach);
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    vNormal = normalize(normalMatrix * normal);
    vView = -view.xyz;
    vAlong = t;
    vAcross = across;
    vShard = random;
    vDissolve = detach;
  }
`;

const membraneFragment = `
  uniform vec3 uCopper;
  uniform vec3 uCream;
  uniform vec3 uEmber;
  uniform vec3 uAccent;
  uniform float uOpacity;
  uniform float uShape;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uHover;
  uniform float uHoverStrength;
  varying float vAcross;
  varying float vAlong;
  varying float vShard;
  varying float vDissolve;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 normal = normalize(vNormal);
    if (!gl_FrontFacing) normal = -normal;
    vec3 view = normalize(vView);
    vec3 light = normalize(vec3(-0.5, 0.9, 1.6));
    float diffuse = 0.4 + 0.6 * abs(dot(normal, light));
    float specular = pow(max(0.0, dot(normal, normalize(light + view))), 28.0);
    float rim = pow(1.0 - abs(dot(normal, view)), 2.5);
    float border = smoothstep(0.72, 0.99, abs(vAcross));
    float technical = 1.0 - smoothstep(0.0, 1.0, abs(uShape - 2.0));
    float pulse = uHoverStrength * exp(-pow((vAlong - uHover) * 11.0, 2.0));
    vec3 color = uCopper * diffuse;
    color = mix(color, uCream, clamp((specular * 0.65 + rim * 0.22 + border * 0.28) * (1.0 - technical * 0.7), 0.0, 0.85));
    color = mix(color, uAccent, technical * 0.18);
    color = mix(color, uEmber, pulse * 0.65 + uEnergy * 0.1 + vDissolve * 0.3);
    float alpha = uOpacity * (0.86 + border * 0.14);
    alpha *= mix(1.0, (0.35 + vShard * 0.4) * (0.85 + 0.15 * sin(uTime + vShard * 20.0)), vDissolve);
    // Sparse floating remnants, rather than an opaque particle cloud.
    if (vDissolve > 0.15 && vShard < vDissolve * 0.82) discard;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

const ciliaVertex = `${organismGLSL}
  attribute vec3 aCilium;
  varying float vAlpha;
  void main() {
    float t = aCilium.x;
    float extent = aCilium.y;
    float side = aCilium.z;
    vec3 p = edgeAt(t, side);
    float research = researchAmount();
    float show = mix(0.18, 1.0, ease(uShape));
    float length = (0.12 + hash(t * 891.0) * 0.4) * show;
    vec3 trail = sideAt(t) * side * extent * length;
    trail.y -= extent * extent * (0.12 + uEnergy * 0.22);
    trail.z += sin(t * 40.0 - uTime * 0.8 - extent * 2.0) * extent * extent * 0.09;
    // Five lanes' bristles become perpendicular, ruler-straight ticks.
    vec3 ruler = vec3(0.0, side * extent * 0.19, 0.0);
    p += mix(trail, ruler, research) * (1.0 - goodbye());
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vAlpha = (1.0 - extent * 0.78) * show * (1.0 - goodbye());
  }
`;
const ciliaFragment = `
  uniform vec3 uCopper;
  uniform vec3 uCream;
  uniform float uLineOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(mix(uCopper, uCream, 0.3), vAlpha * uLineOpacity);
    #include <colorspace_fragment>
  }
`;

function makeMembrane(trackGeometry) {
  const geometry = trackGeometry(new THREE.InstancedBufferGeometry());
  const positions = [];
  const indices = [];
  for (let index = 0; index <= PATCH_SEGMENTS; index += 1) {
    positions.push(index / PATCH_SEGMENTS, -1, 0, index / PATCH_SEGMENTS, 1, 0);
    if (index < PATCH_SEGMENTS) {
      const v = index * 2;
      indices.push(v, v + 1, v + 2, v + 2, v + 1, v + 3);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aPatch', new THREE.InstancedBufferAttribute(Float32Array.from({ length: PATCHES }, (_, index) => index), 1));
  geometry.setIndex(indices);
  geometry.instanceCount = PATCHES;
  return geometry;
}

function makeCilia(trackGeometry) {
  const geometry = trackGeometry(new THREE.BufferGeometry());
  const parameters = [];
  for (let index = 0; index < CILIA; index += 1) {
    // Golden-ratio distribution preserves full coverage when mobile drawRange
    // renders fewer cilia. Every root has exactly the membrane's t and side.
    const t = 0.015 + ((index * 0.61803398875) % 1) * 0.97;
    const side = index % 2 ? 1 : -1;
    for (let segment = 0; segment < CILIA_SEGMENTS; segment += 1) {
      parameters.push(t, segment / CILIA_SEGMENTS, side, t, (segment + 1) / CILIA_SEGMENTS, side);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(parameters.length), 3));
  geometry.setAttribute('aCilium', new THREE.Float32BufferAttribute(parameters, 3));
  return geometry;
}

/**
 * Drop-in factory name retained for scene.js. setProgress takes a shape 0..3:
 * coiled orb, continuous S-ribbon, five connected circuit lanes, ember farewell.
 * The host owns scroll anchors, camera projection, RAF, pausing and resources.
 */
export function createFluidVortex({ trackGeometry, trackMaterial, colors, compact = false }) {
  const group = new THREE.Group();
  group.name = 'ember-chrysalis';
  const uniforms = {
    uShape: { value: 0 }, uTime: { value: 0 }, uEnergy: { value: 0 },
    uPointer: { value: new THREE.Vector4(0, 0, 0, 0) },
    uPointerImpulse: { value: new THREE.Vector2() },
    uTwist: { value: 0 }, uWorkTravel: { value: 0 },
    uHover: { value: 0.5 }, uHoverStrength: { value: 0 },
    uCopper: { value: new THREE.Color() }, uCream: { value: new THREE.Color() },
    uEmber: { value: new THREE.Color() }, uAccent: { value: new THREE.Color() },
    uOpacity: { value: 0.9 }, uLineOpacity: { value: 0.48 },
    uPatchCount: { value: PATCHES }, uDpr: { value: 1 }, uResolution: { value: new THREE.Vector2(1, 1) },
  };
  const material = (vertexShader, fragmentShader) => trackMaterial(new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, forceSinglePass: true,
    blending: THREE.NormalBlending, toneMapped: false,
  }));
  const membrane = new THREE.Mesh(makeMembrane(trackGeometry), material(membraneVertex, membraneFragment));
  membrane.name = 'continuous-membrane';
  const cilia = new THREE.LineSegments(makeCilia(trackGeometry), material(ciliaVertex, ciliaFragment));
  cilia.name = 'edge-cilia';
  const heartMaterial = trackMaterial(new THREE.MeshStandardMaterial({
    roughness: 0.4, metalness: 0.55, emissiveIntensity: 0.15,
    transparent: true, opacity: 0.62, depthWrite: false,
  }));
  const heart = new THREE.Mesh(trackGeometry(new THREE.IcosahedronGeometry(0.23, 1)), heartMaterial);
  heart.name = 'ember-heart';
  membrane.frustumCulled = cilia.frustumCulled = false;
  group.add(membrane, cilia, heart);

  let disposed = false;
  let lastTime = null;
  let ciliaCount = CILIA;
  let lowPower = compact;
  let pointerX = 0;
  let pointerY = 0;
  let pointerStrength = 0;
  let pointerVelocity = 0;
  let pointerAge = 10;
  let targetStrength = 0;
  let hoverTarget = 0;
  let twistTarget = 0;
  let workTarget = 0;
  let lightTheme = false;

  const setTheme = (next) => {
    if (disposed) return;
    const bg = new THREE.Color(next.bg);
    lightTheme = bg.r * 0.2126 + bg.g * 0.7152 + bg.b * 0.0722 > 0.5;
    // Copper identity in every mode; dark-theme CSS colors themselves are not
    // changed. Light paper needs darker copper ink, not additive white glow.
    uniforms.uAccent.value.set(next.accent);
    uniforms.uCopper.value.set(lightTheme ? '#A94E30' : '#C65D3A');
    uniforms.uCream.value.set(lightTheme ? '#E48A4C' : '#FFE9C9');
    uniforms.uEmber.value.set(lightTheme ? '#B9572F' : '#E48A4C');
    uniforms.uOpacity.value = lightTheme ? 0.94 : 0.92;
    uniforms.uLineOpacity.value = lightTheme ? 0.65 : 0.48;
    heartMaterial.color.copy(uniforms.uCopper.value);
    heartMaterial.emissive.copy(uniforms.uEmber.value);
  };

  const resize = (width, height, dpr, nextCompact = compact) => {
    if (disposed) return;
    lowPower = Boolean(nextCompact);
    const ratio = clamp(finite(dpr, 1), 0.5, lowPower ? 1.5 : 2);
    uniforms.uResolution.value.set(Math.max(1, finite(width, 1) * ratio), Math.max(1, finite(height, 1) * ratio));
    uniforms.uDpr.value = ratio;
    // The membrane topology never changes with state or screen size. Only the
    // decorative cilia draw count changes; no missing intervals in the ribbon.
    ciliaCount = lowPower ? 110 : CILIA;
    cilia.geometry.setDrawRange(0, ciliaCount * CILIA_SEGMENTS * 2);
  };

  const setProgress = (shape, workTravel = workTarget) => {
    if (disposed) return;
    uniforms.uShape.value = clamp(finite(shape), 0, 3);
    workTarget = clamp(finite(workTravel), 0, 1);
  };

  const setPointer = (x, y, active = true) => {
    if (disposed || lowPower) return;
    if (!active) { targetStrength = 0; return; }
    const nextX = clamp(finite(x), -12, 12);
    const nextY = clamp(finite(y), -12, 12);
    const dx = nextX - pointerX;
    const dy = nextY - pointerY;
    // Repeated events at the same coordinate must not keep an idle dent alive.
    if (Math.hypot(dx, dy) > 0.0001) {
      uniforms.uPointerImpulse.value.set(clamp(dx, -1, 1), clamp(dy, -1, 1));
      pointerAge = 0;
      targetStrength = 1;
    }
    pointerX = nextX; pointerY = nextY;
    uniforms.uPointer.value.x = nextX; uniforms.uPointer.value.y = nextY;
  };
  const setHover = (segment = -1) => {
    if (disposed) return;
    hoverTarget = segment >= 0 && !lowPower ? 1 : 0;
    if (hoverTarget) uniforms.uHover.value = clamp(finite(segment, 0.5), 0, 1);
  };
  const setScrollVelocity = (velocity) => { if (!disposed) twistTarget = clamp(finite(velocity), -1, 1); };
  const resetInteraction = () => {
    targetStrength = pointerStrength = pointerVelocity = hoverTarget = twistTarget = 0;
    pointerAge = 10;
    uniforms.uPointer.value.z = uniforms.uPointer.value.w = 0;
    uniforms.uPointerImpulse.value.set(0, 0);
    uniforms.uHoverStrength.value = uniforms.uEnergy.value = uniforms.uTwist.value = 0;
    lastTime = null;
  };

  // Legacy expansion argument intentionally ignored: it cannot distinguish work
  // from hero. setProgress carries the existing controller's section identity.
  const update = (time, _legacyExpansion = 1, energy = 0) => {
    if (disposed) return;
    const now = Math.max(0, finite(time));
    const delta = lastTime === null ? 0 : clamp(now - lastTime, 0, 0.05);
    lastTime = now;
    pointerAge += delta;
    if (pointerAge > 0.06) targetStrength = 0;
    [pointerStrength, pointerVelocity] = settle(pointerStrength, pointerVelocity, targetStrength, delta);
    const response = 1 - Math.exp(-6 * delta);
    uniforms.uPointer.value.z = lowPower ? 0 : pointerStrength;
    uniforms.uPointer.value.w = lowPower ? 0 : pointerStrength;
    uniforms.uPointerImpulse.value.multiplyScalar(Math.exp(-7.3 * delta));
    uniforms.uEnergy.value += (clamp(finite(energy), 0, 1) - uniforms.uEnergy.value) * response;
    uniforms.uTwist.value += (twistTarget - uniforms.uTwist.value) * response;
    twistTarget *= Math.exp(-4 * delta);
    uniforms.uWorkTravel.value += (workTarget - uniforms.uWorkTravel.value) * response;
    uniforms.uHoverStrength.value += (hoverTarget - uniforms.uHoverStrength.value) * response;
    uniforms.uTime.value = now;
    const orbPresence = 1 - THREE.MathUtils.smoothstep(uniforms.uShape.value, 0.15, 0.85);
    heart.scale.setScalar(orbPresence * (1 + Math.sin(now * 1.65) * 0.045));
    heart.rotation.set(now * 0.08, now * 0.13, 0);
    heartMaterial.opacity = (lightTheme ? 0.56 : 0.62) * orbPresence;
    // Don't submit an invisible heart after uncoiling.
    heart.visible = orbPresence > 0.001;
  };

  setTheme(colors);
  resize(1, 1, 1, compact);
  update(0);
  return {
    group, setTheme, resize, update, setProgress, setPointer, setHover, setScrollVelocity, resetInteraction,
    dispose() {
      if (disposed) return;
      disposed = true;
      // Geometry/material lifetime remains with the existing scene tracker.
      group.visible = false;
    },
    get expansion() { return 1 - uniforms.uShape.value / 3; },
    get shape() { return uniforms.uShape.value; },
    get strandCount() { return 1; },
    get ciliaCount() { return ciliaCount; },
    get scatterCount() { return 0; },
    get drawCalls() { return heart.visible ? 3 : 2; },
    get pointerStrength() { return uniforms.uPointer.value.z; },
    get hoverStrength() { return uniforms.uHoverStrength.value; },
    get energy() { return uniforms.uEnergy.value; },
  };
}
