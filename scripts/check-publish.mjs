// Scan publishable files without printing any matched credential or personal value.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const staged=process.argv.includes('--staged');
const files=execFileSync('git',['ls-files','-z',...(staged?[]:['--cached','--others','--exclude-standard'])],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbiddenPath=/(^|\/)(node_modules|dist|dist-public|\.wrangler|\.cache|backups|private|test-results)(\/|$)|(^|\/)wrangler\.production\.jsonc$|(^|\/)\.dev\.vars|\.(pem|key)$|(^|\/)\.env(?!\.example$)/;
const patterns=[
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=]{24}/],
  ['Google service-account credential',/"type"\s*:\s*"service_account"/],
  ['OAuth client secret',/GOCSPX-[A-Za-z0-9_-]{20,}/],
  ['Google API key',/AIza[0-9A-Za-z_-]{30,}/],
  ['GitHub token',/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['AWS access key',/AKIA[0-9A-Z]{16}/],
  ['OpenAI secret',/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}/],
  ['personal email address',/\b[A-Z0-9._%+-]+@(?:gmail|icloud|outlook|hotmail)\.com\b/i],
  ['workbook identifier',/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]{35,}/]
];
const failures=[];
for(const file of new Set(files)){
  if(forbiddenPath.test(file)){failures.push(`${file}: private/generated path`);continue;}
  if(/\.(png|ico|woff2?)$/.test(file))continue;
  const body=staged?execFileSync('git',['show',':'+file],{encoding:'utf8',maxBuffer:10*1024*1024}):await readFile(file,'utf8');
  for(const [label,re] of patterns)if(re.test(body))failures.push(`${file}: ${label}`);
}
if(failures.length){console.error('Publication scan failed (matched values suppressed):\n'+failures.join('\n'));process.exitCode=1;}
else console.log(`Publication scan passed for ${new Set(files).size} files; no credential patterns, personal emails, workbook links or private paths detected.`);
