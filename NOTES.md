# Portfolio upgrade notes

## Phase 1 — audit (2026-10-02)

### Findings

| Severity | Location | Finding |
| --- | --- | --- |
| High | `index.html:4-17` | Missing canonical URL, Open Graph/Twitter metadata, Person JSON-LD, and favicon. Theme color is the old palette. |
| High | `index.html:157-240` | All four project visuals are explicitly conceptual illustrations, with no screenshots/GIFs, repository links, or learning notes. |
| High | `index.html:256-277` | Research entries claim “Published” without a venue and have no View/Download links. |
| High | `index.html:290-300` | Contact is email/GitHub only; no copy-email action, LinkedIn, resume/CV, or form fallback. |
| Medium | `index.html:49-53` | No theme switch; motion control is hidden until the 3D module loads. |
| Medium | `index.html:66-73` | Hero message and action labels are less direct than the requested positioning and CTA hierarchy. |
| Medium | `index.html:100-111` | “Toolkit” and “Working vocabulary” duplicate each other; “Class 2026” lacks degree and college. |
| Medium | `index.html:263-274` | “13 Sections” is not a meaningful portfolio statistic and numbering collides with section/project numbering. |
| Medium | `style.css:68-104` | Uses many legacy colors and spacing values instead of the exact requested token system. |
| Medium | `style.css:599-635` | Hero type exceeds the requested 40–64px scale. |
| Medium | `style.css:781-855` / `main.js:132-160` | Loader only resolves after module initialization and has no explicit bounded timeout/status for a stalled CDN. |
| Medium | `src/scene.js:441-455` | Renderer DPR is capped at 1.6/1.25 rather than the requested maximum of 2; resize work is not debounced. |
| Medium | `src/scene.js:362-364` | Scene observes page sections but does not pause when the fixed canvas is outside the viewport. |
| Low | `src/scene.js:595-598` | Scroll state sync is present but does not explicitly re-sync on `hashchange`/back-forward navigation. |
| Low | `style.css` | Focus styles exist, but several mono labels/buttons are below the requested 14px minimum and need a contrast review. |

### Existing checks

- `npm run build`: PASS before changes.
- Static WebGL fallback exists and `prefers-reduced-motion` is partially respected.
- Three.js geometries/materials are tracked and disposed in `src/scene.js`.
- Public repositories found: `Cake-Shop`, `Micro-project`, `Project`, `done`, and the current site. Research PDFs, degree/college, LinkedIn, resume, and screenshots are not present in the repository.

### Open TODOs

- `[TODO: add verified PDF/repository URLs for both research entries]`
- `[TODO: replace project art with owner-provided screenshots or GIFs]`
- `[TODO: confirm degree, college, graduation year, LinkedIn URL, and resume URL]`
- `[TODO: provide Formspree endpoint if a hosted form is preferred]`
- `[TODO: run Lighthouse and real-device browser matrix; this environment has no visual browser runner]`

## Phase 2 — content and interface fixes (2026-10-02)

- Added canonical, Open Graph, Twitter, favicon, and Person JSON-LD metadata.
- Added selected-work strip, direct hero positioning, project A–D labels, learning notes, and repository links to the owner’s public repositories.
- Replaced unsupported publication claims with self-authored labels and visible research-link TODOs.
- Added education/link/resume TODOs, copy-email behavior, and a `mailto:` contact form fallback.
- Added a three-state teal/violet/warm theme switch with matching `theme-color` metadata.
- `npm run build`: PASS.

## Phase 3 — visual system (2026-10-02)

- Replaced the legacy token set with the exact three palette families and CSS `data-theme` states.
- Set the requested 320px minimum, 44px interactive targets, 14px card radius, typography ceiling, section dividers, and raised surfaces.
- Added responsive rules for 320px, phone landscape/portrait, tablet, and desktop layouts.
- Visual screenshots at 375px, 768px, and 1440px: NOT RUN; no browser/screenshot runner is available in this environment. Build and static inspection pass.

## Phase 4 — motion and 3D (2026-10-02)

- Kept Three.js lazy-loaded after the initial UI boot and preserved the static fallback when the CDN/import map or WebGL initialization fails.
- Removed hard-coded scene colors in favor of the active CSS palette, capped renderer DPR at 2, debounced resize work, and kept geometry/material disposal.
- Added hash/popstate synchronization for direct anchors and back/forward navigation.
- Visibility, reduced-motion, manual motion pause, context loss, and BFCache pause paths remain active.
- `npm run build`: PASS.

## Phase 5 — verification status (2026-10-02)

| Check | Status | Result |
| --- | --- | --- |
| Production build | PASS | `npm run build` succeeds. |
| JavaScript syntax | PASS | `node --check main.js` and `node --check src/scene.js` succeed. |
| 320/375/768/1024/1440 visual layouts | NOT RUN | No browser/screenshot runner is installed. |
| Chrome / Firefox / iOS Safari / Android Chrome | NOT RUN | No browser/device runner is available. |
| Lighthouse targets | NOT RUN | Lighthouse is not installed and requires a browser. |
| CDN blocked / WebGL disabled | STATIC PASS | Import failure and renderer failure route to static fallback in code; not browser-executed here. |
| Keyboard / reduced motion / screen reader | STATIC PASS | Semantic controls, focus styles, reduced-motion CSS, skip link, landmarks, and labels are present; not browser-executed here. |
| Rapid scroll / resize / history | STATIC PASS | Debounced resize and scroll/history handlers are present; not browser-executed here. |

The remaining unverified browser/device checks are listed as open TODOs rather than claimed as passing.
