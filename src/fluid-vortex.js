import * as THREE from 'three';

const TAU = Math.PI * 2;
const MAX_STRANDS = 320;
const MOBILE_STRANDS = 144;
const SEGMENTS = 112;
const MAX_SCATTER = 30;
const MOBILE_SCATTER = 12;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// All streamlines are evaluated on the GPU. The CPU only moves the small,
// bounded collection of solid fragments; there are no textures or readbacks.
const vertexShader = `
  attribute vec4 aSeed;
  attribute float aKind;
  uniform float uTime;
  uniform float uExpansion;
  uniform float uEnergy;
  uniform float uDpr;
  uniform float uGlow;
  uniform vec2 uResolution;
  varying float vAcross;
  varying float vAlong;
  varying float vHeight;
  varying float vLight;
  varying float vSeed;
  varying float vKind;
  const float TAU = 6.28318530718;

  vec3 streamline(float t) {
    float open = smoothstep(0.0, 1.0, uExpansion);
    float phase = aSeed.x * TAU;
    float drift = uTime * (0.44 + aSeed.y * 0.2);
    float y;
    float radius;
    float angle;

    if (aKind < 0.5) {
      // Nested helical sheets form the body and gather at both luminous poles.
      y = (t * 2.0 - 1.0) * (3.95 + aSeed.z * 0.25);
      float bell = pow(max(0.0, sin(t * 3.14159265359)), 1.7);
      float layer = 0.48 + aSeed.y * 0.52;
      radius = 0.006 + bell * (0.045 + open * 1.96 * layer);
      float turns = 5.2 + aSeed.z * 1.3 + (1.0 - open) * 3.8;
      angle = phase + t * TAU * turns - drift;
      radius *= 1.0 + open * 0.055 * sin(t * 24.0 + phase - uTime * 0.7);
    } else {
      // Shorter swept trails curl away from the sheet. Their staggered ends
      // produce the feathered toroidal silhouette rather than a solid cone.
      float latitude = (aSeed.z * 2.0 - 1.0) * 0.82;
      float sweep = t - 0.5;
      float height = latitude + sweep * (0.12 + aSeed.w * 0.22);
      y = height * 3.65;
      float bell = pow(max(0.0, 1.0 - height * height), 1.65);
      float unfurl = pow(t, 1.5);
      float layer = 0.79 + aSeed.y * 0.21;
      radius = 0.012 + bell * 0.043;
      radius += open * bell * (1.9 * layer + unfurl * (0.55 + aSeed.w * 0.9));
      angle = phase + latitude * 9.0 - drift;
      angle += t * (2.2 + aSeed.y * 1.8 + (1.0 - open) * 5.0);
      y += open * bell * (0.14 * sin(t * 4.0 + phase) - unfurl * 0.26);
      radius += open * bell * 0.045 * sin(t * 12.0 + phase + uTime * 0.8);
    }

    // A subtle living axis: never tilt the spindle away from its vertical form.
    float bend = open * 0.035 * sin(y * 1.4 + uTime * 0.55);
    radius *= 1.0 + uEnergy * open * 0.035;
    return vec3(cos(angle) * radius + bend, y, sin(angle) * radius);
  }

  void main() {
    float t = position.x;
    vec3 p = streamline(t);
    // Screen-facing ribbon widths remain legible without platform line-width
    // extensions. The finite difference only evaluates two analytical points.
    float step = t > 0.998 ? -0.002 : 0.002;
    vec3 next = streamline(t + step);
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * viewPosition;
    vec4 tangent = projectionMatrix * modelViewMatrix * vec4((next - p) * sign(step), 0.0);
    vec2 direction = tangent.xy * uResolution;
    direction /= max(length(direction), 0.00001);
    vec2 normal = vec2(-direction.y, direction.x);
    float taper = pow(max(0.0, sin(t * 3.14159265359)), 0.28);
    float width = mix(1.25, 1.85, aSeed.w) * mix(0.38, 1.0, taper);
    width *= mix(1.0, 0.48 + 0.52 * (1.0 - t), aKind);
    width *= mix(1.0, 4.8, uGlow) * uDpr;
    clip.xy += normal * position.y * width / uResolution * clip.w;
    gl_Position = clip;
    vAcross = position.y;
    vAlong = t;
    vHeight = p.y / 4.2;
    vLight = 0.48 + 0.52 * smoothstep(-1.8, 1.8, p.z);
    vSeed = aSeed.y;
    vKind = aKind;
  }
`;

