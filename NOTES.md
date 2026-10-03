# Portfolio upgrade notes

This file records verified decisions and checks for Swapnil Lohar's static GitHub Pages portfolio.

## Scope and acceptance criteria

- Keep the experience plain HTML, CSS, JavaScript, and Three.js; no framework, tracking script, or invented credentials.
- Preserve an accessible static page when the Three.js CDN, WebGL, or motion APIs fail.
- Use the three supplied palette families, responsive layouts from 320px up, keyboard navigation, reduced motion, and real project/research links where the supplied sources make them verifiable.
- Do not publish a graduation year that was not supplied. Current education is a Diploma in Computer Technology, second year, at Government Polytechnic Solapur.

## Phase 1 — current audit (2026-10-02)

### Verified strengths

- `npm run build` passes on the existing branch.
- `node --check main.js` and `node --check src/scene.js` pass.
- Existing sections have semantic headings, a skip link, labeled navigation, focus-visible outlines, meaningful alt text for two images, and reduced-motion CSS/scene branches.
- Existing Three.js resources are tracked and disposed; resize work is already debounced; hash/popstate listeners exist.
- The supplied project folder, feedback screenshots, research PDF/DOCX files, college, degree status, achievements, LinkedIn URL, and public Stickman repository are available in the local environment.

### Findings to fix

| Severity | Location | Finding | Planned fix |
| --- | --- | --- | --- |
| High | `main.js:168-206` | A slow/stalled Three.js import times out visually, but a late import can still initialize the scene and undo the fallback. | Make the loader state one-way; ignore late success after fallback and keep a bounded static state. |
| High | `src/scene.js:633-638` | WebGL context loss only marks `data-state="lost"`; a blank fixed canvas can remain above the page. | Hide the canvas and activate the CSS fallback on context loss; cleanly restore if the context returns. |
| High | `style.css:194-200` | At mobile widths JavaScript failure hides both links and the menu button. | Keep a no-JS navigation path visible; progressively enhance the collapsible menu. |
| High | `main.js:74-85` | `localStorage` exceptions can stop all later initialization. | Guard storage reads/writes. |
| High | `main.js:76-85`, `src/scene.js:226-370` | CSS theme changes do not update the WebGL materials, fog, lights, or star colors. | Add a theme-change event/controller path. |
| High | `index.html:226,276`, `public/assets/` | Root/static serving requests `assets/...`, but source assets are only under `public/assets/`; the no-build path returned two 404s in a local HTTP smoke test. | Add a root-served asset path or make deployment mode explicit and test both paths. |
| Medium | `index.html:172`, `src/scene.js:7,327` | The page contains five projects (A–E) but says four and renders only four project markers. | Say five and derive marker count from project elements. |
| Medium | `index.html:274-285` | Stickman project has a visible TODO instead of its public repository. | Link `https://github.com/loharswapnil807-source/stickman-with-change-s`. |
| Medium | `index.html:303-325` | Research cards have disabled status text rather than view/download links. | Publish the supplied PDF/DOCX files with accurate self-authored/college-submission wording. |
| Medium | `index.html:348-352` | `mailto:` form submission is a fragile browser-dependent fallback. | Keep mailto as the honest fallback, improve the submit path and status, and leave a clearly marked hosted-endpoint TODO if no endpoint exists. |
| Medium | `index.html:9-18` | Social metadata has no `og:image`/`twitter:image`, and JSON-LD omits LinkedIn. | Add a palette-compliant social preview and complete sameAs metadata. |
| Medium | `style.css:65-69`, `main.js:144-166` | The dynamically revealed motion toggle has no matching style and can crowd the 320px header. | Style controls and use a compact mobile header. |
| Low | `main.js:148-155` | Reduced-motion users initially see “Pause motion” even though animation is already disabled. | Make the initial state and label truthful. |
| Low | `style.css:90,176` | Scroll cue and footer-top links are not guaranteed 44px tap targets. | Add minimum interactive target sizing. |
| Low | `NOTES.md` previous version | Historical findings were easy to mistake for current status. | This file is now organized as baseline, changes, and verified checks. |

### Audit checks actually run

