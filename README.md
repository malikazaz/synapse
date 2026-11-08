# Synapse

An offline-capable quiz runner with a private UKMLA competency tracker, using Cloudflare Workers/D1, Google sign-in, Google Sheets and authenticated MCP. AI generation and review happen in the user's ChatGPT subscription: this project contains no OpenAI inference call, API key or paid fallback.

**Public quiz runner:** [malikazaz.github.io/synapse](https://malikazaz.github.io/synapse/). Paste/upload, feedback, retries, reports, retakes and local backups work without an account. Quiz content stays in the browser; this build makes no account or private-backend requests.

**Private connected app:** deployed separately to an owner-configured Cloudflare Worker. Only the verified Google account in its private configuration can access saved packs, competencies, Sheets and MCP. The public repository contains implementation code, not the owner's deployed credentials, database or assessment history.

## Two builds, separate deployments

- `npm run build:public` creates `dist-public/` with the quiz runner and local storage adapter only. GitHub Actions tests it and publishes only this directory to Pages when `main` changes. There are no Cloudflare/Google secrets in the workflow.
- `npm run build` creates `dist/` for the connected app. `npm run deploy` deploys it manually using ignored `wrangler.production.jsonc` and locally authorised Cloudflare access. A GitHub push does not deploy this private app.
- `npm run test:public` verifies the public build at a `/synapse/` project path, including offline use, backup restore and absence of private requests.
- Pages must use **GitHub Actions** as its publishing source, rather than the repository root. See `.github/workflows/pages.yml`.

The GitHub and Cloudflare sites have separate browser storage. Public users can export/restore local backups to move between devices; they do not receive automatic cloud sync.

## On your phone

The private app has bottom navigation for Home, New quiz, My packs, Progress and More. More contains Study plan, My weak points, Sources, Connections and sign-in/out. Display opens theme, text-size and question-order settings. The public runner keeps its local quiz and backup tools.

Home puts your unfinished session first, followed by current evidence and study priorities. Progress uses readable topic cards on phones, with teaching-block/search controls and optional filters under Refine topics. Quiz navigation starts collapsed on phones; Question list opens it when needed, and Back/Next remain within reach. Exit quiz returns to Home with your attempt saved. The ChatGPT prompt opens in a dismissible sheet.

Refresh the private app and choose **Update Synapse** when offered to install a new offline version while preserving saved answers.

## Own quizzes

Paste text or upload `.txt`, without signing in. Put a blank line between questions:

```text
Question 1: Which option is correct?
A) First option
B) Second option
C) Third option
D) Fourth option
E) Fifth option
Answer: B
```

Immediate feedback, retries, first-answer scoring, navigation, random ordering, themes, reports and retakes are retained. Answers commit to IndexedDB before feedback. Resume saved quiz restores local work after reload.

**Save to my account** explicitly uploads a pack. Open that saved pack for tracked attempts. Unmapped questions score normally without changing competencies. My question packs → Topic mappings supports confirmed primary topic/domain mappings and audited exclusions. ChatGPT mapping proposals also need confirmation here.

## Connected learning

**Organise your packs:** My packs offers title/topic search, collection and teaching-block filters, learning stage, study status and sorting. Pin favourites to keep them first, or use Organise & details to assign a collection (type a new name to create one). Archive hides a pack from the main library and recent-pack cards; restore it from Archive at any time. Questions, mappings, attempts and competency evidence are preserved. Sessions & results is a separate expandable history section. Organisation syncs between devices; changes require a connection, while the last library snapshot and downloaded quizzes remain available offline. New installations and upgrades must apply `0004_pack_library.sql` before deploying the new backend.

Connect `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/mcp` in ChatGPT with OAuth and the same Google account. Add [the clinical CCS instructions](docs/CHATGPT-CCS.md) to your study project. Ask ChatGPT to retrieve context, teach or test, and save a question pack. Open its link on your phone or computer. Completion saves results and queues a Sheet update; ask ChatGPT for review when ready. Website completion never automatically starts a ChatGPT response.

Downloaded packs and pending answers remain on the device. Sync retries on opening, reconnection and focus, with 15-second polling while visible. Concurrent edits preserve both continuations for explicit resolution. Sign-out offers export before clearing account data. After deployment, close/reopen old app tabs to activate the updated offline shell.

## Competency and catalogue

The initial catalogue contains 655 conditions/presentations with permanent IDs, preserving MSK Record IDs. Eleven unresolved Appendix A labels are in [reconciliation](data/catalog-reconciliation.json). Connections previews later catalogue imports before confirmation.

Rule `ccs-2-akt` scores first answers to distinct questions in completed, mapped sessions. Exact duplicates, retakes and contextual tags add no mastery credit. Red is below 50%; Green needs 85% recent accuracy, two questions per domain, no domain below 50%, spaced fresh assessment evidence, and at least five clinical-application questions scoring 80% or better in the recent window. Other assessed topics are Amber. These are study rules, not validated clinical competence. Due dates and overdue status are separate.

The database is authoritative. Sheet writes are limited to CCS Progress, CCS Sessions and MSK J:N, linked by Record ID. Manual confidence, recall and notes stay separate. Failed writes leave results safely in D1 and retry through a five-minute scheduled Worker.

## Development and checks

```powershell
npm ci
npm run check
npm run db:local
npm run seed:local
npm run dev
```

Local anonymous quizzes need no credentials. Google sign-in requires a configured callback; the Worker has no development authentication bypass.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD '.cache/browsers'
npx playwright install chromium
npm run test:browser
npx wrangler deploy --dry-run --outdir .wrangler/build
node scripts/test-worker.mjs --browser
```

The Worker proof uses isolated storage and test-only injected sessions. It exercises OAuth, MCP, offline reload and device conflicts without creating production test accounts. See [setup](docs/SETUP.md) and [verification](docs/VERIFICATION.md). Production config and secrets are gitignored; the build publishes browser assets only. GitHub Pages publishes only the public quiz artifact.

## Backups and privacy

Connections exports/restores device packs and sessions, and the account's catalogue, packs and assessment history. Account restore requires an empty account, checks fingerprints/answer paths/scores, and is limited to 2 MB/5,000 rows; use D1 export/import for larger histories. Device restore refuses to overwrite a different continuation.

Local-only question text stays on the device. Explicit saves upload it to Cloudflare; authorised ChatGPT tools can retrieve it. Sheets receives progress/session summaries. Original source documents stay in ChatGPT or Drive. Private API/auth responses are never cached by the service worker.


Personal AKT learning now includes synced exam dates and block preferences, recall-first foundation/focused questions, stage-aware progress and a detailed weak-points profile. See [the learning and measurement contract](docs/AKT-LEARNING.md). The nine MCP tools include `get_akt_generation_skill`, `get_performance_profile` and `get_curriculum_context`. No OpenAI inference connection is used.
