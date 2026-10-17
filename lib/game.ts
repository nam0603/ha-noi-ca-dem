export type Season='autumn'|'rain'|'mixed';
export type Pace='shift'|'relaxed';
export type Tool='broom'|'scoop';
export type Input={x:number;y:number;work:boolean;sprint:boolean;mask:boolean;yaw?:number;pitch?:number;crouch?:boolean;grab?:boolean;tool?:Tool};
export type Player={id:string;name:string;x:number;y:number;bag:number;headache:number;mask:number;cooldown:number;score:number;color:number;face:number;pitch:number;crouched:boolean;pushing:string|null;working:boolean;tool:Tool;swept:number;picked:number;cleared:number;cartDistance:number;lastSeen:number;lastInput:number;seq:number};
export type Leaf={id:number;x:number;y:number;hp:number;kind:number};
export type Pile={id:number;x:number;y:number;amount:number;progress:number};
export type Drain={x:number;y:number;clog:number;water:number};
export type Cart={id:string;x:number;y:number;face:number;owner:string|null;stored:number};
export type Game={format:3;seed:number;nextId:number;season:Season;pace:Pace;rainAt:number;status:'lobby'|'playing'|'won'|'lost';time:number;duration:number;players:Player[];leaves:Leaf[];piles:Pile[];drains:Drain[];carts:Cart[];score:number;target:number;host:string;lastTick:number;spawn:number;code?:string};
export const WORLD={w:1280,h:800};
export const SCALE=.05;
export const COLORS=['#f5b354','#84b9e4','#d992bd','#b0d78c','#b8a2e2','#eb8c75','#80d7ce','#f1de7b'];
export const BUILDINGS=[{x:40,y:35,w:315,h:190,label:'CÀ PHÊ PHỐ',color:'#cba786'},{x:465,y:35,w:340,h:190,label:'NHÀ SÁCH THÁNG MƯỜI',color:'#a0b3a3'},{x:920,y:35,w:320,h:190,label:'TẠP HÓA CÔ LAN',color:'#d2b88f'},{x:40,y:390,w:315,h:180,label:'BÚN CHẢ HÀ NỘI',color:'#c0aa8e'},{x:465,y:390,w:340,h:180,label:'SÂN TẬP THỂ',color:'#9bada3'},{x:920,y:390,w:320,h:180,label:'TIỆM XE CHÚ HÙNG',color:'#b3a0a0'}];
export const TREES=[{x:90,y:253,flower:false},{x:285,y:253,flower:false},{x:520,y:253,flower:true},{x:740,y:253,flower:true},{x:990,y:253,flower:false},{x:1180,y:253,flower:false},{x:90,y:605,flower:false},{x:300,y:605,flower:false},{x:520,y:605,flower:true},{x:750,y:605,flower:true},{x:985,y:605,flower:false},{x:1180,y:605,flower:false}];
export const BINS=[{x:400,y:700},{x:860,y:310},{x:1150,y:710}];

