# TacPAC project page

Public URL: https://logosintelligencelab.github.io/TacPAC/

GitHub Pages publishes `main` → `/docs`. The `.nojekyll` file keeps this a plain static site. Pushing changes to the publishing branch triggers the Pages build and deployment.

## Files

- `index.html`: paper metadata, authors, method, demo, and citation.
- `styles.css`: responsive layout and typography.
- The navigation mark and `favicon.svg` pair two gripper jaws and a tactile contact point with a return arrow, representing contact-driven action correction. The two READMEs use the same mark in `../assets/tacpac_logo.svg`. Keep their geometry in sync.
- `tactile-wordmark.css` and `tactile-wordmark.js`: a brief touch introduction on the hero title, with local letter compression, a contact halo, a warm radial glow inside the glyphs, and spring release. Mouse, touch, Enter, and Space trigger the same effect. Motion stops offscreen or in a hidden tab and respects reduced-motion preferences.
- `app.js`: task switching, comparison playback, result data, figure viewer, and citation copy.
- `visualizations.css` and `visualizations.js`: native teaser, sequential SVG architecture, interactive inference timeline, and experimental charts.
- `phase-data.js`, `trace-data.js`, and `data/`: digitized Figure 5 values/error geometry and original vector paths for Figures 7–11.
- `assets/`: self-hosted fonts, source sensor photographs, paper image strips, posters, and videos.

Run `node scripts/preview-website.mjs` from the repository and open http://localhost:8767/. The server supports HTTP byte ranges for video chapters and seeking. All asset links are relative to support the `/TacPAC/` project path. Canonical and social-sharing URLs point to the GitHub Pages address.

## Provenance

Paper: https://arxiv.org/abs/2609.05266 (v1, 4 September 2026).

The original method/setup reference figures come from the supplied `AAAI27-绘图` PDF artwork. The hero demo is the supplied `TacPAC_demo_white_RobotoMono_narrated_EN.mp4`, including its English narration (AAC audio), served as `assets/videos/tacpac-demo-narrated-en.mp4`. All 15 comparison videos are complete rollouts from `真机实录视频/muted`, transcoded to H.264 at 960 pixels wide and 25 fps, preserving their original duration. Posters are extracted from those recordings. Playback speed is controlled in the browser and defaults to 4×.

Main results are from Figure 4, ablations from Table 1, and inference latency from Table 2. “Without tactile correction” in the interface corresponds to “without tactile expert” in Table 1. Each displayed success rate summarizes 20 trials per method per task; the selected videos are individual success or failure examples.

Existing installation and robot deployment documentation in this folder is independent of the project page.


## Native figures and source fidelity

The teaser uses embedded photographs from `demo-output/teaser_editable.pdf`, with HTML/SVG labels, signal paths, and comparison bars. The method diagram is redrawn from `AAAI27-绘图/pipeline.pdf` and paper Figure 2. Its four steps cycle automatically every 4.5 seconds. Selecting a step restarts that dwell time and keeps the sequence playing. Figure 3 is a 48-action timeline with adjustable observation offset and latency window; the timing demonstration is illustrative and does not assert a fixed measured delay.

Figure 4 includes all seven methods, all five tasks, and the average. Table 1 includes the complete pathway matrix and all per-task values. Figure 5 retains all four phases and published error-bar geometry. Its bars were digitized from the PDF vector coordinates; the page explicitly marks values as approximate. The caption does not define the statistical interpretation of those error bars. The 4.9%/18.6% contact-transition callouts are directly reported in Section 4.3. Table 2 uses the exact published latency and rate values.

Figures 7–11 preserve the original tactile-activity and gripper-width vector paths, phase boundaries, axes, and the two image strips per task. As in the supplement, the representative training trace and successful-rollout photographs are separate episodes. The replay cursor applies only to the trace. Figure 6 remains the real setup photograph.

The teaser signals, pipeline, inference sequence, and trace replay loop automatically while visible, without play/pause buttons. They pause offscreen and honor `prefers-reduced-motion`. All result bars support hover enlargement and keyboard focus with value tooltips; only bar thickness grows, so the data scale and error bars remain accurate. Exact results and approximate phase values are also available in tables. Wide charts scroll inside their own containers on phones.