const fragmentShader = `
  uniform vec3 uAccent;
  uniform vec3 uHighlight;
  uniform vec3 uTip;
  uniform float uExpansion;
  uniform float uGlow;
  uniform float uOpacity;
  uniform float uTime;
  varying float vAcross;
  varying float vAlong;
  varying float vHeight;
  varying float vLight;
  varying float vSeed;
  varying float vKind;

  void main() {
    float edge = 1.0 - smoothstep(0.35, 1.0, abs(vAcross));
    float ends = smoothstep(0.0, 0.025, vAlong) * (1.0 - smoothstep(0.88, 1.0, vAlong));
    float feather = mix(1.0, smoothstep(0.015, 0.28, uExpansion), vKind);
    float pole = smoothstep(0.32, 0.91, abs(vHeight));
    float pulse = 0.86 + 0.14 * sin(vAlong * 35.0 - uTime * 2.0 + vSeed * 12.0);
    vec3 color = mix(uAccent, uHighlight, vSeed * 0.3 + pole * 0.4);
    color = mix(color, uTip, pole * pole * 0.94);
    // The contracted filament brightens, while light themes retain colored ink.
    color = mix(color, uTip, (1.0 - smoothstep(0.0, 0.3, uExpansion)) * 0.65);
    float alpha = edge * ends * feather * vLight * pulse * uOpacity;
    alpha *= mix(0.83, 0.075, uGlow);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

function makeRibbonGeometry(trackGeometry, random) {
  const geometry = trackGeometry(new THREE.InstancedBufferGeometry());
  const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
  const indices = new Uint16Array(SEGMENTS * 6);
  for (let segment = 0; segment <= SEGMENTS; segment += 1) {
    const offset = segment * 6;
    positions[offset] = positions[offset + 3] = segment / SEGMENTS;
    positions[offset + 1] = -1;
    positions[offset + 4] = 1;
    if (segment < SEGMENTS) {
      const vertex = segment * 2;
      indices.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3], offset);
    }
  }
  const seeds = new Float32Array(MAX_STRANDS * 4);
  const kinds = new Float32Array(MAX_STRANDS);
  for (let index = 0; index < MAX_STRANDS; index += 1) {
    seeds.set([random(), random(), random(), random()], index * 4);
    // Interleave full-height helices and shorter feathers so mobile LOD retains
    // the same shape, instead of accidentally drawing only the inner core.
    kinds[index] = index % 4 === 0 ? 0 : 1;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

/** A reversible, scroll-shaped 3D vortex driven by the scene's single RAF. */
export function createFluidVortex({ trackGeometry, trackMaterial, colors, compact }) {
  let seed = 24681;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const group = new THREE.Group();
  group.name = 'fluid-vortex';
  const geometry = makeRibbonGeometry(trackGeometry, random);
  const uniforms = {
    uAccent: { value: new THREE.Color() },
    uHighlight: { value: new THREE.Color() },
    uTip: { value: new THREE.Color() },
    uTime: { value: 0 },
    uExpansion: { value: 1 },
    uEnergy: { value: 0 },
    uDpr: { value: 1 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uOpacity: { value: 1 },
  };
  const makeMaterial = (glow) => trackMaterial(new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uGlow: { value: glow ? 1 : 0 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // Normal blending is deliberate: additive-only light disappears on warm.
    blending: THREE.NormalBlending,
    toneMapped: false,
    forceSinglePass: true,
  }));
  const halo = new THREE.Mesh(geometry, makeMaterial(true));
  const ribbons = new THREE.Mesh(geometry, makeMaterial(false));
  halo.frustumCulled = ribbons.frustumCulled = false;
  halo.renderOrder = 0;
  ribbons.renderOrder = 1;
  group.add(halo, ribbons);

  const shardMaterial = trackMaterial(new THREE.MeshStandardMaterial({
    metalness: 0.38,
    roughness: 0.3,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.84,
  }));
  const satelliteMaterial = trackMaterial(new THREE.MeshStandardMaterial({
    metalness: 0.5,
    roughness: 0.26,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.72,
  }));
  const shards = new THREE.InstancedMesh(
    trackGeometry(new THREE.OctahedronGeometry(1, 0)), shardMaterial, MAX_SCATTER,
  );
  const satellites = new THREE.InstancedMesh(
    trackGeometry(new THREE.TetrahedronGeometry(1, 0)), satelliteMaterial, 8,
  );
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  satellites.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shards.frustumCulled = satellites.frustumCulled = false;
  group.add(shards, satellites);
  const scatterSeeds = Array.from({ length: MAX_SCATTER + 8 }, () => ({
    phase: random() * TAU,
    height: random() * TAU,
    radius: random(),
    size: 0.032 + random() * 0.047,
    speed: 0.32 + random() * 0.24,
  }));
  const dummy = new THREE.Object3D();
  const white = new THREE.Color(1, 1, 1);
  const background = new THREE.Color();

  const setTheme = (next) => {
    uniforms.uAccent.value.set(next.accent);
    uniforms.uHighlight.value.set(next.highlight);
    background.set(next.bg);
    const lightTheme = background.r * 0.2126 + background.g * 0.7152 + background.b * 0.0722 > 0.5;
    uniforms.uTip.value.copy(uniforms.uAccent.value)
      .lerp(uniforms.uHighlight.value, 0.28).lerp(white, lightTheme ? 0.13 : 0.82);
    uniforms.uOpacity.value = lightTheme ? 0.87 : 1;
    shardMaterial.color.set(next.accent);
    shardMaterial.emissive.set(next.accent);
    satelliteMaterial.color.set(next.highlight);
    satelliteMaterial.emissive.set(next.highlight);
  };

  const resize = (width, height, dpr, lowPower) => {
    const ratio = Math.min(dpr, lowPower ? 1.5 : 2);
    uniforms.uResolution.value.set(Math.max(1, width * ratio), Math.max(1, height * ratio));
    uniforms.uDpr.value = ratio;
    geometry.instanceCount = lowPower ? MOBILE_STRANDS : MAX_STRANDS;
    shards.count = lowPower ? MOBILE_SCATTER : MAX_SCATTER;
    satellites.count = lowPower ? 4 : 8;
  };

  const update = (time, expansion, energy = 0) => {
    const open = clamp(expansion, 0, 1);
    uniforms.uTime.value = time;
    uniforms.uExpansion.value = open;
    uniforms.uEnergy.value = clamp(energy, 0, 1);
    for (let index = 0; index < shards.count + satellites.count; index += 1) {
      const satellite = index >= shards.count;
      const localIndex = satellite ? index - shards.count : index;
      const settings = scatterSeeds[satellite ? MAX_SCATTER + localIndex : index];
      const angle = settings.phase + time * settings.speed + (1 - open) * 2.1;
      const y = Math.sin(settings.height + time * 0.18) * 3.4;
      const envelope = 0.42 + 0.58 * Math.sqrt(Math.max(0, 1 - (y / 3.8) ** 2));
      const radius = (1.25 + settings.radius * 1.7) * (0.58 + open * 0.48) * envelope;
      dummy.position.set(Math.cos(angle + y * 0.55) * radius, y, Math.sin(angle + y * 0.55) * radius);
      dummy.rotation.set(angle * 0.7, angle * 1.2 + settings.height, angle * 0.4);
      dummy.scale.set(settings.size, settings.size * (satellite ? 1 : 1.65), settings.size);
      dummy.updateMatrix();
      (satellite ? satellites : shards).setMatrixAt(localIndex, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
    satellites.instanceMatrix.needsUpdate = true;
  };

  setTheme(colors);
  resize(1, 1, 1, compact);
  update(0, 1);
  return {
    group,
    update,
    resize,
    setTheme,
    // InstancedMesh owns GPU instance buffers in addition to the shared geometry
    // and material resources disposed by the scene's existing resource tracker.
    dispose() {
      shards.dispose();
      satellites.dispose();
    },
    get expansion() { return uniforms.uExpansion.value; },
    get strandCount() { return geometry.instanceCount; },
    get scatterCount() { return shards.count + satellites.count; },
  };
}