- `npm run build` — PASS before the new changes.
- `node --check main.js` — PASS before the new changes.
- `node --check src/scene.js` — PASS before the new changes.
- `git diff --check` — PASS before the new changes.
- Local raw-root HTTP smoke test — HTML/CSS/JS loaded, but `assets/bunk-tracker-terminal.jpg` and `assets/stickman-typing-fighter.png` returned 404 because the root asset path was absent.
- Public GitHub API checks — `Cake-Shop`, `Micro-project`, `Project`, `done`, and `stickman-with-change-s` are public (HTTP/API responses available).
- Playwright packages/browsers were downloaded, but the WSL host is missing browser libraries and passwordless `sudo`; real Playwright runs are currently blocked. Windows Chrome headless is available for screenshot smoke checks.

## Source facts to publish

- Name: Swapnil Lohar.
- Current status: pursuing a Diploma in Computer Technology, second year.
- College: Government Polytechnic Solapur.
- Achievements supplied by owner: won a code-a-thon, won a technical debate competition, 1st prize in a demo business pitch event, and 1st prize for PPT presentation and explanation.
- LinkedIn: `https://www.linkedin.com/in/swapnil-lohar-73a87241b`.
- Research venue/status: self-authored college submissions submitted to the principal; do not call them externally published.
- Research source files: Autodesk Maya research PDF, improved research DOCX, and technical report DOCX supplied locally.
- Stickman repository: `https://github.com/loharswapnil807-source/stickman-with-change-s`.
- No graduation year was supplied; do not invent one.

## Phase 2 — content and interface changes (2026-10-02)

- Added verified education: Diploma in Computer Technology, second year, Government Polytechnic Solapur; no graduation year invented.
- Added owner-supplied achievements and the clean LinkedIn URL.
- Corrected project descriptions from the supplied C/C++ source: Terminal Game is a Windows console endless-runner; Bunk Tracker is a classroom OOP escape/quiz game; Environment Simulator is a Turbo C++/BGI plant-care graphics game.
- Added the public Stickman repository link and replaced unsupported research publication language with self-authored college-submission wording.
- Added downloadable research PDF/DOCX files under `public/documents/` and root `documents/` for both built and no-build serving.
- Added a real bakery homepage screenshot generated from the supplied local bakery project; preserved the supplied Bunk Tracker and Stickman screenshots. No authentic Terminal Game or Environment Simulator screenshot was invented.
- Added Open Graph/Twitter image metadata, LinkedIn JSON-LD, `robots.txt`, and `sitemap.xml`.
- Hardened local-storage theme persistence and mailto contact form behavior; added a truthful form note.
- `npm run build`, `node --check main.js`, `node --check src/scene.js`, and `git diff --check` pass after the phase changes.

Known content gap: the public GitHub repositories named in the previous implementation (`Micro-project`, `Project`, and `done`) are public but their API contents are bakery HTML, not the supplied C/C++ projects. The page therefore does not link those misleading repositories; correct public source URLs are needed if they exist.

## Phase 3 — visual system changes (2026-10-02)

- Added the requested palette variables/data-theme states, display/body/mono fallback stacks, raised card surfaces, section dividers, 14px radius, and 44px controls.
- Added a real bakery screenshot and a two-image classroom-game gallery; technical diagrams remain explicitly diagrams where no authentic screenshot was supplied.
- Made hero title spans block-level so the primary statement does not collide at desktop widths.
- Reduced and shifted the wireframe field below 960px so it does not cover mobile/tablet copy; hid the optional manual motion control at the smallest header width while preserving system reduced-motion behavior.
- Added no-JavaScript mobile navigation visibility and progressive enhancement for the menu.
- Windows Chrome CDP emulation at CSS 375px verified: `innerWidth=375`, `clientWidth=375`, `scrollWidth=375`, no horizontal overflow, loader hidden, scene ready, menu visible, motion control hidden, hero opacity 1. Screenshot reviewed at `/mnt/c/Users/USER/Desktop/portfolio-cdp-mobile.png`.
- Windows Chrome headless screenshots were captured at 768px and 1440px during the review; the 768px view had no text overlap after shifting the field, and the 1440px view showed the requested wireframe field. An exact CDP matrix remains in Phase 5.

## Phase 4 — motion and 3D changes (2026-10-02)

