# Portfolio checks

## Dependency-free unit/stress checks

```sh
npm ci
npm test
npm run build
```

`npm test` uses Node's built-in test runner. It exercises the retained fluid helpers plus Ember Chrysalis: a single connected membrane through reversible states, shared cilia deformation, local pointer spring settling, hover/reset behavior, copper palette contrast, touch auto-drift, mobile detail/DPR limits, and idempotent disposal. It does **not** compile GLSL or replace browser checks.

## Optional browser smoke check

Use an existing Playwright installation and its Chromium browser (no runtime dependency is added to the site). Serve the **production build**, not just the dev server:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
# In another terminal, with Playwright available:
node tests/browser-smoke.mjs
```

If Playwright is installed outside this project, set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path. `BROWSER_EXECUTABLE` can point to an existing Chromium executable. `BASE_URL` defaults to `http://127.0.0.1:4173`. `QA_OUTPUT` defaults to `portfolio-qa` in the system temporary directory. On Linux the browser's shared libraries must be installed/available on its library path.

The script tests real WebGL shader rendering first, then runs GPU-independent UI stress checks with WebGL deliberately disabled. It checks all four Chrysalis shapes and reversal, one ribbon through the five projects, local pointer settling and project pulses, the actual three/two draw-call budget, palettes/persistence, pause and runtime reduced motion, mobile detail, simulated BFCache events, **actual** WebGL context loss, sticky blur at 320/375/768/1024/1440px, corner-scaling image entrances, all six full-image previews and focus return, unchanged cursor/hover effects, touch navigation, blocked storage, deployed local assets, no-JavaScript navigation, and the warm contact layout at four widths. It writes screenshots and `browser-results.json` to the output directory.

Still review screenshots manually. Headless Chromium/SwiftShader does not establish real-device frame rate, Safari/Firefox compatibility, or screen-reader usability.
