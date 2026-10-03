import test from 'node:test';
import assert from 'node:assert/strict';
import { FluidField } from '../src/fluid-field.js';
import { createFluidParticles } from '../src/fluid-particles.js';
import { createFluidVortex } from '../src/fluid-vortex.js';

const palettes = [
  { accent: '#2DD4BF', highlight: '#F59E0B', bg: '#070A12' },
  { accent: '#A78BFA', highlight: '#FB7185', bg: '#0B0713' },
  { accent: '#E4572E', highlight: '#2E5E4E', bg: '#FAF7F2' },
];
function resources(t) {
  const geometries = [];
  const materials = [];
  t.after(() => [...geometries, ...materials].forEach((resource) => resource.dispose()));
  return {
    trackGeometry: (geometry) => { geometries.push(geometry); return geometry; },
    trackMaterial: (material) => { materials.push(material); return material; },
    colors: palettes[0], compact: false,
  };
}
const finite = (values) => Array.from(values).every(Number.isFinite);

test('fluid remains bounded under repeated opposite impulses and settles', () => {
  const field = new FluidField(100, 100);
  assert.equal(field.columns, 48);
  assert.equal(field.rows, 36);
  for (let frame = 0; frame < 300; frame += 1) {
    field.splat((frame % 20) / 19, (frame % 30) / 29, frame % 2 ? 10 : -10, 10, 0.3, 1, 1.6);
    field.step(frame % 2 ? 1 / 60 : 5);
    assert.ok(finite(field.u) && finite(field.v));
    assert.ok([...field.u, ...field.v].every((velocity) => Math.abs(velocity) <= 0.801));
  }
  const energy = () => [...field.u, ...field.v].reduce((total, value) => total + value * value, 0);
  const initialEnergy = energy();
  for (let frame = 0; frame < 240; frame += 1) field.step(1 / 30);
  assert.ok(energy() < initialEnergy * 0.01);
  field.clear();
  assert.equal(energy(), 0);
  assert.equal(field.sample(field.u, -1, 2), 0);
});

test('pointer particles stay bounded, reset energy, and switch mobile budgets', (t) => {
  const particles = createFluidParticles(resources(t));
  const geometry = particles.points.geometry;
  const initial = geometry.attributes.position.array.slice();
  particles.resize(1440, 900, 4, false);
  for (let frame = 0; frame < 180; frame += 1) {
    particles.pointerMove((frame % 9) / 8, (frame % 13) / 12, frame * 16);
    particles.scroll(frame % 2 ? 3000 : -3000, 900);
    particles.update(frame % 7 ? 1 / 60 : 8);
  }
  assert.notDeepEqual(geometry.attributes.position.array, initial);
  assert.ok(finite(geometry.attributes.position.array));
  assert.ok(geometry.attributes.position.array.every((value) => value >= 0 && value <= 1));
  assert.ok(particles.energy > 0 && particles.energy <= 1);
  particles.resetInteraction();
  assert.equal(particles.energy, 0);
  particles.resize(320, 640, 4, true);
  assert.equal(particles.count, 160);
  assert.equal(geometry.drawRange.count, 160);
  assert.equal(particles.points.material.uniforms.uDpr.value, 1.5);
  particles.resize(1440, 900, 4, false);
  assert.equal(particles.count, 480);
  assert.equal(particles.points.material.uniforms.uDpr.value, 2);
});