- Three.js startup is deferred until two animation frames after the initial UI boot; a five-second timeout is one-way and ignores late CDN success after fallback.
- Context loss now hides the fixed canvas, switches to the static fallback, and notifies the UI. A context restored after a terminal failure does not re-show a possibly blank canvas.
- Scene materials, fog, lights, and star colors now respond to the CSS theme switch via `portfolio:themechange`.
- The torus is a quieter wireframe field; marker count derives from all project cards, renderer DPR remains capped at 2 (1.5 on narrow/coarse screens), resize remains debounced, and geometry/material/renderer disposal remains active.
- Manual motion control now follows the reduced-motion preference and is hidden when there is no working scene controller.
- Windows Chrome CDP checks: normal scene reaches `ready` with hidden loader at 320, 375, 768, 1024, and 1440px; all five widths had no horizontal overflow and DPR 1.00 in this environment. Theme switch updated both CSS theme and scene theme; mobile menu opened with `aria-expanded=true`; reduced-motion produced `Motion disabled` and no pending reveal blocking; a simulated WebGL context loss produced hidden canvas + `webgl-unavailable`; raw no-build page with the Three.js CDN blocked produced hidden loader + hidden canvas + static fallback.

Known limitation: these are Windows Chrome headless/CDP checks, not real iOS Safari, Android Chrome, Firefox, or WebKit devices.

## Phase 5 — verification ledger

| Check | Status | Evidence / gap |
| --- | --- | --- |
| Build | PASS before changes | `npm run build` |
| JS syntax | PASS before changes | `node --check main.js`; `node --check src/scene.js` |
| 320/375/768/1024/1440 layouts | PASS (Chrome CDP) | No horizontal overflow; loader resolves; scene ready; screenshots reviewed at 375/768/1440 |
| Chrome | PASS (Windows headless/CDP smoke) | Normal startup and interaction paths exercised |
| Firefox / iOS Safari / Android Chrome | NOT RUN | No real device/browser matrix in this environment |
| Lighthouse targets | NOT RUN | Lighthouse runner did not complete in this host; no target is claimed |
| CDN blocked | PASS (raw no-build Chrome CDP) | Hidden canvas/static fallback after blocking unpkg Three.js |
| WebGL context loss | PASS (simulated Chrome CDP event) | Canvas hidden and fallback class applied |
| Reduced motion | PASS (Chrome CDP emulation) | Scene static; motion label truthful; reveals do not block content |
| Keyboard / screen reader | STATIC REVIEW ONLY | Semantic landmarks/focus styles exist; no real screen reader available |
| Rapid scroll / resize / history | STATIC + partial CDP | Hash navigation and resize handlers present; full stress matrix remains unrun |

## Open TODOs (do not hide these as completed)

- The original limited browser matrix is superseded by the 2026-10-03 verification below; real-device coverage remains open.
- Run Firefox/WebKit or real-device checks when browser dependencies/devices are available.
- Obtain a Formspree/Web3Forms endpoint if a hosted contact form is desired; mailto fallback remains intentional.
- Obtain an authentic Terminal Game screenshot. The supplied Environment Simulator screenshots are now included; its previous placeholder has been removed.
- Confirm whether the owner wants both the original research PDF and the improved DOCX published publicly.

## Current update — screenshot motion and fluid vortex (2026-10-03)

### Delivered behavior

- Preserved and completed the pre-existing uncommitted UI/fluid work instead of replacing unrelated work. Local `__agent__/` metadata is ignored, not published.
- Bunk Tracker now presents terminal quiz and classroom map as distinct, labeled panels with contrasting borders. Environment Simulator uses the owner's real planting and harvest images, also independently labeled.
- All six project images animate from alternating corners at 28% scale into their full-size positions. Entrances are one-shot per page load, use independent transform properties so hover tilt remains available, and cancel on keyboard focus, reduced motion, or manual pause. JavaScript failure never leaves an image hidden.
- All six screenshots have full-image dialog previews, Escape/close controls, and focus restoration. Ordinary image links remain the no-JavaScript/modified-click fallback.
- Stronger pointer-position lighting, image/card tilt, glowing contact/navigation/research links, and a small cursor lens plus three trailing lights. Coarse pointers/reduced motion do not get the cursor effects; the native cursor is retained.
- Navbar is sticky with a 24px blur. Horizontal overflow uses `clip` rather than creating an accidental scroll container that can defeat sticky positioning.
- Replaced the wireframe knot and rings with a GPU-deformed, fluid-inspired spindle/vortex: expanded feathered spirals gather into a thin luminous filament and expand again as scrolling progresses. Absolute scroll positions make the shape reversible. This is a procedural visualization, not a claim of a full scientific 3D Navier–Stokes solver; the separate pointer-particle field uses a bounded 2D velocity/pressure grid.
- 320 desktop / 144 mobile spiral strands, 38 desktop / 16 mobile solid orbiting fragments, and faster rotation/advection. No screenshot textures or per-frame ribbon geometry rebuilding. DPR remains capped; visibility, manual pause, reduced motion, context loss, and disposal paths are retained.
- **The existing teal → violet → warm light switching and persistence logic is unchanged.** New shaders, objects, and effects consume the existing CSS palette values.

