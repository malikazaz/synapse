# Connect and deploy Synapse

GitHub Pages publishes the public quiz runner. The connected app is a separate, owner-only Cloudflare deployment; substitute your private configuration values below. No credentials or personal workbook identifiers belong in this repository.

## 1. Accounts and hard cost boundaries

- Use a Cloudflare account on **Workers Free**, not Workers Paid. Use the supplied workers.dev hostname; no domain purchase is required. Do not enable paid overages or add AI products. Confirm the account plan in the Cloudflare dashboard before deploying.
- Create a Google Cloud project with billing **unlinked**. Enable the Google Sheets API. Use standard request quotas; do not request paid quota increases. The runtime batches requests and leaves failed jobs pending.
- Use your existing ChatGPT Pro subscription. Do not configure API billing or extra credit purchases for this app. Included usage limits still apply.

## 2. Cloudflare setup

In this checkout, run `npx wrangler login` and complete the browser sign-in. Then run:

```powershell
npx wrangler whoami
npx wrangler d1 create synapse
npx wrangler kv namespace create OAUTH_KV
```

Copy `wrangler.jsonc` to the **gitignored** `wrangler.production.jsonc`. Replace both `local-only` IDs with the returned D1/KV IDs. Set APP_ORIGIN to your actual HTTPS workers.dev origin, OWNER_EMAIL to the Google account that should own Synapse, and keep SHEETS_ENABLED false until the test spreadsheet passes. The committed config contains placeholders; personal configuration belongs only in the ignored production config.

Run the production migrations and catalogue seed:

```powershell
npx wrangler d1 migrations apply synapse --remote --config wrangler.production.jsonc
npx wrangler d1 execute synapse --remote --config wrangler.production.jsonc --file data/catalog.sql
```

The seed uses INSERT OR IGNORE; it never overwrites an existing topic ID. Catalogue discrepancies are listed in `data/catalog-reconciliation.json`. Validate aliases before adding missing body-system associations.

## 3. Google sign-in

In the Google project's Auth Platform configuration, create a Web application OAuth client. For personal testing, add your Google account as a test user. Request only `openid email` for website identity. Configure this exact redirect:

`https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/auth/callback`

Set runtime secrets using the interactive prompts below (never paste credentials into chat, command arguments or Git):

```powershell
npx wrangler secret put GOOGLE_CLIENT_ID --config wrangler.production.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.production.jsonc
```

Only the configured verified Google email may sign in. Database ownership uses Google's stable subject ID. Local development needs its own authorised callback at `http://localhost:8787/auth/callback`; put local values in ignored `.dev.vars`.

## 4. Sheet service account and proof

Create a dedicated Google service account without broad project roles. Create its credential and store the JSON as the GOOGLE_SERVICE_ACCOUNT Worker secret. Share only the intended workbook with this service account as an editor. Do not grant domain-wide delegation.

First use a **disposable copy** of the workbook: configure its spreadsheet ID, enable SHEETS_ENABLED, deploy, sign in, save a two-question test pack, finish it, and verify both CCS tabs. Revoke access once to verify an actionable error and that quiz results survive; restore access and retry. Keep the test account database separate from production to avoid counting proof questions as learning evidence.

Before connecting the real workbook, make a Drive backup. The intended target is `YOUR_SPREADSHEET_ID`. Runtime writes only CCS Progress, CCS Sessions and MSK J:N. MSK formulas link to CCS Progress by Record ID. Preserve B:F and all existing validation, notes and formulas.

`node scripts/install-sheet-secret.mjs 'C:\path\to\key.json'` installs a downloaded service-account key privately. Keep that file outside the repository. `npx tsx scripts/test-sheet-connection.ts 'C:\path\to\key.json'` uses an isolated database. Set SYNAPSE_TEST_SPREADSHEET_ID, SYNAPSE_OWNER_EMAIL and SYNAPSE_DISPOSABLE_TEST=yes explicitly before running it against a disposable workbook; never use a study workbook.

## 5. Publish and connect ChatGPT

```powershell
npm ci
npm run check
npm run deploy
```

Deploy uses the ignored production config and refuses local placeholders. It does not create a temporary/public test account or upgrade a plan. GitHub Pages is deployed independently by `.github/workflows/pages.yml`, using only `dist-public/`.

In ChatGPT web, open https://chatgpt.com/plugins → + → Add custom MCP server. Connect `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/mcp` with OAuth. Leave static client credentials blank for dynamic registration. Sign in using the same Google account, inspect Synapse consent and grant read/write scopes. Create/install the plugin, select @Synapse in a conversation, and add `docs/CHATGPT-CCS.md` to your study project. Verify study context, saving a pack, opening it, completing it and reading results. See [official connection instructions](https://developers.openai.com/api/docs/guides/custom-mcp-server).

Custom MCP availability and native mobile app support must be tested on the account. The baseline is ChatGPT web and Synapse in desktop/mobile browsers. Nothing in Synapse automatically starts a ChatGPT response.

## 6. Backups and recovery

Connections → Export account backup downloads packs, answer paths, mappings, exclusions, reviews and audit history. Restore works only into an empty account and checks question fingerprints and scores. The first release limits JSON restore to 5,000 rows; use D1 SQL export/import for larger histories. Export a D1 backup before migrations:

```powershell
npx wrangler d1 export synapse --remote --config wrangler.production.jsonc --output backups/synapse.sql
```

Store backups privately. Sign-out offers an export of unsynced device data before clearing that account's local data. A device conflict preserves both continuations and offers a cloud continuation or a separate local practice attempt.

## Verification boundaries

Local tests do not prove Google consent, service-account permissions, real phone storage behaviour, or ChatGPT tool use. Complete the account proof above before relying on cross-device or spreadsheet sync. At free-tier quota limits, keep offline answers and retry later; do not silently enable paid infrastructure.
