# Portfolio checks

## Dependency-free unit/stress checks

```sh
npm ci
npm test
npm run build
```

`npm test` uses Node's built-in test runner. The active scene checks cover forward/reversible camera travel through all five projects, measured section progress, mobile framing, finite generated geometry, instancing, palette updates, mobile particle/DPR budgets, interaction reset, and exactly-once resource disposal. Six retained tests cover the historical fluid/ribbon modules, which are no longer loaded by the scene. Unit tests do **not** compile GLSL or replace browser checks.

## Optional browser smoke check

Use an existing Playwright installation and its Chromium browser (no runtime dependency is added to the site). Serve the **production build**, not just the dev server:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
# In another terminal, with Playwright available:
node tests/browser-smoke.mjs
```

If Playwright is installed outside this project, set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path. `BROWSER_EXECUTABLE` can point to an existing Chromium executable. `BASE_URL` defaults to `http://127.0.0.1:4173`. `QA_OUTPUT` defaults to `silicon-qa` in the system temporary directory. Set `CHECK_GROUP=ui` to run only the GPU-independent UI checks while debugging; omit it for the full suite. On Linux the browser's shared libraries must be installed/available on its library path.

The script tests real WebGL rendering first, then runs GPU-independent UI stress checks with WebGL deliberately disabled. It checks lit silicon geometry and stream shaders, camera travel through all five projects and the research/contact scenes, reversal, a draw budget below 40 calls, palettes/persistence, pause, runtime reduced motion, mobile detail, simulated BFCache events, **actual** WebGL context loss, overflow and navigation at 320/375/768/1024/1440px, restrained image entrances, all six image previews and focus return, cursor/hover behavior, touch navigation, blocked storage, local assets, the résumé, no-JavaScript navigation, and contact layout in all three palettes. It writes screenshots and `browser-results.json` to the output directory.

Still review screenshots manually. Headless Chromium/SwiftShader does not establish real-device frame rate, Safari/Firefox compatibility, or screen-reader usability.
