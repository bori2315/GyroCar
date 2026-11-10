(() => {
const $ = id => document.getElementById(id);
const socket = io();
let roomId=null, isHost=false, mode="home", playerName="플레이어";
let players={}, angle=0, throttle=0, sensorHandler=null;
const colors=["#55a7ff","#ffb454","#75db9a","#ed7bd0","#c2a4ff","#ff7777","#75dedb","#e5dc74"];
const notice=s=>$("notice").textContent=s;
function show(id){["home","lobby","desktop","mobile"].forEach(x=>$(x).classList.toggle("hidden",x!==id));mode=id;}
function setConnection(ok,msg){$("connection").textContent=msg|| (ok?"서버 연결됨":"서버 연결 끊김");}
socket.on("connect",()=>setConnection(true));
socket.on("disconnect",()=>setConnection(false));
socket.on("connect_error",()=>setConnection(false,"서버 연결 실패"));
socket.on("errorMessage",m=>notice(m));
socket.on("roomJoined",data=>{
 roomId=data.code;isHost=data.isHost;players=data.players||{};
 $("codeLabel").textContent=roomId;
 $("start").style.display=isHost?"inline-block":"none";
 renderPlayers();show("lobby");
});
socket.on("roomUpdate",data=>{
 players=data.players||{};
 renderPlayers();
 if(data.status==="playing")startPlay();
});
socket.on("playerLeft",data=>{players=data.players||{};renderPlayers();});
socket.on("gameStarted",()=>startPlay());
function renderPlayers(){
 const list=$("players");list.innerHTML="";
 Object.values(players).forEach(p=>{const li=document.createElement("li");li.textContent=p.name;list.appendChild(li);});
}
function startPlay(){
 if(mode==="desktop"||mode==="mobile")return;
 const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
 show(mobile?"mobile":"desktop");if(mobile)requestLandscape();
}
function requestLandscape(){if(screen.orientation?.lock)screen.orientation.lock("landscape").catch(()=>{});}
function createRoom(){
 playerName=$("nickname").value.trim()||"플레이어";
 socket.emit("createRoom",{name:playerName});
}
function joinRoom(){
 const code=$("roomCode").value.trim().toUpperCase();
 if(code.length!==6)return notice("6자리 방 코드를 입력해.");
 playerName=$("nickname").value.trim()||"플레이어";
 socket.emit("joinRoom",{code,name:playerName});
}
function leave(){
 stopSensor();socket.emit("leaveRoom");roomId=null;players={};angle=0;throttle=0;show("home");
}
function startSensor(){
 const status=$("sensorStatus");
 try{
  if(typeof DeviceOrientationEvent==="undefined")throw new Error("이 기기는 방향 센서를 지원하지 않아.");
  const enable=async()=>{
   if(typeof DeviceOrientationEvent.requestPermission==="function"){
    const result=await DeviceOrientationEvent.requestPermission();
    if(result!=="granted")throw new Error("센서 권한이 허용되지 않았어.");
   }
   if(sensorHandler)window.removeEventListener("deviceorientation",sensorHandler);
   let got=false;
   sensorHandler=e=>{
    if(e.gamma===null||e.gamma===undefined)return;
    got=true;angle=Math.max(-1,Math.min(1,e.gamma/35));
    $("wheel").style.transform="rotate("+(-angle*115)+"deg)";
    publishInput();
   };
   window.addEventListener("deviceorientation",sensorHandler);
   status.textContent="센서 데이터 확인 중...";
   setTimeout(()=>{status.textContent=got?"센서 작동 중":"센서 데이터가 없어. HTTPS와 브라우저 권한을 확인해.";},2500);
  };
  enable().catch(e=>status.textContent=e.message);
 }catch(e){status.textContent=e.message;}
}
function stopSensor(){if(sensorHandler)window.removeEventListener("deviceorientation",sensorHandler);sensorHandler=null;}
function publishInput(){if(roomId)socket.emit("playerInput",{angle,throttle});}
$("create").onclick=createRoom;$("join").onclick=joinRoom;$("start").onclick=()=>socket.emit("startGame");
$("leave").onclick=leave;$("leaveMobile").onclick=leave;$("sensor").onclick=startSensor;
$("accelerate").addEventListener("pointerdown",e=>{e.preventDefault();throttle=1;publishInput();});
["pointerup","pointercancel","pointerleave"].forEach(ev=>$("accelerate").addEventListener(ev,()=>{throttle=0;publishInput();}));
function render(){
 const canvas=$("arena");
 if(canvas&&mode==="desktop"){
  const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="#344a68";ctx.lineWidth=2;
  for(let x=0;x<canvas.width;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
  for(let y=0;y<canvas.height;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
  Object.values(players).forEach(p=>{
   ctx.save();ctx.translate(p.x||100,p.y||100);ctx.rotate(p.angle||0);
   ctx.fillStyle=p.color||"#fff";ctx.fillRect(-18,-10,36,20);
   ctx.fillStyle="#172338";ctx.fillRect(5,-7,8,14);ctx.restore();
   ctx.fillStyle="#fff";ctx.font="14px sans-serif";ctx.fillText(p.name||"car",(p.x||100)-20,(p.y||100)-18);
  });
 }
 requestAnimationFrame(render);
}
render();
})();