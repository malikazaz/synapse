import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseQuestions,replay,fingerprint,balancedKey,DOMAINS} from '../shared/quiz.js';
import {calculateCompetency,eligibleEvidence} from '../shared/competency.js';
import {prepareMutation,acknowledge} from '../shared/offline.js';
const text='Question 1: Test?\nA) Alpha\nB) Beta\nC) Gamma\nD) Delta\nE) Epsilon\nAnswer: B';
test('legacy format, CRLF and multiline stems remain supported',()=>{
  const qs=parseQuestions(text.replace(/\n/g,'\r\n')+'\r\n\r\n'+text.replace('Test?','Another\nline?'));
  assert.equal(qs.length,2);assert.equal(qs[1].question,'Question 1: Another\nline?');assert.equal(qs[1].original_q_number,2);
  assert.throws(()=>parseQuestions(text.replace('E) Epsilon\n','')),/Expected 5/);
});
test('first attempts score; retries lock only after correct; incomplete quiz is identifiable',()=>{
  const qs=parseQuestions(text).map(q=>({...q,id:'q'}));
  const result=replay(qs,[{questionId:'q',selection:'A'},{questionId:'q',selection:'B'}]);
  assert.equal(result.score,0);assert.equal(result.records.q.is_locked,true);assert.deepEqual(result.records.q.selection_history,['A','B']);
  assert.throws(()=>replay(qs,[{questionId:'q',selection:'B'},{questionId:'q',selection:'A'}]),/locked/);
  assert.equal(replay(qs,[]).answered,0);
});
test('fingerprints ignore numbering, answer letters, and option order',async()=>{
  const q:any=parseQuestions(text)[0],other={...q,question:'Question 99: Test?',options:{...q.options,A:q.options.B,B:q.options.A},answer:'A'};
  assert.equal(await fingerprint(q),await fingerprint(other));
  for(const n of [1,7,20,31]){const key=balancedKey(n);const counts='ABCDE'.split('').map(k=>[...key].filter(l=>l===k).length);assert.equal(key.length,n);assert.ok(Math.max(...counts)-Math.min(...counts)<=1);}
});
function ev(n:number,at='2026-10-01T12:00:00Z',session='one',correct=true):any[]{return Array.from({length:n},(_,i)=>({eventId:session+i,fingerprint:session+i,sessionId:session,topicId:'C1',learningStage:'clinical',domain:DOMAINS[i%5],correct,completedAt:at,exposedAt:at,excluded:false}));}
test('untested, red, provisional amber and coverage/retention green boundaries',()=>{
  assert.equal(calculateCompetency([]).status,'Untested');assert.equal(calculateCompetency(ev(5,undefined,undefined,false)).status,'Red');
  assert.equal(calculateCompetency(ev(20)).status,'Amber');
  const good=[...ev(10),...ev(10,'2026-10-08T12:00:00Z','two')];
  assert.equal(calculateCompetency(good).status,'Green');assert.equal(calculateCompetency(good).coverage,5);
  assert.equal(calculateCompetency([...ev(10),...ev(10,'2026-10-07T12:00:00Z','two')]).status,'Amber');
  assert.equal(calculateCompetency(good.map(e=>({...e,domain:'management'}))).status,'Amber');
  good.slice(-4).forEach(e=>e.correct=false);assert.equal(calculateCompetency(good).status,'Amber');
});
test('repeated, unmapped, excluded, and incomplete first exposures never inflate mastery',()=>{
  const first=ev(1)[0],retake={...first,eventId:'again',sessionId:'two',exposedAt:'2026-11-01',completedAt:'2026-11-01'};
  assert.equal(eligibleEvidence([first,retake]).length,1);
  assert.equal(eligibleEvidence([{...first,topicId:null},retake]).length,0);
  assert.equal(eligibleEvidence([{...first,completedAt:null},retake]).length,0);
  assert.equal(eligibleEvidence([{...first,excluded:true},retake]).length,0);
});
test('retention intervals extend only with spaced successful fresh assessments',()=>{
  let rows=[...ev(10),...ev(10,'2026-10-08T12:00:00Z','two')];assert.equal(calculateCompetency(rows).nextReview,'2026-10-22T12:00:00.000Z');
  rows.push(...ev(5,'2026-10-15T12:00:00Z','three'));assert.equal(calculateCompetency(rows).nextReview,'2026-11-12T12:00:00.000Z');
  rows.push(...ev(5,'2026-10-22T12:00:00Z','four'));assert.equal(calculateCompetency(rows).nextReview,'2026-12-17T12:00:00.000Z');
});
test('small practice sessions cannot postpone Green review or combine into a retention check',()=>{
  const rows=[...ev(10),...ev(10,'2026-10-08T12:00:00Z','two')];
  rows.push(...ev(1,'2026-10-16T12:00:00Z','small'));
  assert.equal(calculateCompetency(rows).nextReview,'2026-10-22T12:00:00.000Z');
  rows.push(...ev(2,'2026-10-20T12:00:00Z','tiny1'),...ev(3,'2026-10-20T12:00:00Z','tiny2'));
  assert.notEqual(calculateCompetency(rows).nextReview,'2026-11-17T12:00:00.000Z');
});
test('offline acknowledgement retains new answers and retries an immutable mutation',()=>{
  const e={id:'one'},s:any={pending:[e],revision:3,currentIndex:0,events:[e],needsCompletion:false};
  const m=prepareMutation(s);assert.equal(m.expectedRevision,3);s.inflight=m;assert.equal(prepareMutation(s),m);
  const next={id:'two'};s.pending.push(next);const merged=acknowledge(s,{revision:4,state:{events:[e]},status:'active'},m);
  assert.deepEqual(merged.pending,[next]);assert.deepEqual(merged.events,[e,next]);
});
test('whole-map import preserves stable IDs and separates condition/presentation homonyms',async()=>{
  const catalog=JSON.parse(await readFile('data/catalog.json','utf8'));assert.equal(catalog.topics.length,655);assert.equal(new Set(catalog.topics.map((t:any)=>t.id)).size,655);
  assert.equal(catalog.topics.find((t:any)=>t.id==='C384').aliases[0],'Scleroderma and mixed connective tissue disease');
  assert.equal(catalog.topics.filter((t:any)=>t.label==='Soft tissue injury').length,2);
});
