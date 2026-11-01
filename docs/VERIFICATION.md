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