export const DEPOTS=[{x:405,y:650,name:'ĐIỂM TẬP KẾT 01'},{x:860,y:275,name:'ĐIỂM TẬP KẾT 02'}];
export const CART_CAPACITY=36;
export const BAG_CAPACITY=18;
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export const rainy=(g:Game)=>g.season==='rain'||g.season==='mixed'&&g.time>=g.rainAt;
export function walkable(x:number,y:number,r=10){return x>=r&&x<=1280-r&&y>=240&&y<=800-r&&!BUILDINGS.some(b=>x>b.x-r&&x<b.x+b.w+r&&y>b.y-r&&y<b.y+b.h+r)&&!TREES.some(t=>Math.hypot(t.x-x,t.y-y)<r+3);}
export function waterDepth(g:Game,p:{x:number;y:number}){if(!rainy(g))return 0;return g.drains.reduce((depth,d)=>Math.max(depth,distance(d,p)<65+d.water*75?d.water*.45:0),0);}
function random(g:Game){g.seed=(Math.imul(g.seed,1664525)+1013904223)>>>0;return g.seed/4294967296;}
export function addLeaves(g:Game,n:number){for(let i=0;i<n&&g.leaves.length<130&&g.leaves.length+g.piles.reduce((n,p)=>n+p.amount,0)<240;i++){const x=30+random(g)*1220,y=random(g)>.5?275+random(g)*80:650+random(g)*110;g.leaves.push({id:g.nextId++,x,y,hp:1,kind:Math.floor(random(g)*4)});}}
export function newGame(season:Season='mixed',now=Date.now(),pace:Pace='shift'):Game {
 const g:Game={format:3,seed:(now^1709)>>>0,nextId:1,season,pace,rainAt:75,status:'lobby',time:0,duration:480,players:[],leaves:[],piles:[],drains:[{x:200,y:355,clog:1,water:.55},{x:900,y:355,clog:1,water:.55},{x:670,y:740,clog:1,water:.55}],carts:BINS.map((b,i)=>({...b,id:'cart'+i,face:0,owner:null,stored:0})),score:0,target:24,host:'',lastTick:now,spawn:0};
 g.rainAt=65+Math.floor(random(g)*31);addLeaves(g,60);for(const [x,y] of [[425,730],[447,724],[452,744],[470,733]])g.leaves.push({id:g.nextId++,x,y,hp:1,kind:1});return g;
}
export function joinGame(g:Game,id:string,name:string,now:number){let p=g.players.find(p=>p.id===id);if(p){p.lastSeen=now;return p;}g.players=g.players.filter(p=>now-p.lastSeen<25000);releaseOrphanCarts(g);if(g.players.length>=8)throw new Error('Phòng đã đủ 8 người.');const color=[0,1,2,3,4,5,6,7].find(c=>!g.players.some(p=>p.color===c))??0;
 p={id,name:name.trim().slice(0,20)||'Lao công',x:380+(color%2)*35,y:730+Math.floor(color/2)*14,bag:0,headache:0,mask:0,cooldown:0,score:0,color,face:0,pitch:0,crouched:false,pushing:null,working:false,tool:'broom',swept:0,picked:0,cleared:0,cartDistance:0,lastSeen:now,lastInput:now,seq:-1};g.players.push(p);if(!g.host||!g.players.some(p=>p.id===g.host))g.host=id;return p;
}
export function startGame(g:Game,id:string,now:number){if(id!==g.host)throw new Error('Chỉ chủ phòng được bắt đầu ca.');if(g.status==='playing')return;const ps=g.players;const code=g.code;const fresh=newGame(g.season,now,g.pace);Object.assign(g,fresh);g.players=ps;g.host=id;g.code=code;g.target=24+12*(ps.length-1);g.status='playing';
 if(ps.length>=4)g.drains.push({x:600,y:350,clog:1,water:.55},{x:160,y:745,clog:1,water:.55},{x:1090,y:745,clog:1,water:.55});
 g.players.forEach((p,i)=>Object.assign(p,{x:380+(i%2)*35,y:730+Math.floor(i/2)*14,bag:0,headache:0,mask:0,cooldown:0,score:0,face:0,pitch:0,crouched:false,pushing:null,working:false,tool:'broom',swept:0,picked:0,cleared:0,cartDistance:0,lastInput:now,lastSeen:now,seq:-1}));
}
export function releaseOrphanCarts(g:Game){g.carts.forEach(c=>{if(c.owner&&!g.players.some(p=>p.id===c.owner))c.owner=null;});}
export function tickWorld(g:Game,now:number){now=Math.max(now,g.lastTick);const dt=clamp((now-g.lastTick)/1000,0,5);g.lastTick=now;if(g.status!=='playing')return;g.time=g.pace==='relaxed'?g.time+dt:Math.min(g.duration,g.time+dt);if(g.pace==='shift'&&g.duration-g.time<1e-6)g.time=g.duration;g.spawn+=dt;const interval=rainy(g)?4:2.8;while(g.spawn>=interval){g.spawn-=interval;addLeaves(g,Math.max(1,Math.ceil(g.players.length/2)));}if(rainy(g))g.drains.forEach(d=>{d.water=clamp(d.water+dt*(d.clog>.01?.02:-.15),0,1)});checkEnd(g);}
function checkEnd(g:Game){const drainsOK=g.season==='autumn'||rainy(g)&&g.drains.every(d=>d.clog<=.01);if(g.score>=g.target&&drainsOK)g.status='won';else if(g.pace==='shift'&&g.time>=g.duration)g.status='lost';}
export type Task={kind:'cart'|'depot'|'drain'|'leaf'|'pile';index:number;progress:number;label:string};
function inFront(p:Player,o:{x:number;y:number},reach:number){const d=distance(p,o);return d<reach&&(d<9||((o.x-p.x)*Math.cos(p.face)+(o.y-p.y)*Math.sin(p.face))/d>.45);}
export function taskAt(g:Game,p:Player):Task|null{
 if(p.pushing){const ci=g.carts.findIndex(c=>c.id===p.pushing&&c.owner===p.id);if(ci>=0&&g.carts[ci].stored>.001&&DEPOTS.some(d=>distance(d,g.carts[ci])<48))return {kind:'depot',index:ci,progress:1-g.carts[ci].stored/CART_CAPACITY,label:'Giữ E · Bàn giao rác tại điểm tập kết'};return null;}
 const ci=g.carts.findIndex(c=>inFront(p,c,43)&&c.stored<CART_CAPACITY-.001);if(ci>=0&&p.bag>.001)return {kind:'cart',index:ci,progress:1-p.bag/BAG_CAPACITY,label:'Giữ E · Đổ lá từ túi vào xe'};
 if(p.pitch>-.2&&!p.crouched)return null;
 const di=g.drains.findIndex(d=>d.clog>.01&&inFront(p,d,42));if(rainy(g)&&di>=0&&p.tool==='scoop')return {kind:'drain',index:di,progress:1-g.drains[di].clog,label:'Giữ E · Dùng xẻng khơi miệng cống'};
 if(p.tool==='scoop'){
  if(p.bag>=BAG_CAPACITY)return null;let pi=-1,near=Infinity;g.piles.forEach((l,i)=>{const d=distance(p,l);if(inFront(p,l,44)&&d<near){near=d;pi=i;}});if(pi>=0)return {kind:'pile',index:pi,progress:g.piles[pi].progress,label:'Giữ E · Hốt đống lá vào túi'};return null;
 }
 let li=-1,near=Infinity;g.leaves.forEach((l,i)=>{const d=distance(p,l);if(inFront(p,l,p.crouched?46:40)&&d<near){near=d;li=i;}});if(li>=0)return {kind:'leaf',index:li,progress:1-g.leaves[li].hp,label:rainy(g)?'Giữ E · Gom lá ướt (nặng hơn)':'Giữ E · Quét lá thành đống'};return null;
}
export function grabCart(g:Game,p:Player){if(p.pushing){const c=g.carts.find(c=>c.id===p.pushing);if(c?.owner===p.id)c.owner=null;p.pushing=null;return;}const c=g.carts.filter(c=>!c.owner&&inFront(p,c,48)).sort((a,b)=>distance(p,a)-distance(p,b))[0];if(c){const nx=p.x+Math.cos(p.face)*26,ny=p.y+Math.sin(p.face)*26;if(walkable(nx,ny,15)){c.owner=p.id;p.pushing=c.id;c.x=nx;c.y=ny;c.face=p.face;}}}
export function movePlayer(g:Game,p:Player,input:Input,dt:number){dt=clamp(dt,0,.35);if(g.status!=='playing')return;if(input.yaw!==undefined)p.face=Math.atan2(-Math.cos(input.yaw),-Math.sin(input.yaw));p.pitch=clamp(input.pitch??p.pitch,-1.4,1.1);p.crouched=!!input.crouch;if(input.tool==='broom'||input.tool==='scoop')p.tool=input.tool;
 if(input.grab)grabCart(g,p);p.cooldown=Math.max(0,p.cooldown-dt);p.mask=Math.max(0,p.mask-dt);if(input.mask&&p.cooldown<=0){p.mask=22;p.cooldown=30;}const flower=TREES.some(t=>t.flower&&distance(t,p)<85);p.headache=clamp(p.headache+dt*(flower&&p.mask<=0?10:-27),0,100);const dizzy=p.headache>65;
 const cart=g.carts.find(c=>c.id===p.pushing&&c.owner===p.id);if(p.pushing&&!cart)p.pushing=null;
 const speed=(input.sprint&&!cart?112:72)*(dizzy?.78:1)*(waterDepth(g,p)>.1?.58:1)*(p.crouched?.55:1)*(cart?.78-.24*cart.stored/CART_CAPACITY:1);const len=Math.hypot(input.x,input.y),oldX=p.x,oldY=p.y;
 if(len>0){const dx=input.x/Math.max(1,len)*speed*dt,dy=input.y/Math.max(1,len)*speed*dt;if(input.yaw===undefined)p.face=Math.atan2(dy,dx);const can=(x:number,y:number)=>walkable(x,y)&&(!cart||walkable(x+Math.cos(p.face)*26,y+Math.sin(p.face)*26,15));if(can(p.x+dx,p.y))p.x+=dx;if(can(p.x,p.y+dy))p.y+=dy;}
 if(cart){p.cartDistance+=Math.hypot(p.x-oldX,p.y-oldY)*SCALE;const nx=p.x+Math.cos(p.face)*26,ny=p.y+Math.sin(p.face)*26;if(walkable(nx,ny,15)){cart.x=nx;cart.y=ny;cart.face=p.face;}else{cart.owner=null;p.pushing=null;}}
 p.working=input.work; if(!p.working)return;const task=taskAt(g,p);if(!task)return;
 if(task.kind==='depot'){const c=g.carts[task.index],amount=Math.min(c.stored,dt*8);c.stored=Math.max(0,Math.round((c.stored-amount)*1000)/1000);g.score=Math.round((g.score+amount)*1000)/1000;p.score=Math.round((p.score+amount)*1000)/1000;checkEnd(g);return;}
 if(task.kind==='cart'){const c=g.carts[task.index],dump=Math.min(p.bag,dt*10,CART_CAPACITY-c.stored);p.bag=Math.max(0,Math.round((p.bag-dump)*1000)/1000);c.stored=Math.round((c.stored+dump)*1000)/1000;return;}
 if(task.kind==='drain'){const d=g.drains[task.index],amount=Math.min(d.clog,dt*(dizzy?.09:.17));d.clog-=amount;p.cleared+=amount;if(d.clog<.011){p.cleared+=d.clog;d.clog=0;}checkEnd(g);return;}
 if(task.kind==='pile'){const pile=g.piles[task.index];pile.progress+=dt*(p.crouched?2.5:1.9);if(pile.progress>=1){const amount=Math.min(pile.amount,3,BAG_CAPACITY-p.bag);pile.amount-=amount;p.bag+=amount;p.picked+=amount;pile.progress=0;if(pile.amount<.001)g.piles.splice(task.index,1);}return;}
 const leaf=g.leaves[task.index];const amount=dt*(dizzy?.8:p.crouched?2:1.5)*(rainy(g)?.65:1);leaf.hp-=amount;
 // Sweep toward a reachable gathering spot, with a visible sliding leaf cluster.
 const ahead={x:p.x+Math.cos(p.face)*29,y:p.y+Math.sin(p.face)*29};if(walkable(ahead.x,ahead.y,2)){leaf.x+=(ahead.x-leaf.x)*Math.min(1,dt*4);leaf.y+=(ahead.y-leaf.y)*Math.min(1,dt*4);}
 if(leaf.hp<=0){let pile=g.piles.find(l=>distance(l,leaf)<34&&l.amount<18);if(pile)pile.amount++;else g.piles.push({id:g.nextId++,x:leaf.x,y:leaf.y,amount:1,progress:0});g.leaves.splice(task.index,1);p.swept++;}
}
export function applyInput(g:Game,id:string,input:Input,now:number,seq:number){const p=g.players.find(p=>p.id===id);if(!p)throw new Error('Bạn đã rời phòng. Hãy vào lại.');p.lastSeen=Math.max(p.lastSeen,now);now=Math.max(now,p.lastInput);if(seq<=p.seq)return;p.seq=seq;const dt=clamp((now-p.lastInput)/1000,0,.35);p.lastInput=now;movePlayer(g,p,input,dt);}
export function contextHint(g:Game,p:Player){const task=taskAt(g,p);if(task)return task.label;if(p.pushing){const c=g.carts.find(c=>c.id===p.pushing);return c&&c.stored>0?'Đẩy tới ô vàng TẬP KẾT · M xem bản đồ · Q buông xe':'Xe trống · WASD đẩy xe · Q buông để quét';}if(g.carts.some(c=>!c.owner&&inFront(p,c,48)))return 'Q · Nắm xe và đưa tới điểm tập kết';if(p.bag>=BAG_CAPACITY)return 'Túi đầy · Tìm xe rác để đổ lá';if(rainy(g)&&g.drains.some(d=>d.clog>.01&&inFront(p,d,50))&&p.tool!=='scoop')return '2 · Đổi sang xẻng để thông cống';if(g.piles.some(l=>inFront(p,l,50))&&p.tool==='broom')return 'Đã gom thành đống · 2 đổi xẻng · Giữ E để hốt';if(p.headache>65)return 'Choáng hương hoa · F đeo khẩu trang hoặc ra chỗ thoáng';if(waterDepth(g,p)>.1)return 'Nước ngập · M tìm cống · 2 dùng xẻng';if(p.pitch>-.2&&!p.crouched)return 'Nhìn xuống hoặc giữ C để cúi làm việc';return p.tool==='scoop'?'Tìm đống lá để hốt · 1 đổi lại chổi':'Lại gần lá · Giữ chuột trái để gom thành đống';}
