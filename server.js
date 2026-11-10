const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname)));
app.get("/health", (_req,res)=>res.json({ok:true,rooms:rooms.size}));
function makeCode(){let code;do{code=Math.random().toString(36).slice(2,8).toUpperCase();}while(rooms.has(code));return code;}
function publicPlayers(room){return Object.fromEntries([...room.players].map(([id,p])=>[id,{name:p.name,x:p.x,y:p.y,angle:p.angle,color:p.color}]));}
function broadcast(code){const room=rooms.get(code);if(room)io.to(code).emit("roomUpdate",{code,status:room.status,players:publicPlayers(room)});}
function removePlayer(socket){
 const code=socket.data.roomCode;if(!code)return;
 const room=rooms.get(code);if(!room)return;
 room.players.delete(socket.id);socket.leave(code);socket.data.roomCode=null;
 if(room.players.size===0){rooms.delete(code);return;}
 if(room.host===socket.id){room.host=room.players.keys().next().value;}
 broadcast(code);
}
io.on("connection",socket=>{
 socket.on("createRoom",({name}={})=>{
  removePlayer(socket);
  const code=makeCode(),room={host:socket.id,status:"waiting",players:new Map()};
  room.players.set(socket.id,{name:String(name||"플레이어").slice(0,12),x:150,y:150,angle:0,throttle:0,color:"#55a7ff"});
  rooms.set(code,room);socket.join(code);socket.data.roomCode=code;
  socket.emit("roomJoined",{code,isHost:true,players:publicPlayers(room)});
  broadcast(code);
 });
 socket.on("joinRoom",({code,name}={})=>{
  code=String(code||"").toUpperCase();const room=rooms.get(code);
  if(!room)return socket.emit("errorMessage","방을 찾을 수 없어.");
  if(room.status!=="waiting")return socket.emit("errorMessage","이미 게임이 시작된 방이야.");
  if(room.players.size>=8)return socket.emit("errorMessage","최대 8명까지 참가할 수 있어.");
  removePlayer(socket);
  const n=room.players.size;
  room.players.set(socket.id,{name:String(name||"플레이어").slice(0,12),x:180+Math.random()*500,y:160+Math.random()*280,angle:0,throttle:0,color:["#55a7ff","#ffb454","#75db9a","#ed7bd0","#c2a4ff","#ff7777","#75dedb","#e5dc74"][n]});
  socket.join(code);socket.data.roomCode=code;
  socket.emit("roomJoined",{code,isHost:room.host===socket.id,players:publicPlayers(room)});
  broadcast(code);
 });
 socket.on("startGame",()=>{
  const code=socket.data.roomCode,room=rooms.get(code);
  if(!room||room.host!==socket.id)return;
  room.status="playing";io.to(code).emit("gameStarted");broadcast(code);
 });
 socket.on("playerInput",input=>{
  const code=socket.data.roomCode,room=rooms.get(code),p=room?.players.get(socket.id);
  if(!p||room.status!=="playing")return;
  p.angle=Math.max(-1,Math.min(1,Number(input?.angle)||0));
  p.throttle=input?.throttle?1:0;
 });
 socket.on("leaveRoom",()=>removePlayer(socket));
 socket.on("disconnect",()=>removePlayer(socket));
});
setInterval(()=>{
 for(const [code,room] of rooms){
  if(room.status!=="playing")continue;
  for(const p of room.players.values()){
   if(p.throttle){const heading=p.angle*0.85;p.x+=Math.cos(heading)*3.2;p.y+=Math.sin(heading)*3.2;}
   p.x=Math.max(22,Math.min(938,p.x));p.y=Math.max(22,Math.min(578,p.y));
  }
  broadcast(code);
 }
},50);
server.listen(PORT,"0.0.0.0",()=>console.log("GyroCar server listening on "+PORT));
