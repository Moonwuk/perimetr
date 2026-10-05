# Cybercomic cards — visual and interaction QA

final result: passed

<a id="evidence"></a>
## Evidence and normalization

The owner selected the Cybercomic sheet and explicitly authorized local Playwright after the cloud preview was unavailable. This pass used Chromium through Playwright against the real Vite app, not a static mock. Browser and server ran in the same isolated test process.

- Original source: `/workspace/scratch/6e8b051e9453/generated_images/exec-ea2c529f-a31b-43ad-afeb-7dfeda3a189e.png`, 1536 × 1024 pixels.
- [Combined source / implementation comparison](docs/perimeter/qa/cybercomic/comparison.png), 1536 × 650 pixels. The source sheet is scaled proportionally to fit the left column; screenshots of the actual DDoS, Anti-DDoS and New Server components sit together on the right at comparable card widths. This compares card faces, not the concept sheet to an unrelated match screen.
- Full faces were captured from the live inspection at a 1280 × 900 CSS viewport. All browser captures use deviceScaleFactor 1; screenshot pixels equal CSS pixels. The full cards are 330 CSS pixels wide; the comparison scales them proportionally without redrawing their contents.
- Tested match/inspection/catalog viewports: 320 × 568, 390 × 844, 844 × 390, 1024 × 600 and 1280 × 900.
- Focused mobile evidence: [full card at 320px](docs/perimeter/qa/cybercomic/card-320.png), [catalog rules and fixed controls](docs/perimeter/qa/cybercomic/library-320.png).
- Full layout evidence: [844 × 390 landscape](docs/perimeter/qa/cybercomic/table-844.png), [1024 × 600](docs/perimeter/qa/cybercomic/table-1024.png).

<a id="findings"></a>
## Findings and comparison history

All actionable P0/P1/P2 findings below were fixed and recaptured.

1. **P2 — tiny board on a short wide screen.** At 1024 × 600, fixed stacked rows left board cells only 11 × 15px; see [before](docs/perimeter/qa/cybercomic/before-table-1024.png). The wide layout now applies through 740px height and gives the field the left column, with companies, hand and commands on the right. Post-fix cells measure 89.39 × 88.80px at 1024 × 600 and 49.39 × 49.19px at 844 × 390. The hand remains a horizontal scroll strip; draw does not consume a whole card tile. Both layouts were captured and inspected again.
2. **P2 — full card hidden under actions on a short phone.** At 320 × 568 the expanded card ended at y=616.53 while actions started at y=440; see [before](docs/perimeter/qa/cybercomic/before-card-320.png). The compact-height inspection now uses the card's own live title/costs, keeps the dialog's duplicate labels accessible but visually hidden, fits the card to available height, and places actions side by side. After the fix the whole card spans y=58.77–445.28, above the action bar at y=487.63. Exact rules remain scrollable and both actions stay reachable.
3. **P2 — catalog horizontal overflow and disappearing controls.** The initial 320px catalog measured scrollWidth 306px against clientWidth 294px. Its grid tracks now allow shrinking, four filters use equal columns, and only the card panel scrolls. Post-fix scrollWidth equals clientWidth at every tested viewport; heading, filters and close remain visible.
4. **P2 — expanded catalog card moved out of view.** Making an open entry span the mobile grid relocated it below the visible panel. Its toggle now scrolls the opened entry to the panel start. A focused follow-up at 320 × 568 and 390 × 844 verified its summary aligned with the visible panel, detailed rules could be reached, and close still worked without returning to the top.

The broad scenario passed all five viewports. A keyboard check was corrected to enter keyboard modality with Tab before asserting `:focus-visible`; programmatic focus after mouse input was an invalid test assumption. A catalog probe was narrowed to the active tabpanel rather than its three hidden siblings. These were test corrections, not product fixes. Only those focused checks were repeated.

<a id="fidelity"></a>
## Required fidelity surfaces

- **Typography:** locally bundled Oswald preserves the heavy condensed card direction and Cyrillic. Titles, prices and short effects remain live text. All 18 full faces were checked for title/rule overflow; the longest defense name and expanded rules were also checked at mobile widths. Hand faces deliberately omit rule paragraphs and open readable full details on tap.
- **Spacing and layout:** cost row, colored title, illustration, category and calm rules block follow the selected hierarchy. Portrait keeps the opponent above and the player below; short wide screens use two columns to preserve usable board cells. No horizontal page/dialog overflow or hidden persistent match controls remained in the tested viewports.
- **Colors and states:** coral attack, cyan defense, amber economy and lime selection remain distinct; disabled availability is explained in text rather than color alone. Prices retain separate credit/action treatments.
- **Images:** all 18 individual illustrations loaded successfully at their native 768 × 576 source size. The metal frame and three core card subjects match the selected art direction; the combined comparison was opened and inspected. No generated lettering substitutes for game rules.
- **Copy:** names, short effects, complete rules, prices and action costs use `CARDS`. Live descriptions intentionally use the engine's current wording instead of the mock's illustrative copy. Long explanations remain outside the physical card face to preserve readable text.

No actionable P0/P1/P2 visual finding remains. Remaining limits are test coverage, not a claim of pixel-for-pixel replication of generated typography or art.

<a id="interactions"></a>
## Browser interaction checks

At all five viewports: start and deploy; reach every hand card; open full description; choose an empty own cell; build one server; scan; inspect and exchange a card; reload/resume; open the 18-card catalog; filter defense and expand the longest card. The server play debited exactly 240 credits and 1 action, leaving 60 credits / 2 actions and income 380. Free scan consumed only 1 action; free exchange preserved money and actions. Reload restored the same values.

Focused fixtures additionally verified:

- New Plan and Quiet Passage play without a target, debit 20/10 credits respectively and one action each.
- Anti-DDoS targets the own web node, debits 25 credits / 1 action and increases its shield from 1 to 2.
- DDoS targets a revealed unshielded enemy web node, debits 40 credits / 1 action and puts the node offline.
- All 18 illustrations and full title/rule blocks load without text overflow.
- Keyboard Tab/focus/Enter opens a card with a visible focus indicator.
- Reduced-motion setting and mobile catalog close behavior.

No uncaught page errors or console errors were observed in the broad five-viewport scenarios. The focused checks reported no page errors. These are Chromium viewport tests, not physical-device touch/performance tests or a newly signed Android APK.

## Code and packaging checks

- `pnpm test`: 53 passed, 0 failed.
- `pnpm lint`: 0 errors, 0 warnings.
- `pnpm exec tsc --noEmit`: passed.
- Web and Android web-asset builds: passed after layout fixes. The final catalog toggle was additionally compiled by Vite during the focused browser pass and checked by lint/TypeScript.
- `git diff --check`: passed.
- No balance, engine, network protocol or deployment configuration changed.
- Multiplayer transport was not re-tested in this visual-only follow-up; existing engine/room tests still pass.
