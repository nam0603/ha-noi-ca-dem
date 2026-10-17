import {BUILDINGS,TREES,BINS,COLORS,distance,rainy,type Game,type Player} from './game';
const C={road:'#68776f',walk:'#a4aaa0',dark:'#173b38',ink:'#233e39'};
export function drawScene(ctx:CanvasRenderingContext2D,g:Game,myId:string,t:number,view:{x:number;y:number}|null){
 const w=1280,h=800;ctx.clearRect(0,0,w,h);ctx.fillStyle=C.road;ctx.fillRect(0,0,w,h);
 // Quiet grain and paving make the neighbourhood legible without external assets.
 ctx.fillStyle='#78847b';for(let i=0;i<420;i++){const x=(i*137.21)%w,y=(i*79.81)%h;ctx.fillRect(x,y,2,2);}
 ctx.fillStyle=C.walk;ctx.fillRect(0,0,w,268);ctx.fillRect(0,374,w,247);ctx.fillRect(0,774,w,26);
 ctx.fillRect(358,0,100,800);ctx.fillRect(812,0,98,800);
 ctx.strokeStyle='#909b91';ctx.lineWidth=1;for(let x=0;x<1280;x+=25){ctx.beginPath();ctx.moveTo(x,232);ctx.lineTo(x,268);ctx.moveTo(x,578);ctx.lineTo(x,621);ctx.stroke();}
 ctx.strokeStyle='#cbd0b6';ctx.lineWidth=3;ctx.setLineDash([23,26]);ctx.beginPath();ctx.moveTo(0,322);ctx.lineTo(1280,322);ctx.moveTo(0,695);ctx.lineTo(1280,695);ctx.stroke();ctx.setLineDash([]);
 // Crossing stripes.
 ctx.fillStyle='#d2d1b8';[407,860].forEach(x=>{for(let y=278;y<368;y+=15)ctx.fillRect(x-30,y,60,7);});
 // Courtyards, tiled roofs and shop awnings.
 BUILDINGS.forEach((b,i)=>{
  ctx.fillStyle='#263e3b40';ctx.fillRect(b.x+12,b.y+14,b.w,b.h+8);
  ctx.fillStyle='#5a635c';ctx.fillRect(b.x-3,b.y-3,b.w+6,b.h+6);
  ctx.fillStyle=b.color;ctx.fillRect(b.x,b.y,b.w,b.h);
  ctx.fillStyle=i===4?'#647e68':'#7e8274';ctx.fillRect(b.x+10,b.y+10,b.w-20,b.h-60);
  if(i===4){ctx.strokeStyle='#a8bb9d';ctx.strokeRect(b.x+35,b.y+25,b.w-70,b.h-90);ctx.beginPath();ctx.arc(b.x+b.w/2,b.y+65,20,0,Math.PI*2);ctx.stroke();}
  else{ctx.strokeStyle='#a2a18b50';for(let k=0;k<7;k++){ctx.beginPath();ctx.moveTo(b.x+12,b.y+20+k*15);ctx.lineTo(b.x+b.w-12,b.y+20+k*15);ctx.stroke();}ctx.fillStyle='#bcc7ba';ctx.fillRect(b.x+b.w-65,b.y+25,32,23);ctx.fillStyle='#798d85';ctx.fillRect(b.x+b.w-61,b.y+29,24,15);}
  ctx.fillStyle='#34534b';ctx.fillRect(b.x+15,b.y+b.h-43,b.w-30,35);
  ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.fillStyle='#f3e6bf';ctx.fillText(b.label,b.x+b.w/2,b.y+b.h-21);
  for(let k=0;k<Math.floor(b.w/22);k++){ctx.fillStyle=k%2?'#d6c395':'#617d70';ctx.fillRect(b.x+k*22,b.y+b.h,22,13);}
  // Pots beside shopfronts.
  [b.x+15,b.x+b.w-20].forEach(x=>{ctx.fillStyle='#7f6754';ctx.fillRect(x,b.y+b.h+16,12,12);ctx.fillStyle='#405f46';ctx.beginPath();ctx.arc(x+6,b.y+b.h+16,10,0,7);ctx.fill();});
 });
 ctx.textAlign='left';ctx.font='bold 12px Arial';ctx.fillStyle='#e9ebce99';ctx.fillText('PHỐ PHAN ĐÌNH PHÙNG',35,301);ctx.fillText('PHỐ NGUYỄN DU',35,674);
 // Fragrant tree zones: a game mechanic, visually signalled.
 TREES.filter(tr=>tr.flower).forEach(tr=>{const gradient=ctx.createRadialGradient(tr.x,tr.y,20,tr.x,tr.y,125);gradient.addColorStop(0,'#e6d6ef13');gradient.addColorStop(.75,'#d9c9e525');gradient.addColorStop(1,'#e6d6ef00');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(tr.x,tr.y,125,0,7);ctx.fill();ctx.strokeStyle='#d4c1dd35';ctx.setLineDash([3,9]);ctx.stroke();ctx.setLineDash([]);});
 if(rainy(g)){g.drains.forEach(d=>{if(d.water<.03)return;ctx.save();ctx.translate(d.x,d.y);ctx.scale(1,.65);ctx.fillStyle=`rgba(88,164,177,${.18+d.water*.33})`;ctx.beginPath();ctx.arc(0,0,65+d.water*75,0,7);ctx.fill();ctx.strokeStyle='#b6dad450';for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(0,0,25+k*28+Math.sin(t*.001+k)*6,25+k*28,0,0,7);ctx.stroke();}ctx.restore();});}
 g.drains.forEach(d=>{ctx.fillStyle=d.clog<=.01?'#53aa9b':'#384b49';ctx.fillRect(d.x-16,d.y-11,32,22);ctx.strokeStyle='#a7b7a5';ctx.lineWidth=2;for(let k=-10;k<=10;k+=5){ctx.beginPath();ctx.moveTo(d.x+k,d.y-7);ctx.lineTo(d.x+k,d.y+7);ctx.stroke();}if(rainy(g)&&d.clog>0){ctx.fillStyle='#c5a25d';ctx.beginPath();ctx.ellipse(d.x+2,d.y-1,10,5,.5,0,7);ctx.fill();ctx.fillStyle='#1e3736';ctx.fillRect(d.x-23,d.y-25,46,5);ctx.fillStyle='#e2b967';ctx.fillRect(d.x-23,d.y-25,46*(1-d.clog),5);}if(d.clog<=.01){ctx.font='bold 15px Arial';ctx.fillStyle='#d5fae0';ctx.textAlign='center';ctx.fillText('✓',d.x,d.y-18);}});
 BINS.forEach(b=>{ctx.fillStyle='#233c3570';ctx.beginPath();ctx.ellipse(b.x+4,b.y+20,27,10,0,0,7);ctx.fill();ctx.fillStyle='#173d37';ctx.fillRect(b.x-20,b.y-20,40,38);ctx.fillStyle='#79a28a';ctx.fillRect(b.x-23,b.y-24,46,8);ctx.fillStyle='#b7d2a3';ctx.font='18px Arial';ctx.textAlign='center';ctx.fillText('♻',b.x,b.y+7);ctx.fillStyle='#26332f';ctx.beginPath();ctx.arc(b.x-14,b.y+21,5,0,7);ctx.arc(b.x+14,b.y+21,5,0,7);ctx.fill();ctx.font='bold 9px Arial';ctx.fillStyle='#e3e9ce';ctx.fillText('XE RÁC',b.x,b.y-33);});
 const lc=['#c9914f','#dec172','#bba461','#b97842'];g.leaves.forEach(l=>{ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.id*1.93);ctx.fillStyle='#354d4140';ctx.beginPath();ctx.ellipse(2,3,9,4,0,0,7);ctx.fill();ctx.fillStyle=lc[l.kind];ctx.beginPath();ctx.ellipse(0,0,9,4,0,0,7);ctx.fill();ctx.strokeStyle='#98764a';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(8,0);ctx.stroke();if(l.hp<1){ctx.fillStyle='#fff7ce';ctx.fillRect(-7,-8,(1-l.hp)*14,2);}ctx.restore();});
 // Trees with separate little clusters, rather than flat circles.
 TREES.forEach((tr,i)=>{ctx.fillStyle='#223f3640';ctx.beginPath();ctx.ellipse(tr.x+14,tr.y+19,39,22,0,0,7);ctx.fill();ctx.fillStyle='#75664b';ctx.fillRect(tr.x-4,tr.y-9,8,25);const palette=tr.flower?['#496947','#587b51','#6d8b59']:['#8f8e4b','#a9a057','#c1ac62'];for(let k=0;k<5;k++){const a=k*1.25;ctx.fillStyle=palette[k%3];ctx.beginPath();ctx.arc(tr.x+Math.cos(a)*17,tr.y-18+Math.sin(a)*13,22,0,7);ctx.fill();}if(tr.flower){ctx.fillStyle='#e5dfb9';for(let j=0;j<13;j++){ctx.beginPath();ctx.arc(tr.x+Math.sin(j*4+i)*29,tr.y-18+Math.cos(j*2)*23,2.2,0,7);ctx.fill();}}});
 [...g.players].sort((a,b)=>a.y-b.y).forEach(p=>drawPlayer(ctx,p,p.id===myId,t,p.id===myId?view:null));
 // A few falling leaves give the still neighbourhood its own rhythm.
 if(!rainy(g)){for(let i=0;i<17;i++){const x=(i*113.71+Math.sin(t*.0008+i)*20)%w,y=(i*63+t*.024)%h;ctx.save();ctx.translate(x,y);ctx.rotate(t*.002+i);ctx.globalAlpha=.7;ctx.fillStyle='#e4c47a';ctx.beginPath();ctx.ellipse(0,0,5,2.5,0,0,7);ctx.fill();ctx.restore();}}
 if(rainy(g)){ctx.fillStyle='#163e5915';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#d0e5e440';ctx.lineWidth=1;for(let i=0;i<130;i++){const x=(i*83.5-t*.12)%1350,y=(i*79+t*.45)%850;ctx.beginPath();ctx.moveTo(x<0?x+1350:x,y);ctx.lineTo((x<0?x+1350:x)-5,y+16);ctx.stroke();}}
 // Vignette keeps the eye on the streets.
 const v=ctx.createRadialGradient(640,430,250,640,430,820);v.addColorStop(0,'#123a3500');v.addColorStop(1,'#0e302d55');ctx.fillStyle=v;ctx.fillRect(0,0,w,h);
}
function drawPlayer(ctx:CanvasRenderingContext2D,p:Player,me:boolean,t:number,view:{x:number;y:number}|null){const x=view?.x??p.x,y=view?.y??p.y;
 ctx.save();ctx.translate(x,y);ctx.fillStyle='#1a332d66';ctx.beginPath();ctx.ellipse(0,12,15,7,0,0,7);ctx.fill();
 if(me){ctx.strokeStyle='#fbecbb';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,10,22,12,0,0,7);ctx.stroke();if(p.working){ctx.strokeStyle='#f0d69680';ctx.setLineDash([5,8]);ctx.beginPath();ctx.arc(0,0,63,0,7);ctx.stroke();ctx.setLineDash([]);}}
 ctx.fillStyle='#263b36';ctx.fillRect(-8,7,6,12);ctx.fillRect(3,7,6,12);ctx.fillStyle=COLORS[p.color];ctx.beginPath();ctx.roundRect(-12,-10,24,24,5);ctx.fill();ctx.fillStyle='#eae5b9';ctx.fillRect(-12,2,24,4);
 ctx.fillStyle='#d6b48b';ctx.beginPath();ctx.arc(0,-14,9,0,7);ctx.fill();ctx.fillStyle='#e3ce98';ctx.beginPath();ctx.ellipse(0,-20,14,5,0,0,7);ctx.fill();ctx.beginPath();ctx.moveTo(-12,-21);ctx.lineTo(0,-31);ctx.lineTo(12,-21);ctx.fill();
 if(p.mask>0){ctx.fillStyle='#dbeae0';ctx.fillRect(-7,-14,14,5);}
 ctx.save();ctx.rotate(p.working?Math.sin(t*.018)*.55+.4:.4);ctx.strokeStyle='#cbb28a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(13,-4);ctx.lineTo(29,29);ctx.stroke();ctx.fillStyle='#c19b5c';ctx.beginPath();ctx.moveTo(24,22);ctx.lineTo(34,19);ctx.lineTo(44,36);ctx.lineTo(24,43);ctx.closePath();ctx.fill();ctx.restore();
 if(p.headache>45&&p.mask<=0){ctx.fillStyle='#d9c4ed';ctx.font='bold 18px Arial';ctx.fillText('〰',-9,-40);}
 ctx.font='bold 12px Arial';ctx.textAlign='center';const name=me?'BẠN':p.name;const tw=ctx.measureText(name).width;ctx.fillStyle='#193832dc';ctx.beginPath();ctx.roundRect(-tw/2-7,27,tw+14,20,5);ctx.fill();ctx.fillStyle=me?'#f5dfa2':'#e9eee0';ctx.fillText(name,0,41);ctx.restore();
}
