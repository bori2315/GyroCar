const express=require("express"),http=require("http"),{Server}=require("socket.io"),path=require("path");
const app=express(),server=http.createServer(app),io=new Server(server),rooms=new Map(),PORT=process.env.PORT||3000,W=960,H=600,ROUND=90;
const colors=["#55a7ff","#ffb454","#75db9a","#ed7bd0","#c2a4ff","#ff7777","#75dedb","#e5dc74"];
const checkpoints=[{x:480,y:70},{x:850,y:300},{x:480,y:530},{x:110,y:300}];
app.use(express.static(path.join(__dirname)));app.get("/health",(_q,r)=>r.json({ok:true,rooms:rooms.size}));
function code(){let c;do{c=Math.random().toString(36).slice(2,8).toUpperCase()}while(rooms.has(c));return c}
function pub(r){return Object.fromEntries([...r.players].map(([id,p])=>[id,{name:p.name,x:p.x,y:p.y,angle:p.heading,color:p.color,score:p.score,team:p.team,laps:p.laps,checkpoint:p.checkpoint}]))}
function state(r){return {status:r.status,mode:r.mode,teamNames:r.teamNames,players:pub(r),remaining:r.remaining,duration:r.duration,coins:r.coins,ball:r.ball,teamScores:r.teamScores,checkpoint:checkpoints[r.players.values().next().value?.checkpoint||0]};}
function send(c){const r=rooms.get(c);if(r)io.to(c).emit("roomUpdate",state(r))}
function spawn(p,i=0,mode="battle",teamNames=["레드팀","블루팀"]){
 p.vx=0;p.vy=0;p.steer=0;p.throttle=0;
 if(mode==="soccer"){
  const side=p.team===teamNames[0]?-1:1,row=i%4;
  p.x=W/2+side*(105+Math.floor(row/2)*105);p.y=H/2+(row%2?95:-95);
  p.heading=side===-1?0:Math.PI;
 }else if(mode==="race"){
  const lane=(i%4)-1.5;
  p.x=300+(i%4)*120;p.y=145+Math.floor(i/4)*42;
  p.heading=0;
 }else{
  const cols=4,row=Math.floor(i/cols),col=i%cols;
  p.x=W/2+(col-1.5)*105;p.y=H/2+(row-.5)*100;p.heading=0;
 }
}
function makeCoin(){return {x:60+Math.random()*(W-120),y:60+Math.random()*(H-120),id:Math.random().toString(36).slice(2)}}
function remove(s){const c=s.data.roomCode;if(!c)return;const r=rooms.get(c);if(!r)return;r.players.delete(s.id);s.leave(c);s.data.roomCode=null;if(!r.players.size){rooms.delete(c);return}send(c)}
function finish(c,r){r.status="finished";let ranking;if(r.mode==="soccer"){ranking=r.teamNames.map(name=>({name,score:r.teamScores[name]||0}));}else ranking=[...r.players.values()].sort((a,b)=>b.score-a.score).map((p,i)=>({rank:i+1,name:p.name,score:r.mode==="race"?p.laps:p.score}));io.to(c).emit("gameOver",{mode:r.mode,ranking,teamScores:r.teamScores});r.status="waiting";r.remaining=r.duration;for(const p of r.players.values()){p.throttle=0;p.steer=0;}send(c)}
io.on("connection",s=>{
 s.on("createRoom",()=>{remove(s);const c=code(),r={host:s.id,status:"waiting",mode:"battle",teamNames:["레드팀","블루팀"],teamScores:{},players:new Map(),remaining:ROUND,duration:ROUND,lastTick:Date.now(),coins:[],ball:{x:W/2,y:H/2,vx:0,vy:0}};rooms.set(c,r);s.join(c);s.data.roomCode=c;s.data.isHost=true;s.emit("roomJoined",{code:c,isHost:true,players:pub(r),mode:r.mode});send(c)});
 s.on("configureRoom",({mode,teamA,teamB,duration}={})=>{const r=rooms.get(s.data.roomCode);if(!r||r.host!==s.id||r.status!=="waiting")return;r.mode=["battle","race","coin","soccer"].includes(mode)?mode:"battle";r.duration=Math.max(30,Math.min(600,Number(duration)||90));r.teamNames=[String(teamA||"레드팀").slice(0,12),String(teamB||"블루팀").slice(0,12)];let i=0;for(const p of r.players.values())p.team=r.mode==="soccer"?r.teamNames[i++%2]:null;send(s.data.roomCode);s.emit("modeConfigured",{mode:r.mode,teamNames:r.teamNames})});
 s.on("joinRoom",({code:c,name}={})=>{c=String(c||"").toUpperCase();const r=rooms.get(c);if(!r)return s.emit("errorMessage","방을 찾을 수 없어.");if(r.status!=="waiting")return s.emit("errorMessage","이미 게임이 시작된 방이야.");if(r.players.size>=8)return s.emit("errorMessage","최대 8명까지 참가할 수 있어.");remove(s);const n=r.players.size,p={name:String(name||"플레이어").slice(0,12),vx:0,vy:0,heading:0,steer:0,throttle:0,score:0,color:colors[n],lastHit:0,team:r.mode==="soccer"?r.teamNames[n%2]:null,laps:0,checkpoint:0};spawn(p,n,r.mode,r.teamNames);r.players.set(s.id,p);s.join(c);s.data.roomCode=c;s.data.isHost=false;s.emit("roomJoined",{code:c,isHost:false,players:pub(r),mode:r.mode});send(c)});
 s.on("endGame",()=>{const c=s.data.roomCode,r=rooms.get(c);if(!r||r.host!==s.id||r.status!=="playing")return;finish(c,r)});
 s.on("startGame",()=>{const c=s.data.roomCode,r=rooms.get(c);if(!r||r.host!==s.id||r.status!=="waiting")return;if(!r.players.size)return s.emit("errorMessage","게임을 시작하려면 참가자가 최소 1명 필요해.");r.status="playing";r.remaining=r.duration||ROUND;r.lastTick=Date.now();r.coins=Array.from({length:12},makeCoin);r.ball={x:W/2,y:H/2,vx:0,vy:0};r.teamScores={};r.teamNames.forEach(n=>r.teamScores[n]=0);let i=0;for(const p of r.players.values()){p.score=0;p.laps=0;p.checkpoint=0;p.lastHit=0;p.team=r.mode==="soccer"?r.teamNames[i++%2]:null;spawn(p,i-1,r.mode,r.teamNames)}io.to(c).emit("gameStarted",{remaining:r.duration,mode:r.mode,teamNames:r.teamNames});send(c)});
 s.on("playerInput",v=>{const r=rooms.get(s.data.roomCode),p=r?.players.get(s.id);if(!p||r.status!=="playing")return;p.steer=Math.max(-1,Math.min(1,Number(v?.angle)||0));p.throttle=v?.throttle?1:0});
 s.on("leaveRoom",()=>remove(s));s.on("disconnect",()=>remove(s));
});
setInterval(()=>{const now=Date.now();for(const [c,r] of rooms){if(r.status!=="playing")continue;const dt=Math.min(.08,(now-r.lastTick)/1000||.05);r.lastTick=now;r.remaining=Math.max(0,r.remaining-dt);
 let idx=0;for(const p of r.players.values()){p.heading+=p.steer*2.9*dt*(p.throttle?1:.45);if(p.throttle){p.vx+=Math.cos(p.heading)*245*dt;p.vy+=Math.sin(p.heading)*245*dt}p.vx*=Math.pow(.984,dt*60);p.vy*=Math.pow(.984,dt*60);const v=Math.hypot(p.vx,p.vy);if(v>275){p.vx=p.vx/v*275;p.vy=p.vy/v*275}p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.x<28||p.x>W-28){p.x=Math.max(28,Math.min(W-28,p.x));p.vx*=-.72}if(p.y<28||p.y>H-28){p.y=Math.max(28,Math.min(H-28,p.y));p.vy*=-.72}
 if(r.mode==="race"){const cp=checkpoints[p.checkpoint];if(Math.hypot(p.x-cp.x,p.y-cp.y)<52){p.checkpoint=(p.checkpoint+1)%4;if(p.checkpoint===0)p.laps++;}}
 if(r.mode==="coin"){for(let k=r.coins.length-1;k>=0;k--){const coin=r.coins[k];if(Math.hypot(p.x-coin.x,p.y-coin.y)<34){p.score++;r.coins.splice(k,1);r.coins.push(makeCoin());io.to(c).emit("coinCollected",{name:p.name,score:p.score})}}}
 idx++}
 const a=[...r.players.values()];for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const x=a[i],y=a[j],dx=y.x-x.x,dy=y.y-x.y,d=Math.hypot(dx,dy);if(d>=40)continue;const nx=d?dx/d:1,ny=d?dy/d:0,o=40-d;x.x-=nx*o*.5;x.y-=ny*o*.5;y.x+=nx*o*.5;y.y+=ny*o*.5;const rel=(x.vx-y.vx)*nx+(x.vy-y.vy)*ny;if(rel>35){const k=Math.min(190,rel*.8);x.vx-=nx*k*.55;x.vy-=ny*k*.55;y.vx+=nx*k*.55;y.vy+=ny*k*.55;if(r.mode==="battle"&&now-x.lastHit>900&&now-y.lastHit>900){const hitter=Math.hypot(x.vx,x.vy)>Math.hypot(y.vx,y.vy)?x:y;hitter.score++;(hitter===x?y:x).lastHit=now;io.to(c).emit("hit",{scorer:hitter.name})}}}
 if(r.mode==="soccer"){
 const b=r.ball,BR=16,PR=25;
 b.vx*=Math.pow(.972,dt*60);b.vy*=Math.pow(.972,dt*60);
 b.x+=b.vx*dt;b.y+=b.vy*dt;
 for(const p of a){
  let dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy),min=PR+BR;
  if(d<min){
   if(d<.001){dx=1;dy=0;d=1}
   const nx=dx/d,ny=dy/d;
   b.x=p.x+nx*(min+1);b.y=p.y+ny*(min+1);
   const toward=p.vx*nx+p.vy*ny;
   if(toward>0){b.vx+=nx*Math.min(150,toward*.85);b.vy+=ny*Math.min(150,toward*.85)}
   else {b.vx+=nx*12;b.vy+=ny*12}
  }
 }
 const inGoal=b.y>255&&b.y<345;
 if(b.x<BR+5){
  if(inGoal){const scoring=r.teamNames[1];r.teamScores[scoring]=(r.teamScores[scoring]||0)+1;io.to(c).emit("goal",{team:scoring});r.ball={x:W/2,y:H/2,vx:0,vy:0}}
  else {b.x=BR+5;b.vx=Math.abs(b.vx)*.65}
 }else if(b.x>W-BR-5){
  if(inGoal){const scoring=r.teamNames[0];r.teamScores[scoring]=(r.teamScores[scoring]||0)+1;io.to(c).emit("goal",{team:scoring});r.ball={x:W/2,y:H/2,vx:0,vy:0}}
  else {b.x=W-BR-5;b.vx=-Math.abs(b.vx)*.65}
 }
 if(b.y<BR+5){b.y=BR+5;b.vy=Math.abs(b.vy)*.65}
 if(b.y>H-BR-5){b.y=H-BR-5;b.vy=-Math.abs(b.vy)*.65}
 const speed=Math.hypot(b.vx,b.vy);if(speed>300){b.vx=b.vx/speed*300;b.vy=b.vy/speed*300}
}
 if(r.mode==="race"&&[...r.players.values()].some(p=>p.laps>=3)){finish(c,r);continue}if(r.remaining<=0){finish(c,r);continue}send(c)
}},50);
server.listen(PORT,"0.0.0.0",()=>console.log("GyroCar server listening on "+PORT));
