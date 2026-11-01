// GitHub Pages adapter: local persistence only. No account, fetch, polling or MCP.
import {storage,restoreDevice} from './shared/offline.js';
import {replay} from './shared/quiz.js';
function download(records){
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:'synapse-device-v1',records},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='synapse-device-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
class LocalQuiz {
  localOnly=true;tab='quiz';selectedPack=null;active=null;queue=Promise.resolve();
  serial(fn){const next=this.queue.then(fn);this.queue=next.catch(()=>{});return next;}
  notify(message,error=false){const el=document.getElementById('connectionNotice');el.textContent=message;el.classList.toggle('error',error);}
  status(){document.getElementById('saveStatus').textContent=this.active?'Saved on this device':'';}
  async init(){
    this.notify('No account needed. Questions and answers stay in this browser.');
    document.getElementById('resumeBtn').onclick=()=>this.resumeLatest().catch(e=>this.notify(e.message,true));
    document.getElementById('exportLocal').onclick=async()=>{try{const records=(await storage('all')).filter(r=>r.kind==='session'&&!r.owner);if(!records.length)throw new Error('No saved quizzes to export yet.');download(records);}catch(e){this.notify(e.message,true);}};
    document.getElementById('restoreLocalBtn').onclick=()=>document.getElementById('restoreLocal').click();
    document.getElementById('restoreLocal').onchange=async e=>{try{const file=e.target.files[0];if(file){await this.serial(async()=>restoreDevice(JSON.parse(await file.text()),null));this.notify('Backup restored. Use Resume saved quiz to continue.');}}catch(error){this.notify(error.message,true);}finally{e.target.value='';}};
  }
  async save(next){await storage('put','session:'+next.id,next);this.active=next;this.status();}
  async begin(questions){return this.serial(async()=>this.save({kind:'session',id:crypto.randomUUID(),owner:null,packId:null,pack:{id:null,title:'Local quiz',questions},order:questions.map(q=>q.id),events:[],pending:[],currentIndex:0,revision:0,status:'active',serverCreated:false,needsCompletion:false,positionDirty:false,inflight:null,updatedAt:new Date().toISOString()}));}
  async answer(questionId,selection,index){return this.serial(async()=>{if(!this.active)return;const next=structuredClone(this.active);next.events.push({id:crypto.randomUUID(),questionId,selection,at:new Date().toISOString()});replay(next.pack.questions,next.events);next.currentIndex=index;next.updatedAt=new Date().toISOString();await this.save(next);});}
  async position(index){return this.serial(async()=>{if(this.active)await this.save({...this.active,currentIndex:index,updatedAt:new Date().toISOString()});});}
  async finish(){return this.serial(async()=>{if(this.active)await this.save({...this.active,status:'completed',updatedAt:new Date().toISOString()});});}
  async resumeLatest(){return this.serial(async()=>{
    const sessions=(await storage('all')).filter(r=>r.kind==='session'&&!r.owner&&!r.archived).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    if(!sessions.length){this.notify('No saved quizzes yet. Paste or upload a set to begin.');return;}
    this.active=sessions[0];this.status();document.dispatchEvent(new CustomEvent('synapse:session',{detail:{pack:this.active.pack,session:this.active}}));
  });}
}
export const connected=new LocalQuiz();
