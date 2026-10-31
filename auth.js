let authUser=null,cloudRevision=0,cloudBase=null,syncTimer=null,syncBusy=false,syncDirty=false;
const clone=x=>JSON.parse(JSON.stringify(x));
const authError=e=>({INVALID_CREDENTIALS:'用户名或密码错误',USERNAME_EXISTS:'用户名已存在',PASSWORD_MIN_8:'注册密码至少 8 位',INVALID_CREDENTIAL_FORMAT:'用户名需为 3–32 位字母、数字、下划线或短横线',TOO_MANY_ATTEMPTS:'尝试过于频繁，请稍后再试'}[e]||'请求失败，请稍后重试');
async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',signal:AbortSignal.timeout(15000),...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const b=await r.json();return {ok:r.ok,status:r.status,...b}}
function authScreen(message=''){document.body.classList.add('auth-wall');const box=document.createElement('section');box.id='auth-screen';box.innerHTML=`<div class="auth-card"><span class="brand-icon">拾</span><h1>欢迎回到拾分</h1><p>登录后，学习记录会同步到你的个人账户。</p><form id="auth-form"><label>用户名<input id="auth-name" autocomplete="username" required minlength="3" maxlength="32"></label><label>密码<input id="auth-password" type="password" autocomplete="current-password" required maxlength="128"></label><p id="auth-message" role="status">${message}</p><button class="btn primary" type="submit">登录</button><button class="btn" id="register-button" type="button">注册新账户</button></form></div>`;document.getElementById('auth-screen')?.remove();document.body.appendChild(box);authSelect('#auth-form').onsubmit=e=>{e.preventDefault();authenticate('login')};authSelect('#register-button').onclick=()=>authenticate('register')}
// The app has not loaded yet; keep this selector independent of app.js.
function authSelect(s){return document.querySelector(s)}
async function authenticate(mode){const username=authSelect('#auth-name').value.trim(),password=authSelect('#auth-password').value;authSelect('#auth-message').textContent='正在连接…';try{const r=await api('/api/'+mode,{method:'POST',body:JSON.stringify({username,password})});if(!r.ok){authSelect('#auth-message').textContent=authError(r.error);return}location.reload()}catch{authSelect('#auth-message').textContent='无法连接服务器，请检查网络'}}
function loadScript(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(Error('加载失败：'+src));document.body.appendChild(el)})}
function hydrateAccount(state){
 const bank=new Map(EXAM_BANK.questions.map(q=>[q.key,q]));
 for(const [key,a] of Object.entries(state.importedAnswers||{})){const q=bank.get(key);if(q){q.practiceAnswer=a.practiceAnswer;q.personalAnswer=a.personalAnswer}}
 const keys=new Set([...(state.importedQuestions||[]),...(state.examWrong||[]),...(state.examExtra||[]),...Object.entries(state.stars||{}).filter(([,v])=>v).map(([k])=>k)]);
 DATA.questions=[...keys].map(k=>bank.get(k)).filter(Boolean).map(q=>({...q,collect:state.stars?.[q.key]?'true':null,practice_wrong:!!q.practiceAnswer&&q.practiceAnswer!==q.question_answer,mock_wrong:!!q.personalAnswer&&q.personalAnswer!==q.question_answer,platform_wrong:(state.examWrong||[]).includes(q.key)}));
 const imported=state.importedQuestions||[];DATA.summary={...DATA.summary,...state.importSummary,total:DATA.questions.length,stars:DATA.questions.filter(q=>state.stars?.[q.key]).length};
 DATA.importedAt=state.importedAt||DATA.importedAt;
 DATA.summary.audio=new Set(DATA.questions.map(q=>q.audio).filter(Boolean)).size;
 DATA.summary.images=new Set(DATA.questions.flatMap(q=>[q.question_image,q.explanation_image]).filter(Boolean)).size;
 if(state.importTests)DATA.tests=state.importTests;
}
function mergeLearning(base,local,remote){const merged=clone(remote),mapFields=['reviews','notes','reasons','stars','uncertain','importedAnswers'];
 for(const name of mapFields){merged[name]={...(remote[name]||{})};const b=base[name]||{},l=local[name]||{};for(const k of new Set([...Object.keys(b),...Object.keys(l)])){if(JSON.stringify(l[k])===JSON.stringify(b[k]))continue;if(l[k]===undefined){delete merged[name][k];continue}if(name==='notes'&&remote[name]?.[k]&&b[k]!==remote[name][k]&&l[k]!==remote[name][k])merged[name][k]=remote[name][k]+'\n--- 同步保留的另一版本 ---\n'+l[k];else merged[name][k]=l[k]}}
 for(const name of ['words','logs','examHistory','examWrong','examExtra','importedQuestions']){const key=v=>typeof v==='string'?v:name==='examHistory'?v.id:JSON.stringify(v);const m=new Map((remote[name]||[]).map(v=>[key(v),v]));for(const v of local[name]||[])m.set(key(v),v);merged[name]=[...m.values()]}
 for(const [k,v] of Object.entries(local))if(!mapFields.includes(k)&&!['words','logs','examHistory','examWrong','examExtra','importedQuestions'].includes(k)&&JSON.stringify(v)!==JSON.stringify(base[k]))merged[k]=v;
 return merged;
}
window.scheduleCloudSync=function(){if(!window.AUTH_READY)return;syncDirty=true;try{localStorage.setItem(SHIFEN_STORAGE_KEY+'-base',JSON.stringify({state:cloudBase,revision:cloudRevision}))}catch{}if(!syncTimer)syncTimer=setTimeout(()=>{syncTimer=null;flushCloudSync()},1500)};
async function flushCloudSync(){if(syncBusy||!syncDirty)return;syncBusy=true;syncDirty=false;setSyncStatus('同步中…');try{const outgoing=clone(store),r=await api('/api/state',{method:'PUT',body:JSON.stringify({revision:cloudRevision,state:outgoing})});
 if(r.status===401){localStorage.setItem(SHIFEN_STORAGE_KEY+'-unsynced',JSON.stringify(store));setSyncStatus('登录已过期，刷新后重新登录');return}
 if(r.status===409){store=mergeLearning(cloudBase,store,r.state);cloudBase=clone(r.state);cloudRevision=r.revision;localStorage.setItem(SHIFEN_STORAGE_KEY,JSON.stringify(store));syncDirty=true;setSyncStatus('正在合并其他设备的记录…')}
 else if(!r.ok)throw Error(r.error);else{cloudRevision=r.revision;cloudBase=outgoing;setSyncStatus('已同步到云端')}
 }catch{syncDirty=true;setSyncStatus('网络异常，已保存在本机，稍后重试')}finally{syncBusy=false;try{localStorage.setItem(SHIFEN_STORAGE_KEY+'-base',JSON.stringify({state:cloudBase,revision:cloudRevision}))}catch{}if(syncDirty&&!syncTimer)syncTimer=setTimeout(()=>{syncTimer=null;flushCloudSync()},2000)}}
