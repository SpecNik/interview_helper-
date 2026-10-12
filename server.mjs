import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {POST} from './answer.mjs';
const host='127.0.0.1',port=Number(process.env.PORT||8766);
const files={'/':'public/interview.html','/interview.html':'public/interview.html','/client.js':'public/client.js'};
http.createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  try{
    if(req.headers.host!==`${host}:${port}`){res.writeHead(403,headers);res.end('Forbidden host');return}
    const path=new URL(req.url,`http://${host}:${port}`).pathname;
    if(req.method==='POST'&&path==='/api/answer'){
      const parts=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>100000){res.writeHead(413,headers);res.end(JSON.stringify({error:'Контекст слишком большой.'}));return}parts.push(chunk)}
      const controller=new AbortController();res.on('close',()=>controller.abort());
      const result=await POST(new Request(`http://${host}:${port}/api/answer`,{method:'POST',headers:req.headers,body:Buffer.concat(parts),signal:controller.signal}));
      res.writeHead(result.status,{...headers,...Object.fromEntries(result.headers)});
      if(result.body){for await(const chunk of result.body){if(res.destroyed)break;res.write(chunk)}}res.end();return;
    }
    if(req.method!=='GET'||!files[path]){res.writeHead(404,headers);res.end('Not found');return}
    const data=await readFile(fileURLToPath(new URL(files[path],import.meta.url)));
    res.writeHead(200,{...headers,'Content-Type':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});res.end(data);
  }catch{if(!res.headersSent)res.writeHead(500,headers);res.end('Request failed');}
}).listen(port,host,()=>console.log(`Рядом: http://${host}:${port}`));
