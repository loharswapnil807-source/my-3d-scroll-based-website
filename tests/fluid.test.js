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

test('fluid remains bounded under repeated opposite pointer/scroll impulses and settles', () => {
  const field = new FluidField(100, 100);
  assert.equal(field.columns, 48);
  assert.equal(field.rows, 36);
  for (let frame = 0; frame < 300; frame += 1) {
    field.splat((frame % 20) / 19, (frame % 30) / 29, frame % 2 ? 10 : -10, 10, 0.3, 1, 1.6);
    field.step(frame % 2 ? 1 / 60 : 5); // long background gaps are bounded too
    assert.ok(finite(field.u) && finite(field.v));
    assert.ok([...field.u, ...field.v].every((velocity) => Math.abs(velocity) <= 0.801));
  }
  assert.ok(field.u.some((velocity) => velocity !== 0));
  const energy = () => [...field.u, ...field.v].reduce((total, v) => total + v * v, 0);
  const initialEnergy = energy();
  for (let frame = 0; frame < 240; frame += 1) field.step(1 / 30);
  assert.ok(energy() < initialEnergy * 0.01, 'undriven field dissipates rather than exploding');
  field.clear();
  assert.equal(energy(), 0);
  assert.equal(field.sample(field.u, -1, 2), 0);
});

test('particles react, stay on screen, reset input energy, and switch to mobile budgets', (t) => {
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
  for (const palette of palettes) {
    particles.setTheme(palette);
    assert.equal(particles.points.material.uniforms.uAccent.value.getHexString(), palette.accent.slice(1).toLowerCase());
  }
});

test('vortex wrapping is reversible and nearby solid fragments animate without rebuilding ribbons', (t) => {
  const vortex = createFluidVortex(resources(t));
  t.after(() => vortex.dispose());
  const [, ribbons, shards, satellites] = vortex.group.children;
  const ribbonPositions = ribbons.geometry.attributes.position.array.slice();
  vortex.update(4, 1, 0.4);
  const expanded = shards.instanceMatrix.array.slice();
  vortex.update(4, 0, 0.4);
  assert.notDeepEqual(shards.instanceMatrix.array, expanded);
  assert.equal(vortex.expansion, 0);
  vortex.update(4, 1, 0.4);
  assert.deepEqual(shards.instanceMatrix.array, expanded);
  vortex.update(5, 1, 0.4);
  assert.notDeepEqual(shards.instanceMatrix.array, expanded);
  for (const expansion of [-1, 0, 0.001, 0.5, 1, 2]) {
    vortex.update(10000, expansion, 4);
    assert.ok(vortex.expansion >= 0 && vortex.expansion <= 1);
    assert.ok(finite(shards.instanceMatrix.array) && finite(satellites.instanceMatrix.array));
  }
  assert.deepEqual(ribbons.geometry.attributes.position.array, ribbonPositions);
});

test('vortex preserves all palettes, caps DPR, restores desktop detail, and releases instances', (t) => {
  const vortex = createFluidVortex(resources(t));
  const [, ribbons, shards, satellites] = vortex.group.children;
  for (const palette of palettes) {
    vortex.setTheme(palette);
    assert.equal(ribbons.material.uniforms.uAccent.value.getHexString(), palette.accent.slice(1).toLowerCase());
    assert.equal(shards.material.color.getHexString(), palette.accent.slice(1).toLowerCase());
    assert.equal(satellites.material.color.getHexString(), palette.highlight.slice(1).toLowerCase());
  }
  vortex.resize(375, 812, 4, true);
  assert.equal(vortex.strandCount, 144);
  assert.equal(vortex.scatterCount, 16);
  assert.equal(ribbons.material.uniforms.uDpr.value, 1.5);
  vortex.resize(1920, 1080, 4, false);
  assert.equal(vortex.strandCount, 320);
  assert.equal(vortex.scatterCount, 38);
  assert.equal(ribbons.material.uniforms.uDpr.value, 2);
  let disposed = 0;
  for (const mesh of [shards, satellites]) mesh.addEventListener('dispose', () => { disposed += 1; });
  vortex.dispose();
  assert.equal(disposed, 2);
});