function setSyncStatus(s){const el=document.getElementById('cloud-sync-status');if(el)el.textContent=s}
async function logoutAccount(){window.stopAllAudio?.();if(typeof exam!=='undefined'&&exam)persistExam();clearTimeout(syncTimer);syncTimer=null;while(syncBusy)await new Promise(r=>setTimeout(r,100));if(syncDirty){await flushCloudSync();if(syncDirty){toast('记录尚未同步，请等待网络恢复后再退出');return}}await api('/api/logout',{method:'POST',body:'{}'});location.reload()}
function accountBar(){let b=document.getElementById('account-bar');if(!b){b=document.createElement('div');b.id='account-bar';b.innerHTML=`<span id="cloud-sync-status">已连接云端</span><strong></strong><button class="btn small" onclick="showPasswordDialog()">密码</button><button class="btn small" onclick="logoutAccount()">退出</button>`;document.querySelector('.header-right').replaceChildren(b)}b.querySelector('strong').textContent=authUser.username}
function showPasswordDialog(){const modal=authSelect('#modal');modal.hidden=false;modal.innerHTML='<div class="modal-box"><button class="close" onclick="closeModal()">×</button><h2>修改登录密码</h2><form id="password-form"><label>当前密码 <input id="current-password" type="password" autocomplete="current-password" required></label><p><label>新密码 <input id="new-password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label></p><p id="password-message"></p><button class="btn primary">保存新密码</button></form></div>';authSelect('#password-form').onsubmit=async e=>{e.preventDefault();try{const r=await api('/api/password',{method:'POST',body:JSON.stringify({currentPassword:authSelect('#current-password').value,newPassword:authSelect('#new-password').value})});authSelect('#password-message').textContent=r.ok?'密码已修改，其他设备需要重新登录。':authError(r.error)}catch{authSelect('#password-message').textContent='网络异常，请重试'}}}
async function bootstrapAuth(){try{
 const me=await api('/api/me');if(!me.ok)return authScreen();authUser=me.user;
 const r=await api('/api/state');if(!r.ok)throw Error('无法读取学习记录');cloudRevision=r.revision;cloudBase=clone(r.state);window.SHIFEN_STORAGE_KEY='shifen-account-'+authUser.id;
 const pending=localStorage.getItem(SHIFEN_STORAGE_KEY);let initial=r.state;if(pending){try{const p=JSON.parse(pending),meta=JSON.parse(localStorage.getItem(SHIFEN_STORAGE_KEY+'-base')||'null');if(meta)initial=mergeLearning(meta.state,p,r.state)}catch{}}
 window.AUTH_STATE=clone(initial);window.AUTH_READY=false;
 await loadScript('data.js');await loadScript('exam-data.js');hydrateAccount(initial);
 for(const file of ['app.js','exam.js','toeic-score.js','ability.js'])await loadScript(file);
 const previousRender=render;render=function(){previousRender();accountBar()};window.AUTH_READY=true;document.body.classList.remove('auth-wall');document.getElementById('auth-screen')?.remove();render();if(JSON.stringify(initial)!==JSON.stringify(r.state))scheduleCloudSync();
 window.addEventListener('online',()=>{if(syncDirty)flushCloudSync()});
 }catch(e){authScreen('连接失败，请刷新页面重试。')}}
bootstrapAuth();
