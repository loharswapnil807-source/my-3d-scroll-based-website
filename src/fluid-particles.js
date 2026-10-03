import * as THREE from 'three';
import { FluidField } from './fluid-field.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const STEP = 1 / 30;
const MAX_PARTICLES = 480;

/** One screen-space draw call, advanced only by the scene's existing RAF. */
export function createFluidParticles({ trackGeometry, trackMaterial, colors, compact }) {
  let seed = 9183;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const homes = new Float32Array(MAX_PARTICLES * 2);
  const velocities = new Float32Array(MAX_PARTICLES * 2);
  const phases = new Float32Array(MAX_PARTICLES);
  const sizes = new Float32Array(MAX_PARTICLES);
  const energies = new Float32Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    homes[i * 2] = positions[i * 3] = 0.02 + random() * 0.96;
    homes[i * 2 + 1] = positions[i * 3 + 1] = 0.02 + random() * 0.96;
    phases[i] = random();
    sizes[i] = 10 + random() * 10;
  }

  const geometry = trackGeometry(new THREE.BufferGeometry());
  const positionAttribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const energyAttribute = new THREE.BufferAttribute(energies, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aEnergy', energyAttribute);
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = trackMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uAccent: { value: new THREE.Color(colors.accent) },
      uHighlight: { value: new THREE.Color(colors.highlight) },
      uDpr: { value: 1 },
      uOpacity: { value: compact ? 0.62 : 0.86 },
    },
    vertexShader: `
      attribute float aEnergy;
      attribute float aPhase;
      attribute float aSize;
      uniform float uDpr;
      varying float vEnergy;
      varying float vPhase;
      void main() {
        vEnergy = aEnergy;
        vPhase = aPhase;
        // Screen coordinates keep cursor attraction accurate as the camera orbits.
        gl_Position = vec4(position.xy * 2.0 - 1.0, 0.0, 1.0);
        gl_PointSize = min(54.0, aSize * uDpr * (1.0 + aEnergy * 0.65));
      }
    `,
    fragmentShader: `
      uniform vec3 uAccent;
      uniform vec3 uHighlight;
      uniform float uOpacity;
      varying float vEnergy;
      varying float vPhase;
      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float radius2 = dot(point, point);
        if (radius2 > 1.0) discard;
        float glow = exp(-radius2 * 4.0) * 0.15;
        float core = exp(-radius2 * 34.0) * 0.86;
        float edge = 1.0 - smoothstep(0.65, 1.0, radius2);
        vec3 tint = mix(uAccent, uHighlight, vPhase * 0.65);
        tint = mix(tint, vec3(1.0), vEnergy * 0.22);
        float alpha = (glow + core) * edge * (0.46 + vEnergy * 0.48) * uOpacity;
        gl_FragColor = vec4(tint, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    // Normal blending also preserves colored dots on the warm/light theme.
    blending: THREE.NormalBlending,
  }));
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 2;

  let lowPower = compact;
  let count = compact ? 160 : MAX_PARTICLES;
  let field = new FluidField(compact ? 22 : 36, compact ? 16 : 24);
  let aspect = 1;
  let accumulator = 0;
  let elapsed = 0;
  let pointerActive = false;
  let pointerAge = 10;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let previousPointerTime = 0;
  let pointerForceX = 0;
  let pointerForceY = 0;
  let pointerEnergy = 0;
  let scrollEnergy = 0;
  let scrollForce = 0;
  geometry.setDrawRange(0, count);

  const resetInteraction = () => {
    pointerActive = false;
    pointerAge = 10;
    previousPointerTime = 0;
    pointerForceX = 0;
    pointerForceY = 0;
    pointerEnergy = 0;
    scrollEnergy = 0;
    scrollForce = 0;
    accumulator = 0;
    // No queued impulse or old fluid energy is replayed after pause/visibility.
    field.clear();
    velocities.fill(0);
  };

  return {
    points,
    get count() { return count; },
    get gridSize() { return `${field.columns}x${field.rows}`; },
    get energy() { return Math.max(pointerEnergy, scrollEnergy); },
    resize(width, height, dpr, nextCompact) {
      aspect = Math.max(0.25, width / Math.max(1, height));
      material.uniforms.uDpr.value = Math.min(dpr, nextCompact ? 1.5 : 2);
      material.uniforms.uOpacity.value = nextCompact ? 0.62 : 0.86;
      if (lowPower !== nextCompact) {
        lowPower = nextCompact;
        count = nextCompact ? 160 : MAX_PARTICLES;
        field = new FluidField(nextCompact ? 22 : 36, nextCompact ? 16 : 24);
        geometry.setDrawRange(0, count);
        resetInteraction();
      }
    },
    setTheme(next) {
      material.uniforms.uAccent.value.set(next.accent);
      material.uniforms.uHighlight.value.set(next.highlight);
    },
    pointerMove(x, y, time) {
      const nextX = clamp(x, 0, 1);
      const nextY = clamp(y, 0, 1);
      if (pointerActive) {
        const dt = clamp((time - previousPointerTime) / 1000, 1 / 120, 0.1);
        const dx = nextX - pointerX;
        const dy = nextY - pointerY;
        pointerForceX = clamp(pointerForceX + dx * 2, -0.22, 0.22);
        pointerForceY = clamp(pointerForceY + dy * 2, -0.22, 0.22);
        pointerEnergy = Math.min(1, pointerEnergy + Math.hypot(dx * aspect, dy) / dt * 0.13);
      }
      pointerX = nextX;
      pointerY = nextY;
      previousPointerTime = time;
      pointerActive = true;
      pointerAge = 0;
    },
    pointerLeave() {
      pointerActive = false;
      previousPointerTime = 0;
      pointerForceX = 0;
      pointerForceY = 0;
    },
    scroll(deltaY, height) {
      const impulse = clamp(deltaY / Math.max(1, height), -0.3, 0.3);
      scrollForce = clamp(scrollForce - impulse * 1.4, -0.28, 0.28);
      scrollEnergy = Math.min(1, scrollEnergy + Math.abs(impulse) * 3.4);
    },
    resetInteraction,
    update(delta) {
      const dt = clamp(delta, 0, 0.05);
      if (!dt) return;
      elapsed += dt;
      pointerAge += dt;
      const presence = pointerActive ? Math.exp(-Math.max(0, pointerAge - 1.4) * 0.7) : 0;
      // Scroll gathers into an off-copy eddy unless a fine pointer is present.
      const focusX = presence > 0.12 ? pointerX : lowPower ? 0.86 : 0.76;
      const focusY = presence > 0.12 ? pointerY : 0.48 + Math.sin(elapsed * 0.35) * 0.09;
      const gather = Math.min(1, presence * 0.82 + scrollEnergy * 0.88);
      const activity = Math.max(pointerEnergy, scrollEnergy);
      accumulator = Math.min(accumulator + dt, STEP * 2);
      while (accumulator >= STEP) {
        field.splat(0.28 + Math.sin(elapsed * 0.27) * 0.15, 0.58, 0, 0, 0.48, 0.035, aspect);
        field.splat(0.75, 0.36 + Math.cos(elapsed * 0.31) * 0.15, 0, 0, 0.42, -0.03, aspect);
        if (gather > 0.01) {
          field.splat(focusX, focusY, pointerForceX, pointerForceY + scrollForce,
            0.25 + scrollEnergy * 0.16, 0.055 * gather + activity * 0.05, aspect);
        }
        field.step(STEP);
        pointerForceX *= 0.45;
        pointerForceY *= 0.45;
        scrollForce *= 0.65;
        accumulator -= STEP;
      }

      const velocityBlend = 1 - Math.exp(-4.6 * dt);
      const energyBlend = 1 - Math.exp(-7 * dt);
      for (let i = 0; i < count; i += 1) {
        const p = i * 3;
        const v = i * 2;
        const phase = phases[i];
        const x = positions[p];
        const y = positions[p + 1];
        let targetVX = field.sample(field.u, x, y);
        let targetVY = field.sample(field.v, x, y);
        // Keep a third of the field scattered; the rest forms loose moving ribbons,
        // not an opaque cursor blob. Attraction is separate from incompressible flow.
        const attraction = phase < 0.7 ? gather : gather * 0.06;
        const angle = phase * Math.PI * 16 + elapsed * (0.34 + phase * 0.3);
        const radius = 0.045 + phase * 0.22;
        const targetX = clamp(focusX + Math.cos(angle) * radius / aspect, 0.015, 0.985);
        const targetY = clamp(focusY + Math.sin(angle) * radius * 0.74, 0.015, 0.985);
        targetVX += (targetX - x) * attraction * (0.75 + activity * 0.8);
        targetVY += (targetY - y) * attraction * (0.75 + activity * 0.8);
        const homeX = homes[v] + Math.sin(elapsed * 0.48 + phase * 18) * 0.075 / aspect;
        const homeY = homes[v + 1] + Math.cos(elapsed * 0.41 + phase * 13) * 0.065;
        targetVX += (homeX - x) * (1 - attraction) * 0.32;
        targetVY += (homeY - y) * (1 - attraction) * 0.32;
        velocities[v] += (clamp(targetVX, -0.55, 0.55) - velocities[v]) * velocityBlend;
        velocities[v + 1] += (clamp(targetVY, -0.55, 0.55) - velocities[v + 1]) * velocityBlend;
        positions[p] = clamp(x + velocities[v] * dt, 0.005, 0.995);
        positions[p + 1] = clamp(y + velocities[v + 1] * dt, 0.005, 0.995);
        const speed = Math.hypot(velocities[v] * aspect, velocities[v + 1]);
        const local = Math.max(0, 1 - Math.hypot((x - focusX) * aspect, y - focusY) / 0.38);
        const energy = clamp(speed * 1.9 + activity * local * 0.72 + attraction * local * 0.2, 0, 1);
        energies[i] += (energy - energies[i]) * energyBlend;
      }
      pointerEnergy *= Math.exp(-2.4 * dt);
      scrollEnergy *= Math.exp(-1.8 * dt);
      positionAttribute.needsUpdate = true;
      energyAttribute.needsUpdate = true;
    },
  };
}
