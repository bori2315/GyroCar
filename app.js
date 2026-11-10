(() => {
const $ = id => document.getElementById(id);
const config = window.FIREBASE_CONFIG || {};
const configured = config.apiKey && !config.apiKey.startsWith("YOUR_");
let db, auth, uid, roomId = null, isHost = false, playerName = "플레이어", roomRef, playerRef;
let mode = "home", angle = 0, throttle = 0, sensorReady = false, cars = {};
const colors = ["#55a7ff","#ffb454","#75db9a","#ed7bd0","#c2a4ff","#ff7777","#75dedb","#e5dc74"];
const setNotice = s => $("notice").textContent = s;
function show(id){["home","lobby","desktop","mobile"].forEach(x=>$(x).classList.toggle("hidden",x!==id));mode=id;}
if(!configured){$("connection").textContent="Firebase 설정 필요";setNotice("firebase-config.js에 Firebase 웹 앱 설정을 입력해야 해.");}
else{
 try{firebase.initializeApp(config);auth=firebase.auth();db=firebase.database();auth.signInAnonymously().then(c=>{uid=c.user.uid;$("connection").textContent="Firebase 연결됨";}).catch(e=>{$("connection").textContent="인증 실패";setNotice(e.message);});}
 catch(e){setNotice("Firebase 초기화 실패: "+e.message);}
}
const code=()=>Math.random().toString(36).slice(2,8).toUpperCase();
async function createRoom(){
 if(!uid)return setNotice("Firebase 설정과 익명 로그인을 확인해.");
 playerName=$("nickname").value.trim()||"플레이어";roomId=code();isHost=true;
 roomRef=db.ref("rooms/"+roomId);
 await roomRef.set({host:uid,status:"waiting",createdAt:firebase.database.ServerValue.TIMESTAMP,players:{[uid]:{name:playerName,x:150,y:150,angle:0,color:colors[0],joinedAt:Date.now()}}});
 await enterRoom();
}
async function joinRoom(){
 if(!uid)return setNotice("Firebase 연결을 기다려.");
 roomId=$("roomCode").value.trim().toUpperCase();if(roomId.length!==6)return setNotice("6자리 방 코드를 입력해.");
 playerName=$("nickname").value.trim()||"플레이어";roomRef=db.ref("rooms/"+roomId);
 const snap=await roomRef.once("value");if(!snap.exists())return setNotice("방을 찾을 수 없어.");
 const data=snap.val();if(data.status==="playing")return setNotice("이미 게임이 시작된 방이야.");
 if(Object.keys(data.players||{}).length>=8)return setNotice("최대 8명까지 참가할 수 있어.");
 isHost=data.host===uid;await roomRef.child("players/"+uid).set({name:playerName,x:150+Math.random()*500,y:150+Math.random()*300,angle:0,color:colors[Object.keys(data.players||{}).length%colors.length],joinedAt:Date.now()});await enterRoom();
}
async function enterRoom(){
 playerRef=roomRef.child("players/"+uid);playerRef.onDisconnect().remove();$("codeLabel").textContent=roomId;
 roomRef.child("players").on("value",s=>{const p=s.val()||{};$("players").innerHTML="";Object.values(p).forEach(v=>{const li=document.createElement("li");li.textContent=v.name;$("players").appendChild(li);});});
 roomRef.child("status").on("value",s=>{if(s.val()==="playing")startPlay();});
 $("start").style.display=isHost?"inline-block":"none";show("lobby");
}
async function startGame(){if(!isHost)return;await roomRef.update({status:"playing",startedAt:firebase.database.ServerValue.TIMESTAMP});}
function startPlay(){if(mode==="desktop"||mode==="mobile")return;const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);show(mobile?"mobile":"desktop");if(mobile)requestLandscape();}
function requestLandscape(){if(screen.orientation&&screen.orientation.lock)screen.orientation.lock("landscape").catch(()=>{});}
function leave(){if(playerRef)playerRef.remove();if(roomRef){roomRef.child("players").off();roomRef.child("status").off();}roomId=null;playerRef=null;roomRef=null;show("home");}
async function startSensor(){
 const status=$("sensorStatus");
 try{
  if(typeof DeviceOrientationEvent==="undefined")throw new Error("이 기기는 방향 센서를 지원하지 않아.");
  if(typeof DeviceOrientationEvent.requestPermission==="function"){
   const result=await DeviceOrientationEvent.requestPermission();
   if(result!=="granted")throw new Error("센서 권한이 허용되지 않았어.");
  }
  let got=false;
  const handler=e=>{
   if(e.gamma===null||e.gamma===undefined)return;
   got=true;sensorReady=true;
   // gamma is left/right tilt. Normalize neutral point to reduce steering drift.
   angle=Math.max(-1,Math.min(1,e.gamma/35));
   $("wheel").style.transform="rotate("+(-angle*115)+"deg)";
   publishInput();
  };
  window.addEventListener("deviceorientation",handler);
  status.textContent="센서 데이터 확인 중...";
  setTimeout(()=>{if(!got)status.textContent="센서 데이터가 없어. HTTPS, 브라우저 권한, 기기 센서 설정을 확인해.";else status.textContent="센서 작동 중";},2500);
 }catch(e){status.textContent=e.message;}
}
let publishTimer=null;
function publishInput(){if(!playerRef||!sensorReady)return;if(publishTimer)return;publishTimer=setTimeout(()=>{publishTimer=null;playerRef.update({angle,throttle,x:firebase.database.ServerValue.increment(Math.cos(angle)*throttle*3),y:firebase.database.ServerValue.increment(Math.sin(angle)*throttle*3)}).catch(()=>{});},80);}
$("create").onclick=()=>createRoom().catch(e=>setNotice(e.message));
$("join").onclick=()=>joinRoom().catch(e=>setNotice(e.message));
$("start").onclick=()=>startGame().catch(e=>setNotice(e.message));
$("leave").onclick=leave;$("leaveMobile").onclick=leave;$("sensor").onclick=startSensor;
$("accelerate").addEventListener("pointerdown",e=>{e.preventDefault();throttle=1;publishInput();});
["pointerup","pointercancel","pointerleave"].forEach(ev=>$("accelerate").addEventListener(ev,()=>{throttle=0;publishInput();}));
function render(){
 const canvas=$("arena");if(!canvas||mode!=="desktop"){requestAnimationFrame(render);return;}
 const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle="#344a68";ctx.lineWidth=2;
 for(let x=0;x<canvas.width;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
 for(let y=0;y<canvas.height;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
 if(roomRef)roomRef.child("players").once("value").then(s=>{ctx.clearRect(0,0,canvas.width,canvas.height);const p=s.val()||{};Object.entries(p).forEach(([id,v])=>{ctx.save();ctx.translate(v.x||100,v.y||100);ctx.rotate(v.angle||0);ctx.fillStyle=v.color||"#fff";ctx.fillRect(-18,-10,36,20);ctx.fillStyle="#172338";ctx.fillRect(5,-7,8,14);ctx.restore();ctx.fillStyle="#fff";ctx.font="14px sans-serif";ctx.fillText(v.name||"car",(v.x||100)-20,(v.y||100)-18);});});requestAnimationFrame(render);
}
render();
})();