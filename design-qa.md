# Bottom hand and left controls — design QA

Final result: passed. Date: 2026-10-06.

The approved desktop revision is implemented in the existing game. The hand is horizontal below both boards; Standby, Recon, Journal, Help and Match menu sit on the left below the player's resources. Online matches add Pause and Room/connection to this rail. Command/result and End turn are directly below the board frames. Card assets, game rules and phone controls are preserved.

## Source and comparison evidence

- Source: user-approved generated reference `exec-48cabeec-09ab-40e3-be23-c2ee7407ed54.png`, 1593×987. Saved review copy: [selected-reference.jpg](docs/perimeter/qa/desktop-bottom-hand/selected-reference.jpg).
- [Combined full comparison](docs/perimeter/qa/desktop-bottom-hand/comparison-full.jpg) and [focused controls/hand comparison](docs/perimeter/qa/desktop-bottom-hand/comparison-focus.jpg) were opened as combined visual inputs and inspected.
- Both source and implementation use the same 1593×987 CSS viewport. The browser's outer viewport is 1363×936 at DPR 1; an actual 1593×987 iframe is displayed at 80%. Both comparison sides are normalized to 1274×790. The focused comparison is for structure, with region crops resized to a common review size.
- [Russian desktop](docs/perimeter/qa/desktop-bottom-hand/desktop-ru.jpg), [1100×650 desktop](docs/perimeter/qa/desktop-bottom-hand/desktop-compact-ru.jpg), [English node actions at 1100×650](docs/perimeter/qa/desktop-bottom-hand/desktop-compact-node-en.jpg), [390×844 English phone](docs/perimeter/qa/desktop-bottom-hand/phone-en.jpg).
- [Online desktop](docs/perimeter/qa/desktop-bottom-hand/desktop-online-en.jpg), [offline recovery](docs/perimeter/qa/desktop-bottom-hand/desktop-offline-en.jpg), [direct drag result](docs/perimeter/qa/desktop-bottom-hand/direct-drag-result.jpg), [low-height board after scrolling](docs/perimeter/qa/desktop-bottom-hand/desktop-low-scrolled-en.jpg).

Comparison state: Russian, round 1, own 40 credits/1 AP/+380 income, opponent 300 credits, four distinct cards (DDoS, Account protection, Anti-DDoS, Upgrade), no selection, confirmed recon feedback. The fixture uses real masked views and a real engine scan. The reference image contains illustrative node positions and an incorrect scan price/cell count; live board positions, 0-credit scan price and five revealed cells follow the engine. Existing card artwork, typography and responsive sizing are retained instead of generated image artifacts. These differences are intentional, not a game-rule change.

## Browser validation

Cloud browser rendered the actual DuelTable/Hand/GridBoard/NodeActions components with the deterministic engine-backed DEV fixture. Sizes checked: 1593×987, direct 1363×936, compact 1100×650, low-height 1100×501 and portrait 390×844. No page-wide horizontal or vertical overflow at these sizes. Hand uses horizontal overflow with `pan-x pinch-zoom`. Desktop controls are `display:none` on the phone. The compact node dock keeps all four actions, their reasons, About node and clear control visible. Low-height board regions scroll vertically with a minimum 280px grid and approximately 45px cells; scrolling to the bottom exposes the fifth row with complete labels/status flags.

- Left Standby, Journal, Help and Match menu open their detail sheets. Their production callbacks match the existing controls. Recon clears the selected card/target and selects the enemy board without spending an action.
- An unselected DDoS was dragged directly onto the discovered enemy web node, without an initial click. It consumed one card, 40 credits and one AP; local Anti-DDoS reflected it. Confirmed result showed preserved enemy money/income.
- Online fixture: a single visible Pause is on the left, with Room/connection below. Requesting it shows the existing pending-pause panel. Offline recovery blocks draw/end actions; Check connection removes the recovery panel and re-enables End turn.
- Network states are a local QA simulation; no production multiplayer session is claimed.
- No application console errors or warnings were recorded. Browser extension metadata errors were present and excluded by their chrome-extension URL.

## Iteration and checks

Initial desktop render already matched the layout hierarchy and removed the empty board frame space. Review found a duplicate legacy header Pause in online mode; it was hidden within the desktop media query, and the single left Pause was verified. Review also found compressed cell labels at very low heights; minimum grid height, local field scrolling and nonshrinking cell content fixed it. Browser geometry confirms 45.2px cells, 18px icons, 9.9px labels and 9px flags; a native scroll reached the last row at 1100×501. Full/focused comparisons and compact/phone states contain no outstanding P0/P1/P2 issue. The temporary viewport harness was removed; the deterministic fixture remains DEV-only.

ESLint, TypeScript, Cloudflare production build and Android web-assets build passed. Local suite: 146/147 passed; the sole failure is the existing Android native policy test because `javac` is absent in this environment. GitHub CI installs JDK 17 and must pass the full suite before merge. Existing Vite chunk-size advisory remains. No server protocol, deployment configuration or native package publication changed.

---

## Previous desktop/localization QA (2026-10-05)

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
