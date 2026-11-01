import {readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const config='wrangler.production.jsonc';
try{await access(config);}catch{console.error('Deployment not configured. Follow docs/SETUP.md and create ignored wrangler.production.jsonc.');process.exit(1);}
const raw=await readFile(config,'utf8');
if(raw.includes('local-only')||raw.includes('REPLACE_')||!raw.includes('https://')){console.error('Production configuration still contains placeholders.');process.exit(1);}
// Deliberately no --temporary, account creation, plan upgrades, or model credentials.
for(const args of [['scripts/build.mjs'],['node_modules/wrangler/bin/wrangler.js','deploy','--config',config]]){
  const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,WRANGLER_LOG_PATH:resolve('.wrangler/logs'),WRANGLER_SEND_METRICS:'false'}});if(result.status!==0)process.exit(result.status??1);
}
