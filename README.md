# Swapnil Lohar — immersive portfolio

Developer and researcher portfolio focused on systems programming, web development, and 3D research.

## Live portfolio

[Open the live portfolio](https://loharswapnil807-source.github.io/my-3d-scroll-based-website/)

## Local development

```bash
npm install
npm run dev
```

Create a production build with `npm run build`, then preview it with `npm run preview`. Both the portfolio and `resume.html` are included.

## Interactions and checks

- Scroll through **Ember Chrysalis**: one copper ribbon coils into a breathing orb, S-weaves through all five projects, straightens into five connected research lanes, and lifts into a tapered ember farewell. The cilia are anchored to that same ribbon; there are no orbiting fragments or cursor particle clouds.
- Project images scale in from alternating corners; select an image for the full-size preview. Escape closes the preview.
- The blurred navbar stays visible while scrolling. Theme switching keeps the teal → violet → warm light cycle.
- Hover reveals image/card tilt, glowing links, and the existing cursor light/trail. Moving over the organism creates a local dent and spring-settling ripple; hovering a project warms its nearest ribbon segment. System reduced motion and the desktop motion toggle disable animated effects.
- Teal/violet CSS palettes and interactions are preserved. Warm light uses cream paper/copper ink and a slimmer, unboxed contact section.

Run `npm test` for the dependency-free fluid/3D regression tests. See [tests/README.md](tests/README.md) for the production-build browser smoke check and its coverage limits.

## Ember Chrysalis module

`src/fluid-vortex.js` retains the `createFluidVortex()` factory/export so existing imports keep working. It provides `group`, `setTheme(colors)`, `resize(width, height, dpr, compact)`, `setProgress(shape, workTravel)`, `update(timeSeconds, legacyExpansion, energy)`, and `dispose()`.

- `shape` is continuous **0–3**: orb, work ribbon, research circuit, contact embers. `workTravel` is normalized progress through Work.
- `setPointer(localX, localY, active)` receives a desktop pointer projected into the object's local plane. `setHover(t)` warms a nearby point on the ribbon (`t` = 0–1, `-1` clears). `setScrollVelocity(value)` receives signed normalized velocity; `resetInteraction()` clears forces when pausing/hiding.
- The existing scene owns the only RAF, camera, measured section anchors, and resource disposal. New progress/interaction inputs are wired in `src/scene.js`; section IDs, anchor measurements and anchor interpolation are unchanged.
- One instanced membrane draw call (adjacent patches of the same strip), one `LineSegments` cilia call (220 desktop / 110 mobile), and one small icosahedron heart while coiled. The heart fades out after uncoiling. Contact embers reuse membrane patches, not another particle object. Both membrane and cilia use the same GLSL path and pointer deformation.
- No textures, HDR, postprocessing or additional RAF/listeners inside the module. DPR is capped at 2 desktop / 1.5 mobile. Normal alpha blending retains contrast on warm light. The original `three@0.176.0` import map remains intact.

## GitHub Pages

The `feature/immersive-3d-portfolio` branch contains the verified implementation and a GitHub Actions deployment workflow. The root page also retains a browser import map, so the static branch Pages configuration can run the experience without requiring the Vite bundle.