### Defects found during verification and fixed

- Paused/static WebGL scenes now reframe after viewport/orientation changes, without advancing time or restarting animation. Detail-count diagnostics refresh immediately after resize.
- Runtime WebGL failure now also hides the unusable scene motion control.
- The production build previously omitted `resume.html` although the contact section linked to it. Vite now builds both HTML entry points, and the deployed Resume link was checked over HTTP.
- Reduced background opacity below the hero and a mobile gradient mask keep moving strands from overwhelming copy.

### Checks actually run

- `npm test` — **4 passing** Node test cases. Repeated opposite impulses, bounded/finite fluid and particle states, dissipation/reset, reversible shape and animated solid fragments, palette updates, desktop/mobile budgets, DPR caps, and instance disposal.
- `npm run build` — **PASS**, including `dist/index.html` and `dist/resume.html`.
- `node --check main.js`, `node --check src/*.js` (each file individually), and `git diff --check` — **PASS**.
- `node tests/browser-smoke.mjs` with an existing external Playwright installation and Chromium 153/SwiftShader — **19 passing check groups** against the production build served at `http://127.0.0.1:4173`. Browser/library paths were supplied through environment variables; no browser runtime dependency was added to the app.
  - Actual shader compilation/rendering; scroll expansion → contraction → expansion/reversal; all three CSS/WebGL themes and persistence.
  - Manual pause; runtime reduced motion; static resize/mobile detail; simulated BFCache events; actual `WEBGL_lose_context` loss and fallback.
  - 320, 375, 768, 1024, 1440px: no horizontal overflow and the blurred navbar remained at the viewport top through the footer.
  - Image start scale/different corner directions; six loaded dialog previews; Escape/focus restoration; tilt/glow/cursor trails; mobile menu/focus/Escape; touch previews; blocked storage; 20 rapid resize/scroll reversals.
  - All local image/document/Resume links returned successful responses; no-JavaScript navigation and direct-image links remained available.
  - UI stress checks deliberately disabled WebGL to isolate interactions from software GPU speed; the first group tested the real combined WebGL page.
- `node /tmp/portfolio-accessibility.mjs` — axe-core WCAG 2 A/AA + 2.1 AA scan at desktop width: **zero reported violations in teal, violet, and warm** (reduced motion and WebGL disabled for this automated scan). Not a manual screen-reader audit.
- Screenshots manually inspected: desktop vortex, all three palettes, mobile reduced-motion composition, both paired galleries, contact hover/cursor. Local evidence is in `/tmp/portfolio-qa/`; it is not committed.
- GitHub Pages CI now runs `npm test` before building.

### Remaining limits / next concrete check

- Real iOS/Android hardware, Safari, Firefox, screen readers, and hardware FPS were not tested. Headless SwiftShader timing is not a real-device performance result.
- Vite reports a non-fatal warning for the lazy scene chunk (~515 kB minified / 132 kB gzip, including Three.js). The main UI remains separately loaded.
- Existing content limitations remain: Terminal Game has a labeled diagram, some C/C++ repositories have no verified public source link, and contact submission opens an email draft rather than sending through a backend.
- After pushing, verify the GitHub Pages deployment and inspect the new vortex/paired galleries on the owner's actual phone and desktop.

## Current update — Ember Chrysalis (2026-10-03)

This update supersedes the previous vortex/fragment implementation above. Historical check results are retained as history, not claims about the new module.

### Scope and implementation

