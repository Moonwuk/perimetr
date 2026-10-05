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


## Follow-up: direct card selection and online readiness

This follow-up supersedes the earlier tap-to-inspect behavior described above. A hand tap or keyboard Enter selects the card and highlights legal targets without opening a sheet. Repeated taps preserve the selection. Inspection is now an explicit “О карте” control; closing it preserves the card and target. The play button shows both credit and action prices, and only explicit play spends them. Targetless cards clear stale targets, do not highlight board cells and say that no target is needed. The tutorial and accessible labels describe the new flow.

Online preparation now exposes the ready action before the customizable board and defense controls. The screen shows whether the opponent has joined and confirmed readiness. The waiting copy distinguishes an absent player from a connected player who has not confirmed. Both players still explicitly approve their own deployment; the server starts automatically after the second approval.

### Verification

- Actual Chromium + Vite app at 320 × 568, 390 × 844, 844 × 390 and 1280 × 900: selection/repeated selection has no modal or debit; legal target highlights; explicit inspection and closing preserve selection; a New Server play deducts exactly 240 credits and 1 action; unavailable attacks remain selectable with exchange accessible; keyboard Enter selects; command controls fit the viewport. No uncaught page errors in these scenarios.
- Targetless fixture: New Plan and Quiet Passage clear the previous target, ignore board clicks as targets, and deduct exactly 20/10 credits and one action only on explicit play. [Machine-readable results](docs/perimeter/qa/selection/results.json).
- Mobile screenshots at 320 × 568 and 390 × 844 were opened and visually inspected for the new command footer. [Selected card at 320px](docs/perimeter/qa/selection/selected-320.png).
- 53 engine/save/room tests pass, including both readiness orders and host readiness before the second player joins.
- Actual local Cloudflare Worker + D1 with two independent Chromium contexts: host ready before guest admission, guest ready first, and simultaneous confirmation with a deliberately stale revision all automatically start both clients. The 409 deployment conflict is recovered with exactly one retry. First-turn ownership is correct; no page errors or horizontal overflow. The top ready button fits the first screen at both 320 × 568 and 390 × 844. [Browser report](docs/perimeter/qa/selection/network-start-report.json), [320px setup screenshot](docs/perimeter/qa/selection/setup-320.png).
- Full `pnpm cf:test` also passes against real local Worker + D1: independent HTTP clients, startup, hidden data, concurrent actions, reconnect, rematch, financial finish, assets/CSP, admission limits and scheduled handler.
- Lint, TypeScript and both web and Android web-asset builds pass; git diff whitespace check passes.

Production room and physical-device behavior are not established by these local checks. No signed APK, server rules, balancing changes or protocol changes are included in this follow-up.

## Follow-up: drag cards, public rooms and central metrics

This follow-up adds a second play gesture: hold a hand card for 280 ms, drag it onto a legal target, and release to submit the action. Mouse movement can start dragging immediately. A quick touch swipe still scrolls the hand. The floating card stays above the finger while a ring marks the actual hit point. Targetless cards use the labelled own-company panel. Releasing elsewhere cancels without spending resources. A short tap still selects directly and the explicit play/inspect controls remain available.

Card faces now carry one short effect. Full rules and the teaching note are collapsed behind “Подробнее”. On a short phone, the inspection card is sized to keep that control and both action buttons visible initially; the redundant generic target instruction was removed. Specific rejection reasons and selected-target forecasts remain available.

The online dialog provides automatic matching, creation and code admission. Creation defaults to private; public rooms enter search only while waiting for a guest and the host has been seen recently. Both players still explicitly confirm setup. The host can confirm “Закрыть комнату”; both seats return to the lobby and their saved online credentials are cleared. Returning to the menu alone preserves the room.

Online metrics are written to D1 by the Worker, with separate authenticated client drag diagnostics. The owner can open `/?reports=1` and download JSON using a Worker secret. See [setup and data contract](docs/METRICS.md). This is central collection, not an export of device-local metrics.

### Evidence and checks

- Actual Chromium touch events at 320 × 568, 390 × 844 and 844 × 390: hold and play, duplicate cards with one debit, enemy targeting, invalid/outside drops, targetless own-panel play, swipe-to-scroll, touch cancel, multi-touch and resize cancellation. Mouse drag and keyboard fallback also passed. [Drag report](docs/perimeter/qa/drag-online/drag-results.json), [guard checks](docs/perimeter/qa/drag-online/drag-guard-results.json), [320px drag](docs/perimeter/qa/drag-online/drag-320.png).
- Focused card inspection at 320 × 568 and 390 × 844: short effect only, details collapsed, open/close details, visible actions, closing preserves selection. “Подробнее” is initially above the action bar; its bottom is y=450.63/723.91 and the action bar starts at y=465.63/738.91 respectively. [Report](docs/perimeter/qa/drag-online/simple-card-results.json), [320px inspection](docs/perimeter/qa/drag-online/simple-card-320.png).
- Real local Worker + D1 and two independent browser contexts: private rooms excluded from search; close cancellation preserves the room; public search joins automatically; both ready confirmations start play; touch drop spends exactly 240 credits and 1 action; its server action and client gesture reach D1; a guest has no close control; host close returns both clients to the lobby. [Report](docs/perimeter/qa/drag-online/rooms-metrics-results.json).
- Actual owner JSON download: wrong/missing key rejected; successful export includes two abandoned matches, authoritative action cost and client gesture. Export contains no original room codes, keys, names or hidden layouts. Owner key is not persisted across reload. [Owner export screenshot](docs/perimeter/qa/drag-online/server-report-owner.png).
- An initial short-phone room screenshot exposed a partly clipped creation button. The room dialog now uses tighter spacing at short heights; a focused 320 × 568 check verifies the entire create button is initially visible and there is no horizontal overflow. [Updated room screenshot](docs/perimeter/qa/drag-online/create-public-320.png).
- 77 automated engine/save/room/metrics tests pass. Meaningful server regressions cover concurrent admission, close after a concurrent move, failed metric writes after successful play, fraud gross cost versus net balance, retention, and the D1 limit when exporting 100 matches.
- The Cloudflare smoke passed against real local Worker + D1, including `DELETE … RETURNING`, JSON-based export filtering, owner authorization, ingest, migration and cleanup. Lint, TypeScript, web and Android web-asset builds passed. Screenshots above were opened and inspected.

No game balance constants changed. Tests use a local Worker and emulated Chromium viewports; they do not establish production deployment, physical-phone performance or a new signed APK. The owner must set `METRICS_EXPORT_TOKEN` to enable report downloads after deployment. Collection itself does not require that export key.
