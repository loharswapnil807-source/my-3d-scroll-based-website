// Physical camera positions through the same environment, in section order.
// Work has multiple stops so all five projects get forward travel, not a frozen backdrop.
const STOPS = [
  [0, 0, 1.1, 13.6, 1.2, .4, 0],
  [.55, 3.4, 1.0, 5.0, 2, .2, -14],
  [1, 3.0, 1.0, -7, 2, .3, -25],
  [2, .7, 1.5, -26, 2, -.3, -42],
  [2.23, 3.1, 1.0, -31, 1, -.3, -46],
  [2.46, .8, 1.2, -37, 2, -.3, -51],
  [2.69, 3.2, 1.4, -43, 1, -.3, -58],
  [2.9, 1.3, 1.0, -49, 2, -.3, -63],
  [3, .3, 1.5, -63, -1.8, .3, -78],
  [4, 1.6, .7, -82, 2, .2, -105],
];
export function sampleJourney(value, compact, output) {
  const progress = Math.max(0, Math.min(4, Number.isFinite(value) ? value : 0));
  let index = 0;
  while (index < STOPS.length - 2 && progress > STOPS[index + 1][0]) index += 1;
  const from = STOPS[index];
  const to = STOPS[index + 1];
  const t = (progress - from[0]) / (to[0] - from[0]);
  const blend = t * t * (3 - 2 * t);
  for (let axis = 0; axis < 6; axis += 1) output[axis] = from[axis + 1] + (to[axis + 1] - from[axis + 1]) * blend;
  if (compact) {
    // Point below the aperture: it sits above the mobile copy instead of behind it.
    const hero = 1 - Math.min(1, progress * 2);
    output[0] += 2.6 * hero;
    output[1] -= .6 * hero;
    output[2] += 7.5 * hero;
    output[3] += 2.3 * hero;
    output[4] -= 3.8 * hero;
  }
  return output;
}

export function sectionProgress(scroll, anchors) {
  if (anchors.length < 2 || scroll <= anchors[0]) return 0;
  if (scroll >= anchors.at(-1)) return anchors.length - 1;
  let index = 0;
  while (index < anchors.length - 2 && scroll > anchors[index + 1]) index += 1;
  return index + (scroll - anchors[index]) / Math.max(1, anchors[index + 1] - anchors[index]);
}