- Replaced `src/fluid-vortex.js` with **one continuous copper ribbon**. Its instanced patches represent consecutive intervals of one global curve, not independently seeded strands or separate sphere/ribbon meshes. The same strip geometry survives all scroll states and viewport sizes.
- Hero: breathing, slowly rotating spherical coil (local radius ~1.8), with a small icosahedron heart. Work: a vertical S-ribbon whose phase follows the five project chapters. Research: five straight lanes connected by stepped returns. Contact: a tapered, lifted tail; the membrane's own patches detach/fade into sparse ember flecks.
- Cilia: 220 desktop / 110 mobile hairlines in one `LineSegments` call. Membrane and cilia share the exact GLSL centerline, edge, pointer deformation, and uniforms. Research hairlines become straight perpendicular ticks; contact hairlines fade away.
- Draw budget verified in the real renderer: **3 hero calls** (membrane, cilia, heart), **2 after uncoiling**. Removed the former scene stars, orbit markers, and WebGL cursor particle cloud. The existing DOM cursor lens/trail/glow is unchanged. Old fluid helper modules are retained for compatibility/history but no longer loaded by the scene.
- Pointer events are projected to local object coordinates on desktop only. A local dent/ripple uses a critically damped spring, settling in approximately 0.8 seconds of animation time. Project-card hover pulses the nearest visible ribbon region. Signed scroll impulses add twist and turbulence; paused/hidden/reduced-motion paths reset forces.
- Kept `createFluidVortex()` and legacy `update()` compatibility, plus `setTheme()`, `resize()`, `setProgress()`, pointer/hover/velocity inputs and disposal. Module API is documented in `README.md`.
- `src/scene.js` passes shape progress through the **existing section IDs, anchor measurements, anchor interpolation, and camera keyframes**. No HTML anchors or scroll-trigger library were added. Damped framing centers the Work ribbon and moves the Contact tail away from the form.
- `style.css` changes are **exclusively warm-theme scoped**: cream paper, copper ink, quieter surfaces, and an unboxed, less padded Contact panel. Teal/violet CSS, typography, navigation, image animations, cursor movement, link glow, and theme-switch/persistence code are unchanged.
- Retained Three.js 0.176.0 import map, one fixed pointer-transparent canvas, DPR caps, no textures/HDR/postprocessing, normal alpha blending, one host RAF, and static fallback/lifecycle safeguards.

### Verification actually run

- `npm test` — **6 passing tests**: retained fluid helper boundaries; connected strip and reversible state; shared cilia inputs; spring settling, hover and force reset; touch/low-power pointer suppression and intact topology; DPR/LOD; copper palette and idempotent disposal.
- `npm run build` — **PASS** with both HTML entry points. Lazy scene chunk ~509 kB minified / 130 kB gzip; Vite's existing non-fatal size warning remains.
- `node --check` for every `src/*.js`, `tests/*.js`, and `tests/*.mjs`; `git diff --check` — **PASS**.
- `node tests/browser-smoke.mjs`, with existing external Playwright/Chromium 153 and Linux browser libraries supplied via environment variables — **22 passing groups**, against the production build served by `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist`.
  - Real GPU-program compilation/rendering with no shader/runtime errors; actual 3/2 draw counts; all four states/reversal and one Work ribbon through all five project titles; local pointer activity/settling and card hover activation/clear.
  - Existing theme cycle/persistence, manual pause, runtime reduced motion, mobile detail, simulated BFCache, and actual `WEBGL_lose_context` fallback.
  - Five-width layout matrix, six image previews/focus restoration, corner arrivals, existing cursor/hover effects, mobile menu/keyboard, touch, blocked storage, rapid resize/scroll, local links, and no-JavaScript fallback.
  - Warm Contact has no enclosing box, reduced padding, and no overflow at 320/375/768/1440px.
- `node /tmp/portfolio-accessibility.mjs` — axe-core WCAG 2 A/AA + 2.1 AA: **zero reported violations** in teal, violet, warm desktop, and warm at 320px (WebGL disabled/reduced motion for this accessibility scan).
- AST comparison using PostCSS: after stripping warm-scoped rules, all remaining CSS exactly equals the previous commit. Byte comparisons confirmed `index.html`, `main.js`, and `src/interactions.js` unchanged. Comparison also confirmed the original section-anchor interpolation is unchanged.
- Manually inspected screenshots: hero coil in all themes, Work weave, research circuit, contact dissolution, mobile reduced motion, and warm Contact at 320px/desktop. Evidence lives in `/tmp/ember-qa/`, not in the commit.
- Early shader compilation caught a reserved GLSL identifier; renamed it and reran actual rendering successfully. A browser assertion that read styles before theme application settled was replaced by waiting for the intended computed style; the full suite then passed.

