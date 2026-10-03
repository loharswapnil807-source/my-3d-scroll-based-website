# Swapnil Lohar — immersive portfolio

Developer and researcher portfolio focused on systems programming, web development, and 3D research.

## Live portfolio

[Open the live portfolio](https://loharswapnil807-source.github.io/my-3d-scroll-based-website/)

## Local development

```bash
npm install
npm run dev
```

`npm run build` builds both the portfolio and `resume.html`. Use `npm run preview` to serve the production build.

## Silicon Journey design

The current frontend takes its visual direction from the **8bit.ai** recording in [Vev's 3D website examples](https://www.vev.design/blog/3d-website-examples/): graphite surfaces, silver geometry, luminous data paths, restrained typography, and camera travel through a supercomputer-like environment.

- An original chrome aperture opens into a continuous 110-unit 3D environment: silicon banks, circuit traces, curved light paths, transition gates, and an exploded processor core.
- Native scrolling drives the perspective camera through Hero, About, all five Work projects, Research, and Contact. Reverse scrolling retraces the camera path. Desktop pointer movement adds restrained parallax.
- Geometry, reflections, and materials are generated locally with Three.js. There are no external models, texture downloads, video backgrounds, or copied reference-site assets.
- The existing HTML content, screenshot files, documents, résumé, and links are preserved. Presentation uses larger editorial headings, open layouts, quiet rules, a project index, paired galleries, and a split contact section.
- The existing theme control cycles through the redesigned teal/graphite, violet, and warm-light palettes. A new visit defaults to graphite; saved choices persist.
- Images enter with a restrained 94% → 100% scale. All six previews retain Escape-to-close and focus restoration. The cursor treatment is a single fine outline.

## Scene architecture

- `src/scene.js`: renderer, lighting, environment map, measured section anchors, camera, one render loop, media queries, visibility/BFCache handling, and disposal.
- `src/journey.js`: deterministic camera stops and section-progress interpolation. Separate framing keeps the mobile aperture above the copy.
- `src/silicon-world.js`: reusable procedural meshes, instanced silicon banks, stream shaders, particles, palette changes, and owned-resource cleanup.
- `src/interactions.js`: screenshot previews, image arrivals, and cursor/card interaction.

DPR is capped at 2 desktop / 1.5 mobile. Mobile reduces particles from 1,100 to 440 and omits the wider stream halos. Reduced motion renders a static composition; manual pause stops the render loop. Context loss or unavailable WebGL leaves the static document usable. No-JavaScript navigation and direct screenshot links remain available.

The previous fluid/ribbon modules and their unit checks remain in the repository as historical code; they are not imported by the active scene or included in its bundle.

## Checks and deployment

```bash
npm test
npm run build
```

See [tests/README.md](tests/README.md) for the production-browser smoke suite. `NOTES.md` records verification and remaining content/device gaps.

The GitHub Pages workflow runs tests and builds on pushes to `feature/immersive-3d-portfolio`. The root browser import map also supports static serving without a Vite build.
