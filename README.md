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

- Scroll to wrap and expand the fluid-inspired 3D vortex and its orbiting fragments.
- Project images scale in from alternating corners; select an image for the full-size preview. Escape closes the preview.
- The blurred navbar stays visible while scrolling. Theme switching keeps the teal → violet → warm light cycle.
- Hover reveals image/card tilt, glowing links, and a subtle cursor light/trail. System reduced motion and the desktop motion toggle disable animated effects.

Run `npm test` for the dependency-free fluid/3D regression tests. See [tests/README.md](tests/README.md) for the production-build browser smoke check and its coverage limits.

## GitHub Pages

The `feature/immersive-3d-portfolio` branch contains the verified implementation and a GitHub Actions deployment workflow. The root page also retains a browser import map, so the static branch Pages configuration can run the experience without requiring the Vite bundle.
