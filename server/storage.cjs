const fs=require('fs'),path=require('path'),crypto=require('crypto');
const dir=path.resolve(process.env.DATA_DIR||path.join(__dirname,'../../toeic-prototype-private-data'));
fs.mkdirSync(dir,{recursive:true,mode:0o700});
function read(file,fallback){try{return JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
function write(file,data){const p=path.join(dir,file),tmp=p+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data),{mode:0o600});fs.renameSync(tmp,p)}
function hash(password,salt=crypto.randomBytes(16).toString('hex')){return {salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}}
function verify(password,user){const b=crypto.scryptSync(password,user.salt,64);return crypto.timingSafeEqual(b,Buffer.from(user.hash,'hex'))}
function empty(){return {multiTrialVersion:1,reviews:{},notes:{},reasons:{},stars:{},uncertain:{},words:[],logs:[],examHistory:[],examWrong:[],examExtra:[],activeExam:null}}
function createUser(username,password,state=empty()){const users=read('users.json',[]);if(users.some(u=>u.username===username))throw Error('USERNAME_EXISTS');const u={id:crypto.randomUUID(),username,...hash(password),created:Date.now()};users.push(u);write('users.json',users);write(u.id+'.json',{revision:1,updated:Date.now(),state});return u}
module.exports={dir,read,write,hash,verify,empty,createUser};
