const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg','.md':'text/plain; charset=utf-8'};
const serveStatic=(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end()}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);return res.end()}
 const p=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!p.startsWith(root+path.sep)||pathname.split(/[\\/]/).some(s=>s.startsWith('.'))||/^\/(server|private-data|tests)\//.test(pathname)){res.writeHead(403);return res.end()}
 fs.stat(p,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end('Not found')}
  const headers={'Content-Type':mime[path.extname(p)]||'application/octet-stream','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
  let start=0,end=st.size-1,status=200;
  if(req.headers.range){const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!m||!m[1]&&!m[2]){res.writeHead(416,{'Content-Range':'bytes */'+st.size});return res.end()}
   if(!m[1])start=Math.max(0,st.size-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]))}
   if(start>end||start>=st.size){res.writeHead(416,{'Content-Range':'bytes */'+st.size});return res.end()}
   status=206;headers['Content-Range']=`bytes ${start}-${end}/${st.size}`;
  }
  headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD')return res.end();fs.createReadStream(p,{start,end}).on('error',()=>res.destroy()).pipe(res);
 });
};
module.exports=serveStatic;
if(require.main===module)http.createServer(serveStatic).listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`拾分：http://${process.env.HOST||'127.0.0.1'}:${port}`));
