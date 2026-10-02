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

## Phase 3 — visual system changes

Pending implementation and verification. Required screenshots: 375px, 768px, and 1440px; inspect for overlap, cut-off text, contrast, and uneven spacing.

## Phase 4 — motion and 3D changes

Pending implementation and verification. Required failure paths: CDN blocked, WebGL disabled/context lost, reduced motion, hidden tab, rapid scroll, and resize.

## Phase 5 — verification ledger

| Check | Status | Evidence / gap |
| --- | --- | --- |
| Build | PASS before changes | `npm run build` |
| JS syntax | PASS before changes | `node --check main.js`; `node --check src/scene.js` |
| 320/375/768/1024/1440 layouts | BLOCKED before changes | Playwright host missing libraries; Windows Chrome screenshot path available |
| Chrome / Firefox / iOS Safari / Android Chrome | NOT RUN | No real device/browser matrix in this environment |
| Lighthouse targets | NOT RUN | Requires a working browser runner |
| CDN blocked / WebGL disabled | STATIC REVIEW ONLY | Code path exists but needs browser execution |
| Keyboard / reduced motion / screen reader | STATIC REVIEW ONLY | Semantics present; interactive execution pending |
| Rapid scroll / resize / history | STATIC REVIEW ONLY | Handlers present; interactive execution pending |

## Open TODOs (do not hide these as completed)

- Run the full Windows Chrome headless interaction/screenshot matrix and inspect screenshots at 375/768/1440.
- Run Firefox/WebKit or real-device checks when browser dependencies/devices are available.
- Obtain a Formspree/Web3Forms endpoint if a hosted contact form is desired; mailto fallback remains intentional.
- Obtain authentic screenshots for projects that have no supplied screenshot. Do not label generated diagrams as screenshots.
- Confirm whether the owner wants both the original research PDF and the improved DOCX published publicly.
