# Verification — 2026-11-01

Passed:

- Public/private publication split: six additional desktop/phone browser checks pass against a `/synapse/` project subpath. Public paste/upload, wrong-answer retries, first-answer scoring, offline reload/resume, reports, retakes and device backup export/restore work without private API requests. Private server/config/catalogue assets are absent from the public build.
- Publication scan checks both working files and the exact staged Git content for common credential patterns, personal email addresses, workbook links and forbidden private/generated paths. Personal operational notes are retained locally in ignored `private/`; committed configuration uses placeholders.
- GitHub Pages workflow publishes only `dist-public/` after tests. It holds no Cloudflare or Google credentials and does not deploy the private Worker.

- Strict TypeScript checking and 24 unit/integration tests: consent callback policy, parsing/scoring, eligibility, coverage/retention, conflicts, mapping/exclusion, account restore and Sheet failure/retry behavior. Small practice sessions cannot indefinitely postpone a Green review.
- Thirty-two Playwright checks across desktop/mobile viewports: paste/upload, retries/reports, offline reload, retakes, no inference or account uploads for local quizzes, device restore and conflicting-restore protection; account-driven homepage metrics; empty/unavailable/stale states; source search; catalogue-derived filters; asynchronous navigation races; direct Sources links; 320px viewport with 30px text; background cloud updates preserving the selected view.
- Isolated real Worker: private API, CSRF, D1 mutations, idempotency, OAuth PKCE consent/token exchange, nine MCP tools and a 20-question generated pack.
- Session and pack summaries verified against real isolated D1 data, including question count, distinct answered count and server-calculated score. Authenticated MCP study context returns source policy `uk-sources-1` and the reference directory.
- Desktop and phone home screenshots inspected in dark and light themes using explicitly mocked learning records. No demonstration assessments were written to the production account. Dashboard uses recent cloud activity (latest 100 sessions), not a lifetime history total.
- UI/source release deployed to the existing Worker as version `3dcfdc96-2036-457c-95ff-3b6b7148ba9e`. Read-only live phone-browser smoke passed: default home, direct Sources view with 25 references, paste/upload, enabled sign-in, anonymous progress 401, OAuth resource discovery 200, no browser errors and no external/inference requests. Reproduce with `node scripts/check-live-ui.mjs` (network/browser access required).
- Two browser contexts against that Worker: offline phone answer survives reload and syncs once; computer resumes/completes; MCP retrieves results; concurrent edits preserve both answer paths.
- Browser consent regression: reproduced first-click CSP redirect blocking followed by a consumed-consent error on retry. Consent now permits the validated registered callback origin; a real cross-origin callback server verifies successful navigation and OAuth state on the first click. The original programmatic redirect test did not cover browser CSP enforcement.
- Live Cloudflare app and OAuth discovery; anonymous private routes return 401. User confirmed Workers Free and successful deployed Google sign-in.
- Real service account against a disposable copy: 655 topic rows, 50% Amber fixture, one session after retry, unchanged manual MSK values/formulas/formats/validation.
- Production scheduled Worker completed the initial Sheet sync. Verified 655 distinct IDs, all Untested with zero evidence; the entire MSK A4:I100 manual-cell/formula/format/validation snapshot stayed identical. New CCS headers, widths, wrapping, filters and conditional colours are confined to the planned CCS areas. Formatting verified through Sheets API; native on-screen fit has not been inspected in an authenticated browser.

Additional AKT and Year 3 release checks:

- Recall-first foundation/focused questions, optional confidence and active/recall timing survive local reload and answer sync. Generated answer balancing preserves each option rationale. Settings reject stale concurrent saves and preserve the local draft. Five clinical-application answers are now required alongside the original Green coverage/retention rules.
- All nine MCP tools were exercised through the isolated Worker. The deployed, authenticated study-context tool returned six curriculum blocks, current MSK preferences and existing assessment evidence after release. Existing scores were preserved; legacy question stages remain unclassified.
- Six school guides imported as 621 curriculum entries, with 25 ambiguous entries retained for reconciliation. Original 655 catalogue IDs and classifications remain intact. Database export and full workbook copy were taken before migration.
- Six Year 3 workbook views contain 361 distinct linked topics. A disposable-copy edit to MSK propagated to Medicine 2, Primary Care, Domain 6 and Appendix A. Production verification found zero formula errors, checked 1,805 manual values against the plan, preserved 420 original MSK manual cells and their dropdown rules, and found no changes across 5,775 original main-tab manual values. New topic rows have verified rating dropdowns.
- All production Sheet jobs are synced. CCS Curriculum/Map and learning-stage columns were formatted through the Sheets API; no authenticated native Sheets visual inspection is claimed. Shared manual ratings use one editable home, with links from other views; overwriting those formulas is not bidirectional editing.
- Phone screenshots of recall-first and weak-points views were inspected. The unwanted coloured left border is removed while the skipped-question warning and Finish behaviour remain.