### Remaining limits

- This is an original procedural visual design, not a scientific fluid solver or a claim of globally unique artwork. It morphs vertex positions on a fixed topology, intentionally avoiding separate state meshes.
- No real-device Safari/Firefox/iOS/Android, manual screen-reader, or hardware FPS certification. SwiftShader is used for rendering checks; spring timing under heavily throttled software rendering can be slower in wall-clock time because the host bounds frame deltas.
- Next check after deployment: inspect the new coil/Work ribbon and warm Contact on the owner's actual phone and desktop. Existing source-link and mailto-contact limitations remain unchanged.

## Current update — Silicon Journey redesign (2026-10-03)

This frontend redesign supersedes Ember Chrysalis. The user requested a substantially new design following the 8bit.ai example in Vev's 3D website article, with existing content preserved.

### Reference and delivered design

- Inspected the article and frame captures of its 8bit.ai recording: dark graphite, silver geometry, fine luminous data paths, sparse particles, large editorial typography, and travel through a supercomputer-like environment.
- Rebuilt the visual system in `style.css`: open editorial sections, a four-column project index, understated navigation, chrome-edged screenshot galleries, a split contact layout, and restrained image/cursor interaction. The existing three-theme control remains, with a graphite default and redesigned violet/light palettes.
- Replaced the active ribbon scene with `src/silicon-world.js`: an original machined aperture, instanced silicon banks, circuit traces, curved animated light paths, transition gates, floating processor layers, and a sparse particle field. Geometry and the studio reflection environment are generated locally; no reference-site models, textures, videos, or branding are copied.
- `src/journey.js` provides reversible camera travel tied to the actual section anchors, including travel through all five projects. Mobile receives dedicated camera framing. `src/scene.js` retains a single render loop, bounded DPR, reduced motion, pause, visibility/BFCache behavior, context-loss fallback, and resource disposal.
- Desktop uses 1,100 particles; mobile uses 440 and omits the wider stream halos. The real renderer stayed within the tested 40-call / 90,000-triangle budget. The historical fluid modules remain on disk but are not loaded by the active scene.
- `index.html`, `resume.html`, `assets/`, `documents/`, and `public/` are byte-for-byte unchanged from the previous commit, verified with `git diff --exit-code HEAD -- index.html resume.html assets documents public`.

### Verification

- `npm test`: **9 passing tests**, including three new meaningful checks for camera travel/reversal, measured section progress/mobile framing, and finite/instanced geometry with exactly-once disposal.
- `npm run build`: **PASS**, including both HTML entry points. Existing non-fatal Three.js scene chunk warning remains (~512 kB minified / 129 kB gzip).
- Production-build `tests/browser-smoke.mjs`: **16 passing groups** in a complete run using external Playwright and Chromium/SwiftShader. Covers real shaders/materials, camera progression through every project and reversal, hover/parallax, themes/persistence, pause, reduced motion, mobile detail, BFCache, real WebGL loss, five-width layouts, all six image previews/focus, touch, blocked storage, local assets/documents/resume, and no-JavaScript fallback.
- Axe-core WCAG 2 A/AA + 2.1 AA: **zero reported violations** in all three palettes at 320/768/1440px, and on the résumé. These scans use reduced motion with WebGL disabled.
- Inspected captured hero, mobile, all-theme, research, contact, and paired-gallery views. Temporary evidence: `/tmp/omnirush/silicon-qa/`.
- Rapid theme/viewport checks exposed transient intrinsic-grid overflow; explicit zero-minimum grid tracks and wrapping constraints fixed it. Browser assertions also wait for responsive viewport-unit recalculation before measuring settled layouts.
- Syntax checks and `git diff --check`: **PASS**.

### Remaining verification limits

- Real-device Safari/Firefox/iOS/Android, manual screen-reader use, and hardware frame-rate testing remain open. SwiftShader checks establish rendering correctness, not device FPS.
- The contact form still opens an email draft; missing public C/C++ source links and the Terminal Game diagram are preserved as requested.
- Verification was completed locally before committing. The GitHub Pages deployment requires pushing the update to the deployment branch.
