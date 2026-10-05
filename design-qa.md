# Cybercomic card implementation — QA pending

final result: blocked

## Visual target and scope

- Selected source: `/workspace/scratch/6e8b051e9453/generated_images/exec-ea2c529f-a31b-43ad-afeb-7dfeda3a189e.png`.
- Source dimensions: 1536 × 1024 pixels; a concept sheet with three enlarged cards and a compact hand, not a whole match screen.
- Intended implementation states: hand, selected card, full inspection, card library; portrait 320 × 568 and 390 × 844, landscape 844 × 390, desktop 1280 × 900.
- Implementation screenshot: unavailable. CSS viewport, device scale and density normalization have not been measured in a browser.

## Blocking finding

- [P1 / verification] Browser-rendered evidence is missing. The supervised preview could not resolve the existing project's dependency path from its restricted preview root. Two start attempts were made; the cloud browser returned `net::ERR_CONNECTION_REFUSED`. No alternate browser automation was used without user approval.
- Consequently full-view and focused-region comparisons have not been performed. No visual pass is claimed, and this change must remain a draft until browser QA is complete.

## Required fidelity surfaces

- Typography: bundled Oswald with Cyrillic; live titles, money and action costs. Actual wrapping and long names need browser verification.
- Layout: common card face for hand, inspection and library; responsive hand tracks and scrollable inspection. Actual overflow, board size and sticky controls need browser verification.
- Colors: coral attack, cyan defense, amber economy, lime selection, dark metal. Contrast and selected/blocked states need browser verification.
- Images: all 18 individual WebP illustrations and the frame were opened and inspected during production. Their rendered crop, scale and clarity are not yet verified.
- Copy: card name, short effect, exact rules, price and action cost come from `CARDS`. No balance or game-engine changes.

## Comparison history

No rendered comparison iteration is available. Static review reduced excessive full-card title/rule spacing before capture; this is not counted as a visual QA pass.

## Required browser checks

1. Capture enlarged DDoS, Anti-DDoS and New Server alongside the selected source at comparable scale.
2. At each viewport, verify all hand cards can be reached, names/prices remain readable, and the board and end-turn button remain usable.
3. Tap a card, read all text, choose a target, confirm one play, and verify money/AP debit once.
4. Inspect an unavailable card, replace a card for free, switch categories, and expand the library's longest names/rules.
5. Verify keyboard focus, reduced motion, image/font loading, console errors and reload/resume.
6. Record screenshots, fix any P0/P1/P2 finding, recapture, and only then change the result to `passed`.

## Completed code and packaging checks

- `pnpm test`: 53 passed, 0 failed.
- `pnpm lint`: 0 errors, 0 warnings.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm build`: passed; all 19 WebP assets and the bundled font emitted.
- `pnpm android:web`: passed; the same assets emitted with Android-compatible relative URLs. This does not produce a newly signed APK/AAB.
- `pnpm exec wrangler deploy --dry-run --config cloudflare/wrangler.json`: passed. No remote deployment was performed.
- `git diff --check`: passed.

These checks do not substitute for browser screenshots, primary-interaction testing or console inspection.
