import {mkdir,copyFile,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';
const publicOnly=process.argv.includes('--public');
const target=publicOnly?'dist-public':'dist';
const root=resolve('.'),output=resolve(target);
// Only these generated directories may be cleared; never accept an arbitrary path.
if(!['dist','dist-public'].includes(target)||!output.startsWith(root+sep))throw new Error('Unsafe build output path.');
await rm(output,{recursive:true,force:true});
await mkdir(resolve(output,'shared'),{recursive:true});
for(const file of ['app.js','styles.css','connected.css','manifest.json','icon-192.png','icon-512.png'])await copyFile(file,resolve(output,file));
for(const file of ['quiz.js','offline.js'])await copyFile('shared/'+file,resolve(output,'shared',file));
let html=await readFile('index.html','utf8');
if(publicOnly){
  html=html.replace(/  <script src="updates.js" type="module"><\/script>\r?\n/,'');
  html=html.replace('Your clinical learning companion','Your questions. Your pace.');
  html=html.replace(/  <nav class="workspace-nav"[\s\S]*?  <div class="connection-strip"/,`  <nav class="workspace-nav" aria-label="Local quiz tools">
    <button class="btn secondary small" id="resumeBtn">Resume saved quiz</button>
    <button class="btn ghost small" id="exportLocal">Export saved quizzes</button>
    <button class="btn ghost small" id="restoreLocalBtn">Restore backup</button>
    <input id="restoreLocal" type="file" accept="application/json,.json" hidden>
  </nav>
  <div class="connection-strip"`);
  html=html.replace('<span id="sheetStatus"></span>','').replace(/  <section id="workspace"[^\n]*\n/,'');
  await copyFile('public/local.js',resolve(output,'connected.js'));
  await copyFile('public/sw.js',resolve(output,'sw.js'));
}else{
  for(const file of ['connected.js','workspace.js','study-ui.js','updates.js','sw.js'])await copyFile(file,resolve(output,file));
  for(const file of ['sources.js','learning.js'])await copyFile('shared/'+file,resolve(output,'shared',file));
}
await writeFile(resolve(output,'index.html'),html);
await writeFile(resolve(output,'.nojekyll'),'');
const hash=createHash('sha256');
for(const file of (await readdir(output,{recursive:true})).filter(f=>/\.[a-z]+$/i.test(f)&&f!=='sw.js').sort())hash.update(await readFile(resolve(output,file)));
const sw=await readFile(resolve(output,'sw.js'),'utf8');
await writeFile(resolve(output,'sw.js'),sw.replace('synapse-shell-v3','synapse-shell-v3-'+hash.digest('hex').slice(0,12)));
console.log(`Built ${publicOnly?'public local-only quiz runner':'private connected app'} in ${target}; only allowlisted browser assets exported.`);
