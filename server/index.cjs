const http=require('http'),crypto=require('crypto');
const db=require('./storage.cjs'),staticHandler=require('../scripts/serve.cjs');
const sessions=new Map(),limits=new Map(),port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(Error('JSON_REQUIRED'),{status:415});let size=0,chunks=[];for await(const b of req){size+=b.length;if(size>8*1024*1024)throw Object.assign(Error('TOO_LARGE'),{status:413});chunks.push(b)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw Object.assign(Error('BAD_JSON'),{status:400})}}
function current(req){const token=/\bsf_session=([a-f0-9]{64})/.exec(req.headers.cookie||'')?.[1],s=token&&sessions.get(token);if(!s)return null;if(s.expires<Date.now()){sessions.delete(token);return null}return {token,...s}}
function cookie(req,res,token,clear=false){res.setHeader('Set-Cookie',`sf_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:604800}${req.socket.encrypted?'; Secure':''}`)}
const server=http.createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;if(!pathname.startsWith('/api/'))return staticHandler(req,res);
 if(!['GET','POST','PUT'].includes(req.method))return json(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(req.method!=='GET'&&req.headers.origin){let origin;try{origin=new URL(req.headers.origin).host}catch{}if(origin!==req.headers.host)return json(res,403,{error:'ORIGIN_REJECTED'})}
 if(pathname==='/api/login'||pathname==='/api/register'){
  if(req.method!=='POST')return json(res,405,{error:'METHOD_NOT_ALLOWED'});const ipKey='ip:'+req.socket.remoteAddress;let ipLimit=limits.get(ipKey);if(!ipLimit||ipLimit.until<Date.now())ipLimit={count:0,until:Date.now()+600000};if(ipLimit.count>=60)return json(res,429,{error:'TOO_MANY_ATTEMPTS'});ipLimit.count++;limits.set(ipKey,ipLimit);const b=await body(req),username=typeof b.username==='string'?b.username.trim().toLowerCase():'',password=typeof b.password==='string'?b.password:'';
  if(!/^[a-z0-9_\-]{3,32}$/.test(username)||password.length>128)return json(res,400,{error:'INVALID_CREDENTIAL_FORMAT'});
  const key=(req.socket.remoteAddress||'')+':'+username,lim=limits.get(key);if(lim&&lim.until>Date.now()&&lim.count>=8)return json(res,429,{error:'TOO_MANY_ATTEMPTS'});
  let user;if(pathname==='/api/register'){if(password.length<8)return json(res,400,{error:'PASSWORD_MIN_8'});try{user=db.createUser(username,password)}catch(e){if(e.message==='USERNAME_EXISTS')return json(res,409,{error:e.message});throw e}}
  else {user=db.read('users.json',[]).find(u=>u.username===username);if(!user||!db.verify(password,user)){const x=lim&&lim.until>Date.now()?lim:{count:0,until:Date.now()+600000};x.count++;limits.set(key,x);return json(res,401,{error:'INVALID_CREDENTIALS'})}}
  limits.delete(key);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{userId:user.id,username:user.username,expires:Date.now()+604800000});cookie(req,res,token);return json(res,200,{user:{id:user.id,username:user.username}});
 }
 const session=current(req);if(!session)return json(res,401,{error:'LOGIN_REQUIRED'});
 if(pathname==='/api/me'&&req.method==='GET')return json(res,200,{user:{id:session.userId,username:session.username}});
 if(pathname==='/api/logout'&&req.method==='POST'){sessions.delete(session.token);cookie(req,res,'',true);return json(res,200,{ok:true})}
 if(pathname==='/api/password'&&req.method==='POST'){const b=await body(req);if(typeof b.currentPassword!=='string'||typeof b.newPassword!=='string'||b.newPassword.length<8||b.newPassword.length>128)return json(res,400,{error:'PASSWORD_MIN_8'});const users=db.read('users.json',[]),u=users.find(u=>u.id===session.userId);if(!u||!db.verify(b.currentPassword,u))return json(res,401,{error:'INVALID_CREDENTIALS'});Object.assign(u,db.hash(b.newPassword));db.write('users.json',users);for(const [k,v] of sessions)if(v.userId===u.id&&k!==session.token)sessions.delete(k);return json(res,200,{ok:true})}
 if(pathname==='/api/state'){
  const name=session.userId+'.json';let record=db.read(name,{revision:0,state:db.empty()});
  if(req.method==='GET')return json(res,200,record);
  if(req.method==='PUT'){const b=await body(req);record=db.read(name,{revision:0,state:db.empty()});if(!b.state||typeof b.state!=='object'||Array.isArray(b.state))return json(res,400,{error:'INVALID_STATE'});if(b.revision!==record.revision)return json(res,409,{error:'REVISION_CONFLICT',...record});db.write(name,{revision:record.revision+1,updated:Date.now(),state:b.state});return json(res,200,{revision:record.revision+1})}
 }
 return json(res,404,{error:'NOT_FOUND'});
}catch(e){console.error('API error:',e.code||e.message);if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'SERVER_ERROR'});else res.end()}});
server.listen(port,host,()=>console.log(`拾分账户服务 http://${host}:${server.address().port}`));
