// Curated personal reference downloads, not a question-bank crawler.
// Originals stay private and retain their copyright/permission notices.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const references=[
 ['msc-paper-1.pdf','https://www.medschools.ac.uk/wp-content/uploads/2026/10/2026-AKT-Practice-paper-Part-1-with-answers-and-justifications-v2.pdf','MSC personal noncommercial use; no systematic database extraction.'],
 ['msc-paper-2.pdf','https://www.medschools.ac.uk/wp-content/uploads/2026/10/2026-AKT-Practice-paper-Part-2-with-answers-and-justifications-v2.pdf','MSC personal noncommercial use; no systematic database extraction.'],
 ['msc-handbook.pdf','https://www.medschools.ac.uk/wp-content/uploads/2026/10/MS-AKT-Student-Handbook-2027.pdf','MSC personal noncommercial use.'],
 ['nbme-item-writing.pdf','https://www.nbme.org/sites/default/files/2021-02/NBME_Item%20Writing%20Guide_R_6.pdf','Unmodified noncommercial educational copy with copyright and permission notices retained.'],
 ['retrieval-review.pdf','https://link.springer.com/content/pdf/10.1007/s10459-023-10274-3.pdf','Trumble E, Lodge J, Mandrusiak A, Forbes R (2024), CC BY 4.0; original unchanged.']
];
const directory='private/akt-library';await mkdir(directory,{recursive:true});const manifest=[];
for(const [file,url,rights] of references){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error('HTTP '+r.status);const bytes=Buffer.from(await r.arrayBuffer());if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('Not a PDF; no access-control bypass attempted.');await writeFile(directory+'/'+file,bytes);manifest.push({file,url,rights,retrievedAt:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,status:'downloaded'});console.log(file+': saved original PDF');}
 catch(e){manifest.push({file,url,rights,status:'unavailable',reason:e.message});console.log(file+': unavailable ('+e.message+')');}
}
await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2));
