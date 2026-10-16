# TacPAC project page

Public URL: https://logosroboticsgroup.github.io/TacPAC/

GitHub Pages publishes `main` → `/docs`. The `.nojekyll` file keeps this a plain static site. Pushing changes to the publishing branch triggers the Pages build and deployment.

## Files

- `index.html`: paper metadata, authors, method, demo, and citation.
- `styles.css`: responsive layout and typography.
- `app.js`: task switching, comparison playback, result data, figure viewer, and citation copy.
- `assets/`: self-hosted fonts, original paper figures rendered for the web, posters, and videos.

Use a local static server with HTTP byte-range support when checking video chapters and seeking. All asset links are relative to support the `/TacPAC/` project path. Canonical and social-sharing URLs point to the GitHub Pages address.

## Provenance

Paper: https://arxiv.org/abs/2609.05266 (v1, 4 September 2026).

The three method/setup figures come from the supplied `AAAI27-绘图` PDF artwork. The overview is the supplied `TacPAC_demo_white_RobotoMono.mp4`. All 15 comparison videos are complete rollouts from `真机实录视频/muted`, transcoded to H.264 at 960 pixels wide and 25 fps, preserving their original duration. Posters are extracted from those recordings. Playback speed is controlled in the browser and defaults to 4×.

Main results are from Figure 4, ablations from Table 1, and inference latency from Table 2. “Without tactile correction” in the interface corresponds to “without tactile expert” in Table 1. Each displayed success rate summarizes 20 trials per method per task; the selected videos are individual success or failure examples.

Existing installation and robot deployment documentation in this folder is independent of the project page.