Cache-upgrade regression fix:

- Reproduced blank Study plan/My weak points tabs by installing the actual earlier release into a browser cache, then serving new navigation with the old renderer. Fresh-browser tests had missed this upgrade path.
- A standalone update notice lets an existing client activate the new Worker and reload after persisting local work. Import text/file content survives in a temporary tab-scoped draft, and active quiz sessions resume by ID. Study-plan drafts are saved before updating. Account/API responses remain uncached.
- Navigation and application modules now come from the same release cache. Cached HTML responses are recreated to handle Cloudflare’s canonical index redirect safely. The regression tests include that redirect and verify both tabs render, an exam date saves, a real wrong-answer record and score survive, and pasted text remains intact on desktop and phone. Live navigation and privacy smoke passed after deployment.

Teaching-block presentation release:

- All six blocks have independent teaching-block, guide-section, teaching-scope and body-system controls, with original wording, source locations and mapping notes. Home and weak-point priorities show guide origins. Study-plan selections retain their original values.
- Desktop/phone tests cover MSK radiology versus surgery origins for bladder cancer, all six blocks, retained topics, unresolved entries, offline descriptions and legacy preferences. Phone layout was visually inspected.
- Real Worker tests verify authenticated pagination beyond 100 entries and reject invalid page bounds. No migrations, catalogue re-imports, scoring changes or Sheet edits were made. Live MCP classification and UI/privacy smoke passed.

Session-management release:

- End session retains incomplete practice or completes a fully answered attempt; Discard removes unfinished attempts from active study while retaining answer history. Completed results cannot be discarded through these controls. Stale cloud/device summaries no longer make completed attempts appear active; unsynced answers remain conflicts.
- Unit tests cover revision checks, owner isolation, idempotency, incomplete-evidence exclusion, duplicate exposure protection and account-backup restoration. Desktop/phone tests cover confirmations, local end/discard, reload, partial reports and stale-device lists. Real Worker/browser checks verify account actions across phone/computer, anonymous rejection and protection of completed results. Public paste/upload tests pass.
- No existing production session was ended or discarded during release verification. The new controls require the learner to choose an attempt and confirm.

Boundaries:

- User confirmed ChatGPT account connection. A user-created pack round trip is separate from the isolated protocol tests and has not been confirmed in this UI-review turn.
- Mobile viewport tests use Chromium; physical iOS/Android storage and native ChatGPT-app MCP support need device checks. Desktop/mobile web is the baseline.
- Eleven original Appendix A labels and 25 new guide entries need reconciliation; all 655 catalogue topics are present. Unresolved guide entries do not award competency credit.
- Revoked access was tested with a simulated Google 403. The real proof verifies authorisation, writes and retry without revoking user permissions.
- JSON restore is capped at 2 MB/5,000 rows; use D1 backups above this. Free-tier quota failures delay sync without enabling paid resources.

Publication: the public quiz runner is deployed to https://malikazaz.github.io/synapse/. Private deployment and workbook identifiers are intentionally omitted; keep them in ignored local setup notes.


Mobile interface release — 2026-11-08:

- Compact header; five-item bottom navigation for private phone views; accessible native dialogs for secondary navigation, display preferences and the personalised ChatGPT prompt. Controls retain their event handlers when crossing the phone/desktop breakpoint. No third-party fonts, icons, trackers or runtime services were introduced.
- Mobile home prioritises the unfinished attempt, then evidence and next actions. Progress retains stable topic IDs, teaching-block/guide/body-system filters and the existing evidence, but displays topic cards on phones and a table on larger screens. Advanced filters have a visible active count.
- Larger touch controls, safe-area spacing, keyboard-aware navigation, long-question wrapping, a collapsed question list, sticky Back/Next, explicit correct/retry feedback and an Exit quiz action. Display dialogs cannot trigger quiz keyboard shortcuts.
- Thirty-six browser checks cover phone/desktop flows, 320/390/430/844px widths, 30px text, light/dark themes, keyboard dismissal and focus return, draft preservation, long questions, offline reload and the previous-version upgrade. Six public-build checks cover the project subpath, uploads, random order, scoring, reports, retakes and backup restore without private requests. These are automated Chromium viewports, not a claim of physical-device Safari testing.
- Isolated Worker/browser checks preserve owner-only access, offline answers, cross-device continuation, session ending/discarding and conflicts. No schema, scoring, curriculum or spreadsheet changes are part of this release.
- Deployed private mobile release `65f5bde4-90fb-46b5-ac03-13dcf4593ce0`. Read-only live phone checks passed for More navigation, Display settings, Sources, signed-out study/progress gates, paste/upload and OAuth discovery, with no external/inference requests.


Pack library release — 2026-11-08:

- Account-owned collections, pins and reversible archive are stored separately from immutable question content. Revision checks reject stale edits. Archived packs remain accessible by direct link and retain all sessions and competency evidence.
- Library searches titles, confirmed topic labels, collections and topic blocks; filters include teaching block, learning stage, study status and collection. Only imported teaching blocks appear in that filter; earlier catalogue groups are not presented as additional teaching blocks. The first 12 matching packs are shown, with Show more and paged loading for libraries beyond 500 packs.
- Recent homepage packs omit archived items. Session history is separately expandable; conflicts remain visible. The cached library is labelled offline and organisation writes require reconnection. Downloaded packs continue to work offline.
- A real-database test covers owner isolation, stale-edit rejection, unaltered questions/evidence, statistics, archive/restore and v3 backup round trips; v1/v2 backups retain compatibility. Phone and desktop library tests cover search, pagination, pin, collection, archive/restore, filtering and offline snapshots. Existing public quiz and session lifecycle checks remain required.
- Production database was exported privately before applying the additive `0004_pack_library.sql` migration. Private release `059b38fc-26e3-4a41-9e80-5ae344465c1d` was deployed after 25 database/unit checks, library browser checks and isolated Worker checks. The live signed-out library and privacy checks passed.


Mobile answer visibility correction:

- Back/Next now stay in normal page flow after the answer options. The fixed app navigation is hidden only while answering on phone-width screens; Exit quiz and completion restore it. Redundant Resume and routine connection text are hidden during answering, while save status, errors and Save to my account remain available.
- A short-viewport regression checks D and E at both 320px and 390px widths with 600px height: each option can be fully scrolled into view, its centre receives taps, and the footer begins below the final option. Wrong/correct selections, exit/resume and completion retain scoring and restore navigation. Public paste/upload and real account offline/sync/session checks pass with the revised navigation.


Focused phone quiz — 2026-11-08 (supersedes the page-flow footer above):

- Phone quizzes use a bounded dynamic viewport with compact header, an independently scrolling question region, and a separate Back/Next row. Controls reserve actual layout space instead of overlaying answers. New questions reset only the question scroll; answering preserves the current question's scroll. The question list closes after selecting a question.
- Branding, navigation, save-pack and detailed connection information move out of the answering surface. Existing save/export/status elements move into a native quiz-settings dialog, retaining their handlers, and return on exit/desktop resize. A compact status line still exposes save errors during answering. Explanation has a reachable footer shortcut after a correct answer; recall-first, confidence and first-answer scoring are unchanged.
- Added Apple Home Screen metadata and an in-menu installation guide. Standalone mode is user-selected; the app does not claim to hide Safari's native chrome or transfer unsynced browser storage automatically.
- Chromium checks cover short 320/390px screens, lower-choice hit targets, bounded scrolling, 30px text, 480px viewport height, recall reveal, explanation access, errors, dialog focus return, exit/resume/completion and restoring desktop controls. Existing 40 browser checks plus two new focused-screen checks pass. All 25 unit/database checks, six public checks, and the isolated real-Worker/account/offline/session tests pass. Physical iPhone testing remains a user-device check.

- All four focused/mobile flow tests also passed in Playwright WebKit 27.2 on Windows. Reproduce after building with `npx playwright install webkit` and `npx playwright test --config playwright.webkit.config.js`. This exercises the Safari engine, not native iPhone browser chrome.
