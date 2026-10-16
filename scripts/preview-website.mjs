import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../docs');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.ttf':'font/ttf','.mp4':'video/mp4','.json':'application/json'};
const server=http.createServer((req,res)=>{
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
  if(file===root)file=path.join(root,'index.html');
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  const size=fs.statSync(file).size;
  const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
  let start=0,end=size-1,status=200;
  if(req.headers.range){
    const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    if(!match){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}
    start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;
    if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length']=end-start+1;
  res.writeHead(status,headers);
  if(req.method==='HEAD'){res.end();return;}
  const stream=fs.createReadStream(file,{start,end});stream.pipe(res);res.on('close',()=>stream.destroy());
});
server.listen(8767,'127.0.0.1',()=>console.log('Local: http://localhost:8767/'));
