import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleJourney, sectionProgress } from '../src/journey.js';
import { createSiliconWorld } from '../src/silicon-world.js';

const palette = { bg: '#080c0e', accent: '#b8e8ef', highlight: '#e7f7fa', metal: '#52666d' };

test('camera travels forward through every project and reverses without accumulating offsets', () => {
  const positions = new Map();
  let previousZ = Infinity;
  for (let i = 0; i <= 400; i += 1) {
    const progress = i / 100;
    const position = sampleJourney(progress, false, new Float64Array(6));
    assert.ok(position.every(Number.isFinite));
    assert.ok(position[2] <= previousZ, `camera must travel forward at ${progress}`);
    assert.ok(position[2] > position[5], 'look target remains ahead of camera');
    positions.set(i, position);
    previousZ = position[2];
  }
  for (let i = 400; i >= 0; i -= 1) {
    assert.deepEqual(sampleJourney(i / 100, false, new Float64Array(6)), positions.get(i));
  }
  assert.ok(positions.get(200)[2] - positions.get(290)[2] > 20, 'Work travels through the environment');
  for (const invalid of [NaN, Infinity, -20, 20]) {
    assert.ok(sampleJourney(invalid, true, new Float64Array(6)).every(Number.isFinite));
  }
});

test('actual section measurements determine progress including deep links and resizes', () => {
  const anchors = [80, 1200, 2400, 7200, 8900];
  assert.equal(sectionProgress(0, anchors), 0);
  assert.equal(sectionProgress(2400, anchors), 2);
  assert.equal(sectionProgress(4800, anchors), 2.5);
  assert.equal(sectionProgress(20000, anchors), 4);
  assert.equal(sectionProgress(1200, [0, 600, 1200, 3600, 5000]), 2);
  assert.equal(sectionProgress(0, []), 0);
  const desktop = sampleJourney(0, false, new Float64Array(6));
  const mobile = sampleJourney(0, true, new Float64Array(6));
  assert.ok(mobile[2] > desktop[2], 'mobile camera pulls back to frame the aperture');
  assert.ok(mobile[4] < desktop[4], 'mobile camera leaves lower half for copy');
});

test('silicon world reuses finite geometry, adapts mobile detail, and releases each resource once', () => {
  const world = createSiliconWorld({ colors: palette });
  const geometries = new Set();
  const materials = new Set();
  const instanceMeshes = [];
  world.group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
    if (object.isInstancedMesh) instanceMeshes.push(object);
  });
  for (const geometry of geometries) assert.ok(geometry.attributes.position.array.every(Number.isFinite));
  assert.equal(instanceMeshes.length, 4, 'pins, towers, caps, and ports are instanced');
  const originalPortal = world.portal.matrix.clone();
  world.update(12, .05);
  world.portal.updateMatrix();
  assert.notDeepEqual(world.portal.matrix, originalPortal);
  assert.equal(world.particleCount, 1100);
  world.resize(375, 812, 4, true);
  assert.equal(world.particleCount, 440);
  const points = world.group.children.find(object => object.isPoints);
  assert.equal(points.geometry.drawRange.count, 440);
  assert.equal(points.material.uniforms.uDpr.value, 1.5);
  world.resize(1440, 960, 4, false);
  assert.equal(points.material.uniforms.uDpr.value, 2);
  world.setTheme({ ...palette, bg: '#eceae4', highlight: '#254a54' });
  assert.equal(points.material.uniforms.uColor.value.getHexString(), '254a54');
  world.setHover(true);
  for (let frame = 0; frame < 30; frame += 1) world.update(frame / 60, 1 / 60);
  assert.ok(world.hoverStrength > .8);
  world.resetInteraction();
  assert.equal(world.hoverStrength, 0);
  let disposals = 0;
  [...geometries, ...materials, ...instanceMeshes].forEach(resource => resource.addEventListener('dispose', () => { disposals += 1; }));
  world.dispose();
  world.dispose();
  assert.equal(disposals, geometries.size + materials.size + instanceMeshes.length);
  assert.equal(world.group.visible, false);
});