test('one continuous membrane reversibly morphs while retaining its geometry and attached cilia', (t) => {
  const organism = createFluidVortex(resources(t));
  t.after(() => organism.dispose());
  const [membrane, cilia, heart] = organism.group.children;
  assert.equal(organism.group.children.length, 3);
  assert.ok(cilia.isLineSegments);
  assert.equal(heart.geometry.type, 'IcosahedronGeometry');
  assert.equal(organism.strandCount, 1);
  assert.equal(organism.ciliaCount, 220);
  assert.equal(organism.scatterCount, 0);
  const positions = membrane.geometry.attributes.position.array.slice();
  const ciliaParameters = cilia.geometry.attributes.aCilium.array.slice();
  const patches = membrane.geometry.attributes.aPatch.array;
  // Every patch is the next interval on one global ribbon, without gaps or
  // overlapping independent curves. Mobile retains the same connected strip.
  assert.deepEqual(Array.from(patches), Array.from({ length: patches.length }, (_, i) => i));
  for (const shape of [0, 0.4, 1, 1.8, 2, 2.6, 3, 2, 1, 0]) {
    organism.setProgress(shape);
    organism.update(4);
    assert.equal(organism.shape, shape);
    assert.equal(membrane.material.uniforms.uShape, cilia.material.uniforms.uShape);
    assert.equal(membrane.material.uniforms.uPointer, cilia.material.uniforms.uPointer);
    assert.equal(heart.visible, shape < 0.85);
    assert.equal(organism.drawCalls, shape < 0.85 ? 3 : 2);
    assert.deepEqual(membrane.geometry.attributes.position.array, positions);
    assert.deepEqual(cilia.geometry.attributes.aCilium.array, ciliaParameters);
  }
  for (const invalid of [NaN, Infinity, -10, 10]) {
    organism.setProgress(invalid);
    assert.ok(Number.isFinite(organism.shape) && organism.shape >= 0 && organism.shape <= 3);
  }
});

test('local pointer dent spring-settles, hover pulses, and reset prevents stale impulses', (t) => {
  const organism = createFluidVortex(resources(t));
  const [membrane] = organism.group.children;
  organism.setProgress(1);
  organism.setPointer(1, 0.5);
  organism.setHover(0.35);
  organism.setScrollVelocity(1);
  for (let i = 1; i <= 12; i += 1) organism.update(i / 60, 1, 1);
  const peak = organism.pointerStrength;
  assert.ok(peak > 0.05 && peak <= 1);
  assert.equal(membrane.material.uniforms.uPointer.value.x, 1);
  assert.ok(organism.hoverStrength > 0.6);
  assert.ok(organism.energy > 0.5);
  for (let i = 13; i <= 60; i += 1) organism.update(i / 60, 1, 0);
  assert.ok(organism.pointerStrength < peak * 0.05, 'dent settles within ~0.8s after movement');
  organism.resetInteraction();
  assert.equal(organism.pointerStrength, 0);
  assert.equal(organism.hoverStrength, 0);
  assert.equal(organism.energy, 0);
  organism.update(99, 1, 0);
  assert.equal(organism.pointerStrength, 0, 'resuming after hidden tab does not replay old forces');
});

test('mobile auto-drift ignores pointer input, caps DPR, and does not break the ribbon', (t) => {
  const organism = createFluidVortex(resources(t));
  const [membrane, cilia] = organism.group.children;
  const topology = membrane.geometry.instanceCount;
  organism.resize(375, 812, 4, true);
  organism.setPointer(1, 1);
  for (let i = 1; i < 60; i += 1) organism.update(i / 60);
  assert.equal(organism.pointerStrength, 0);
  assert.equal(organism.ciliaCount, 110);
  assert.equal(cilia.geometry.drawRange.count, 110 * 6 * 2);
  assert.equal(membrane.geometry.instanceCount, topology);
  assert.equal(membrane.material.uniforms.uDpr.value, 1.5);
  assert.ok(membrane.material.uniforms.uTime.value > 0, 'auto-drift continues');
  organism.resize(1920, 1080, 4, false);
  assert.equal(organism.ciliaCount, 220);
  assert.equal(membrane.material.uniforms.uDpr.value, 2);
});

test('copper identity remains visible across palettes and disposal is idempotent', (t) => {
  const organism = createFluidVortex(resources(t));
  const [membrane, cilia, heart] = organism.group.children;
  for (const palette of palettes) {
    organism.setTheme(palette);
    assert.equal(membrane.material.uniforms.uAccent.value.getHexString(), palette.accent.slice(1).toLowerCase());
    assert.equal(membrane.material.blending, 1, 'normal blending remains readable on light background');
    assert.equal(cilia.material.uniforms.uCopper, membrane.material.uniforms.uCopper);
    assert.equal(heart.material.color.getHexString(), membrane.material.uniforms.uCopper.value.getHexString());
  }
  assert.equal(membrane.material.uniforms.uCopper.value.getHexString(), 'a94e30');
  organism.dispose(); organism.dispose();
  organism.setProgress(1);
  organism.update(1);
  assert.equal(organism.group.visible, false);
  assert.equal(organism.shape, 0);
});
