import http from 'node:http';
// Same route shape as Supabase; local testing only. Keys are locally generated.
http.createServer((req,res)=>{
 const prefix=req.url.startsWith('/auth/v1')?'/auth/v1':req.url.startsWith('/rest/v1')?'/rest/v1':null;
 if(!prefix){res.writeHead(404);res.end();return;}
 const upstream=http.request({hostname:'127.0.0.1',port:prefix==='/auth/v1'?55499:55431,path:req.url.slice(prefix.length)||'/',method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
 upstream.on('error',()=>{res.writeHead(502);res.end('Local service unavailable');});req.pipe(upstream);
}).listen(55421,'127.0.0.1');
