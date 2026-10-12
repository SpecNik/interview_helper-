const $=id=>document.getElementById(id);
let key='',controller=null,history=[],pendingQuestion='',questionBuffer='',autoTimer,active=false,stream,recognition,restartTimer,epoch=0;
let audioContext=null,audioNode=null,audioAnalyser=null,audioTimer=null,lastRecognized=0;
const sourceLabel=()=> $('audioSource').value==='microphone'?'микрофон':'вкладку Meet';
const showError=t=>{$('error').textContent=t};
function status(t,live=false){$('status').textContent=t;$('status').classList.toggle('live',live)}
for(const id of ['role','resume','vacancy','language','speechLanguage']){
  try{const v=localStorage.getItem('ryadom.'+id);if(v!==null)$(id).value=v}catch{}
  $(id).addEventListener('input',()=>{try{localStorage.setItem('ryadom.'+id,$(id).value);$('saveStatus').textContent='Контекст сохранён в этом браузере.'}catch{$('saveStatus').textContent='Сохранение недоступно. Оставьте вкладку открытой.'}});
}
$('settings').onclick=()=>{$('apiKey').value='';$('connectionStatus').textContent=key?'Ключ введён. Проверка выполняется при запросе ответа.':'Введите ключ для начала работы.';$('config').showModal()};
$('closeConfig').onclick=()=>$('config').close();
$('saveKey').onclick=()=>{const v=$('apiKey').value.trim();if(v.length<10){$('connectionStatus').textContent='Введите полный API-ключ.';return}key=v;$('apiKey').value='';$('config').close();showError('');status('Ключ введён');};
$('forgetKey').onclick=()=>{key='';$('apiKey').value='';cancel();stop();$('connectionStatus').textContent='Ключ удалён из памяти.'};
$('config').addEventListener('close',()=>{$('apiKey').value=''});
function cancel(){pendingQuestion='';clearTimeout(autoTimer);controller?.abort()}
$('cancelAnswer').onclick=cancel;
$('autoAnswer').onchange=()=>{if(!$('autoAnswer').checked){clearTimeout(autoTimer);pendingQuestion=''}};
$('ask').onclick=()=>{clearTimeout(autoTimer);const q=$('question').value.trim();if(!q){showError('Введите вопрос.');return}if(!key){$('settings').click();return}questionBuffer='';answer(q)};
$('question').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('ask').click()}});
async function answer(q){
  if(controller){pendingQuestion=q;return}
  if(!key){showError('Добавьте API-ключ DeepSeek через «Подключение».');return}
  const current=new AbortController();controller=current;
  $('ask').disabled=true;$('cancelAnswer').hidden=false;$('copy').disabled=true;
  $('answer').classList.remove('empty');$('answer').textContent='';showError('');status('Готовлю ответ…',active);
  let result='',done=false,finish='';
  try{
    const r=await fetch('/api/answer',{method:'POST',headers:{'Content-Type':'application/json'},signal:current.signal,
      body:JSON.stringify({key,question:q,role:$('role').value,resume:$('resume').value,vacancy:$('vacancy').value,language:$('language').value})});
    if(!r.ok){const error=await r.json().catch(()=>({}));throw new Error(error.error||'Ошибка сервера. Повторите запрос.')}
    const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';
    const handle=line=>{if(!line.startsWith('data:'))return;const raw=line.slice(5).trim();if(raw==='[DONE]'){done=true;return}if(!raw)return;const data=JSON.parse(raw);if(data.error)throw new Error('DeepSeek прервал ответ. Повторите запрос.');const choice=data.choices?.[0];finish=choice?.finish_reason||finish;result+=choice?.delta?.content||'';$('answer').textContent=result};
    while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines)handle(line.trim())}
    buffer+=decoder.decode();if(buffer.trim())handle(buffer.trim());
    if(!done||!result)throw new Error('Ответ не получен полностью. Повторите запрос.');
    if(finish==='length')showError('Достигнут лимит длины ответа; показана доступная часть.');
    if(finish&&!['stop','length'].includes(finish))throw new Error('DeepSeek остановил генерацию. Повторите запрос.');
    history.unshift({question:q,answer:result,time:new Date().toLocaleTimeString()});history=history.slice(0,100);renderHistory();
  }catch(e){if(e.name==='AbortError'){showError('Генерация отменена.')}else{showError(e.message)}if(!result)$('answer').textContent='Ответ пока не получен. Проверьте сообщение выше.';}
  finally{controller=null;$('ask').disabled=false;$('cancelAnswer').hidden=true;$('copy').disabled=!result;status(active?'Распознаю '+sourceLabel():'Готов к вопросу',active);if(pendingQuestion){const next=pendingQuestion;pendingQuestion='';answer(next)}}
}
function renderHistory(){const host=$('history');host.replaceChildren();for(const item of history){const b=document.createElement('button');b.className='historyItem';b.textContent=item.time+' · '+item.question;b.onclick=()=>{if(controller){showError('Дождитесь ответа или отмените генерацию.');return}$('question').value=item.question;$('answer').classList.remove('empty');$('answer').textContent=item.answer;$('copy').disabled=false};host.append(b)}}
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('answer').textContent);$('copy').textContent='Скопировано';setTimeout(()=>$('copy').textContent='Копировать',1500)}catch{showError('Не удалось скопировать. Выделите ответ и нажмите Ctrl+C.')}};
$('export').onclick=()=>{if(!history.length){showError('В истории ещё нет ответов.');return}const blob=new Blob([history.slice().reverse().map(x=>`${x.time}\nВОПРОС: ${x.question}\n\n${x.answer}`).join('\n\n---\n\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='interview-notes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function stop(){clearInterval(audioTimer);audioTimer=null;audioNode?.disconnect();audioContext?.close().catch(()=>{});audioContext=null;audioNode=null;audioAnalyser=null;$('audioLevel').value=0;$('audioDiagnostic').textContent='Захват звука остановлен.';$('audioSource').disabled=false;active=false;epoch++;clearTimeout(restartTimer);clearTimeout(autoTimer);pendingQuestion='';recognition?.abort();recognition=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('listen').disabled=false;$('stop').disabled=true;$('speechLanguage').disabled=false;status('Прослушивание остановлено')}
$('stop').onclick=stop;
$('audioSource').onchange=()=>{$('audioHelp').textContent=$('audioSource').value==='microphone'?'Говорите в микрофон: этот режим позволяет проверить распознавание и ответы без других участников.':'Вкладка передаёт голоса других участников. Для проверки своим голосом выберите «Микрофон — проверка».'};
async function monitorAudio(session){
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context){$('audioDiagnostic').textContent='Индикатор звука недоступен в этом браузере.';return}
  const context=new Context();audioContext=context;
  try{await context.resume()}catch{}
  if(!active||session!==epoch){context.close().catch(()=>{});return}
  audioNode=context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  audioAnalyser=context.createAnalyser();audioAnalyser.fftSize=2048;audioNode.connect(audioAnalyser);
  const samples=new Float32Array(audioAnalyser.fftSize),started=Date.now();let lastSound=0;
  audioTimer=setInterval(()=>{
    if(!active||session!==epoch)return;
    audioAnalyser.getFloatTimeDomainData(samples);
    const rms=Math.sqrt(samples.reduce((n,x)=>n+x*x,0)/samples.length),now=Date.now();
    $('audioLevel').value=Math.min(1,rms*8);
    if(rms>.008)lastSound=now;
    if(now-started>12000&&!lastSound){$('audioDiagnostic').textContent=$('audioSource').value==='microphone'?'Микрофон не передаёт звук. Проверьте выбранное устройство и его уровень.':'Из вкладки пока нет звука. Ваш собственный голос в пустой встрече сюда не попадает. Нужен другой участник или режим «Микрофон — проверка».';}
    else if(lastSound&&now-Math.max(lastRecognized,started)>15000){$('audioDiagnostic').textContent='Звук приходит, но текста пока нет. Проверьте язык речи. Если текст не появится, перезапустите распознавание в обычном Chrome.';}
    else{$('audioDiagnostic').textContent=now-lastSound<1500?'Звук поступает. Распознавание работает отдельно.':'Ожидаю речь из выбранного источника…';}
  },200);
}
async function listen(){
  if(!key){$('settings').click();return}
  const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  const version=Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]||0);
  const microphone=$('audioSource').value==='microphone';
  if(!Speech||version<135||!(microphone?navigator.mediaDevices?.getUserMedia:navigator.mediaDevices?.getDisplayMedia)){showError('Для звука откройте этот адрес в Chrome 135+ на компьютере. Здесь можно вводить вопросы вручную.');return}
  showError('');$('listen').disabled=true;
  try{
    stream=microphone?await navigator.mediaDevices.getUserMedia({audio:true,video:false}):await navigator.mediaDevices.getDisplayMedia({video:true,audio:true,preferCurrentTab:false});
    const track=stream.getAudioTracks()[0];
    if(!track)throw new Error(microphone?'Микрофон не передаёт аудиодорожку.':'Выберите именно вкладку Google Meet и включите «Поделиться аудио вкладки».');
    active=true;const session=++epoch;questionBuffer='';lastRecognized=0;$('audioSource').disabled=true;$('audioDiagnostic').textContent='Ожидаю входящий звук…';monitorAudio(session).catch(()=>{$('audioDiagnostic').textContent='Не удалось включить индикатор звука.'});$('stop').disabled=false;$('speechLanguage').disabled=true;
    for(const t of stream.getTracks())t.addEventListener('ended',()=>{if(session===epoch)stop()},{once:true});
    let restarts=0;
    const startRecognition=()=>{
      if(!active||session!==epoch)return;
      const r=new Speech();recognition=r;r.lang=$('speechLanguage').value;r.continuous=true;r.interimResults=true;
      let finals='';
      r.onstart=()=>{if(session===epoch)status('Распознавание запущено: '+sourceLabel(),true)};
      r.onresult=e=>{
        if(session!==epoch)return;lastRecognized=Date.now();restarts=0;let interim='',newFinal='';clearTimeout(autoTimer);
        for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal){newFinal+=t+' ';finals+=t+' '}else interim+=t+' '}
        questionBuffer=(questionBuffer+' '+newFinal).trim().slice(-12000);
        $('transcript').textContent=(finals+interim).slice(-8000);$('question').value=(questionBuffer+' '+interim).trim();
        if(!interim&&questionBuffer&&$('autoAnswer').checked)autoTimer=setTimeout(()=>{if(active&&session===epoch){const q=questionBuffer;questionBuffer='';answer(q)}},1800);
      };
      r.onerror=e=>{if(session!==epoch)return;if(e.error==='no-speech')return;showError(({network:'Служба распознавания недоступна. Проверьте сеть или введите вопрос вручную.','not-allowed':'Браузер запретил распознавание речи. Проверьте разрешения.','audio-capture':'Не удалось получить звук вкладки.','service-not-allowed':'Распознавание недоступно в этом браузере. Откройте приложение в обычном Chrome.'})[e.error]||'Ошибка распознавания: '+e.error);stop()};
      r.onend=()=>{if(active&&session===epoch){if(++restarts>4){showError('Распознавание многократно завершилось без результата. Запустите его повторно в Chrome.');stop();return}restartTimer=setTimeout(startRecognition,500)}};
      try{if(microphone)r.start();else r.start(track)}catch(e){showError('Не удалось распознать аудиодорожку: '+e.message);stop()}
    };startRecognition();
  }catch(e){stop();showError(e.name==='NotAllowedError'?'Захват отменён или запрещён браузером. Можно повторить или ввести вопрос вручную.':e.message)}
}
$('listen').onclick=listen;
window.addEventListener('beforeunload',()=>{controller?.abort();stop();key=''});
status('Добавьте ключ DeepSeek');
