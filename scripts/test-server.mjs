import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const publicOnly=process.argv.includes('--public'),prefix=publicOnly?'/synapse':'',port=publicOnly?8788:8787;
const root=resolve(publicOnly?'dist-public':'dist');
http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(prefix&&!pathname.startsWith(prefix+'/')){res.writeHead(404).end();return;}
  const path=pathname.slice(prefix.length);
  if(!publicOnly&&path==='/api/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({connected:false,actor:null}));return;}
  if(!publicOnly&&path.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"Sign in required"}');return;}
  const target=resolve(root,'.'+(path==='/'?'/index.html':path));if(!target.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{const bytes=await readFile(target);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(target)]??'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end();}
}).listen(port,'127.0.0.1');
