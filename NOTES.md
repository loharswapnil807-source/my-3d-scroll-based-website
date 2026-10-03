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
