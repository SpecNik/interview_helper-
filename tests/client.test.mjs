import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const elements=new Map();
function element(){return {value:'',textContent:'',disabled:false,hidden:false,checked:true,classList:{add(){},remove(){},toggle(){}},addEventListener(){},replaceChildren(){},append(){},showModal(){this.open=true},close(){this.open=false},click(){this.onclick?.()}}}
const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
let calls=0;
const scope={document:{getElementById:get,createElement:element},localStorage:{getItem(){return null},setItem(){}},window:{addEventListener(){}},navigator:{},AbortController,TextDecoder,Blob,URL,Date,setTimeout,clearTimeout,
  fetch:async()=>{calls++;const bytes=new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Привет"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close()}}))}};
vm.createContext(scope);vm.runInContext(await readFile('public/client.js','utf8'),scope);
get('question').value='';get('ask').click();assert.match(get('error').textContent,/Введите вопрос/);
get('question').value='Расскажите о себе';get('ask').click();assert.equal(get('config').open,true);assert.equal(calls,0);
get('apiKey').value='test-key-only';get('saveKey').click();assert.equal(get('apiKey').value,'');
get('ask').click();await new Promise(r=>setTimeout(r,50));assert.equal(get('answer').textContent,'Привет');assert.equal(get('ask').disabled,false);assert.equal(get('copy').disabled,false);
scope.fetch=async()=>Response.json({error:'Недостаточно средств на балансе DeepSeek.'},{status:402});get('ask').click();await new Promise(r=>setTimeout(r,50));assert.match(get('error').textContent,/балансе/);assert.equal(get('ask').disabled,false);
get('forgetKey').click();get('ask').click();assert.equal(get('config').open,true);
console.log('Client checks passed: no-key dialog, UTF-8 split SSE, provider error recovery, key deletion.');
