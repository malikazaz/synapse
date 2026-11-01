import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import type {Env} from '../server/types';
export function setup(){
  const db=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+file,'utf8'));db.exec("INSERT INTO topics(id,label,type) VALUES('C1','Example','Condition')");
  class Stmt {args:any[]=[];constructor(public sql:string){} bind(...args:any[]){this.args=args;return this;}async first(){return db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:db.prepare(this.sql).all(...this.args)};}async run(){const r=db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes)}};}}
  return {env:{DB:{prepare:(s:string)=>new Stmt(s),batch:async(stmts:Stmt[])=>{db.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}},APP_ORIGIN:'https://synapse.test'} as unknown as Env,db};
}
