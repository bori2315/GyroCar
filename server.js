const express=require("express"),http=require("http"),{Server}=require("socket.io"),path=require("path");
const app=express(),server=http.createServer(app),io=new Server(server),rooms=new Map(),PORT=process.env.PORT||3000,W=960,H=600,ROUND=90;
const colors=["#55a7ff","#ffb454","#75db9a","#ed7bd0","#c2a4ff","#ff7777","#75dedb","#e5dc74"];
app.use(express.static(path.join(__dirname)));app.get("/health",(_q,r)=>r.json({ok:true,rooms:rooms.size}));
function code(){let c;do{c=Math.random().toString(36).slice(2,8).toUpperCase()}while(rooms.has(c));return c}
function pub(r){return Object.fromEntries([...r.players].map(([id,p])=>[id,{name:p.name,x:p.x,y:p.y,angle:p.heading,color:p.color,score:p.score}]))}
function send(c){const r=rooms.get(c);if(r)io.to(c).emit("roomUpdate",{status:r.status,players:pub(r),remaining:r.remaining})}
function spawn(p){p.x=100+Math.random()*(W-200);p.y=100+Math.random()*(H-200);p.vx=0;p.vy=0;p.heading=Math.random()*Math.PI*2}
function remove(s){const c=s.data.roomCode;if(!c)return;const r=rooms.get(c);if(!r)return;r.players.delete(s.id);s.leave(c);s.data.roomCode=null;if(!r.players.size){rooms.delete(c);return}if(r.host===s.id)r.host=r.players.keys().next().value;send(c)}
io.on("connection",s=>{
 s.on("createRoom",({name}={})=>{remove(s);const c=code(),r={host:s.id,status:"waiting",players:new Map(),remaining:ROUND,lastTick:Date.now()};r.players.set(s.id,{name:String(name||"플레이어").slice(0,12),x:W/2,y:H/2,vx:0,vy:0,heading:0,steer:0,throttle:0,score:0,color:colors[0],lastHit:0});rooms.set(c,r);s.join(c);s.data.roomCode=c;s.emit("roomJoined",{code:c,isHost:true,players:pub(r)});send(c)});
 s.on("joinRoom",({code:c,name}={})=>{c=String(c||"").toUpperCase();const r=rooms.get(c);if(!r)return s.emit("errorMessage","방을 찾을 수 없어.");if(r.status!=="waiting")return s.emit("errorMessage","이미 게임이 시작된 방이야.");if(r.players.size>=8)return s.emit("errorMessage","최대 8명까지 참가할 수 있어.");remove(s);const n=r.players.size,p={name:String(name||"플레이어").slice(0,12),vx:0,vy:0,heading:0,steer:0,throttle:0,score:0,color:colors[n],lastHit:0};spawn(p);r.players.set(s.id,p);s.join(c);s.data.roomCode=c;s.emit("roomJoined",{code:c,isHost:r.host===s.id,players:pub(r)});send(c)});
 s.on("startGame",()=>{const c=s.data.roomCode,r=rooms.get(c);if(!r||r.host!==s.id||r.status!=="waiting")return;r.status="playing";r.remaining=ROUND;r.lastTick=Date.now();for(const p of r.players.values()){p.score=0;spawn(p)}io.to(c).emit("gameStarted",{remaining:ROUND});send(c)});
 s.on("playerInput",v=>{const r=rooms.get(s.data.roomCode),p=r?.players.get(s.id);if(!p||r.status!=="playing")return;p.steer=Math.max(-1,Math.min(1,Number(v?.angle)||0));p.throttle=v?.throttle?1:0});
 s.on("leaveRoom",()=>remove(s));s.on("disconnect",()=>remove(s));
});
setInterval(()=>{const now=Date.now();for(const [c,r] of rooms){if(r.status!=="playing")continue;const dt=Math.min(.08,(now-r.lastTick)/1000||.05);r.lastTick=now;r.remaining=Math.max(0,r.remaining-dt);
 for(const p of r.players.values()){p.heading+=p.steer*2.7*dt*(p.throttle?1:.45);if(p.throttle){p.vx+=Math.cos(p.heading)*230*dt;p.vy+=Math.sin(p.heading)*230*dt}p.vx*=Math.pow(.985,dt*60);p.vy*=Math.pow(.985,dt*60);const v=Math.hypot(p.vx,p.vy);if(v>260){p.vx=p.vx/v*260;p.vy=p.vy/v*260}p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.x<28||p.x>W-28){p.x=Math.max(28,Math.min(W-28,p.x));p.vx*=-.72}if(p.y<28||p.y>H-28){p.y=Math.max(28,Math.min(H-28,p.y));p.vy*=-.72}}
 const a=[...r.players.entries()];for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const [idA,x]=a[i],[idB,y]=a[j],dx=y.x-x.x,dy=y.y-x.y,d=Math.hypot(dx,dy);if(d>=40)continue;const nx=d?dx/d:1,ny=d?dy/d:0,o=40-d;x.x-=nx*o*.5;x.y-=ny*o*.5;y.x+=nx*o*.5;y.y+=ny*o*.5;const rel=(x.vx-y.vx)*nx+(x.vy-y.vy)*ny;if(rel>35){const k=Math.min(190,rel*.8);x.vx-=nx*k*.55;x.vy-=ny*k*.55;y.vx+=nx*k*.55;y.vy+=ny*k*.55;const hitter=Math.hypot(x.vx,x.vy)>Math.hypot(y.vx,y.vy)?x:y,victim=hitter===x?y:x;if(now-victim.lastHit>900){hitter.score++;victim.lastHit=now;io.to(c).emit("hit",{scorer:hitter.name})}}}
 if(r.remaining<=0){r.status="finished";const ranking=[...r.players.values()].sort((a,b)=>b.score-a.score).map((p,i)=>({rank:i+1,name:p.name,score:p.score}));io.to(c).emit("gameOver",{ranking})}send(c)
}},50);
server.listen(PORT,"0.0.0.0",()=>console.log("GyroCar server listening on "+PORT));
