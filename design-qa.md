# Desktop table and English — design QA

Result: passed. Date: 2026-10-05.

Implemented the user's selected third desktop concept in the existing game. Real card artwork, engine, masked player views, drag behavior, network protocol and saved games are retained.

## Visual evidence

- [Selected concept versus implementation](docs/perimeter/qa/desktop/comparison-final.jpg): source 1669×942, live fixture 1672×944, both normalized to 1343×759. Same round 4, own C2 offline and selected, 280 credits, 2 AP, five-card hand, two discovered enemy nodes.
- [Russian desktop](docs/perimeter/qa/desktop/desktop-ru.jpg).
- [English desktop](docs/perimeter/qa/desktop/desktop-en.jpg).
- [390×844 English phone](docs/perimeter/qa/desktop/phone-en.jpg).

The combined comparison was opened and inspected. Initial defects: old stylesheet order constrained the desktop to 1000 pixels; actions were undersized; the third hand row was clipped. Corrected import order, grid sizing and type scale. Final comparison has no remaining P1/P2 visual defects. Intentional differences: existing card art, category tabs, network links, numeric AP, and a Journal shortcut when no card is selected. Pause is shown only for online matches. Player-provided company names stay verbatim in both languages.

## Browser checks

Actual React game and deterministic engine-backed fixture were exercised in the cloud browser. Viewports: desktop 1672×944, laptop 1280×720, portrait 390×844 and 320×568, landscape 844×390. No page-wide horizontal overflow. The hand scrolls when necessary; short portrait screens scroll their board to preserve useful cell sizes. Node actions remain visible. A follow-up phone adjustment removes permanent route/hidden-cell captions and their grid rows; the space returns to the board, while a selected card still shows its target hint.

- Own offline C2 immediately exposes Restore, Investigate, Isolate and Cleanse, with disabled reasons.
- Restore spends one AP and zero credits, keeps the selection, restores operation and does not refund interrupted income.
- Selecting DDoS opens the action dock, with no forced description modal. Selecting enemy C2 previews its countermeasure; playing spends 40 credits and one AP, consumes one defense charge and shows “Attack blocked”.
- RU/EN switching retains treasury, AP, selections and the match. Reload retains the language. Cross-tab language changes synchronize. Local bot match resumes from its save.
- Laptop cell contents were tightened after inspection to avoid clipped node names.

The frontend-only hosted preview cannot reach the separate scratch API process through localhost; a network-room attempt there returned an empty proxy response. This is a preview environment limitation. Network behavior was verified independently against both real local server implementations below, not claimed as a browser-to-production test.

## Automated verification

- TypeScript and ESLint passed.
- 135 tests: 134 passed locally; the existing native Android Java policy test cannot run because this environment has no `javac`. It is not skipped or modified. GitHub CI installs JDK 17 and runs the entire suite.
- Seven new localization tests cover every card/node description, template slots, dynamic resource errors, compound labels, game-state invariance, unknown text and player-authored journal names.
- Cloudflare production build and Wrangler dry-run passed.
- Cloudflare Worker + real local D1 smoke test passed with two independent authenticated clients: ready/start, private views, turn validation, CAS, pause/resume, reconnection, surrender, rematch and central metrics.
- VPS production build and Node/SQLite smoke test passed, including restart persistence.
- Android web-assets build passed. No new signed APK/AAB or store publication is claimed.

Remaining non-blocking build warning: the existing single application chunk is above Vite's 500 kB advisory threshold. No production deployment was performed by this change.
