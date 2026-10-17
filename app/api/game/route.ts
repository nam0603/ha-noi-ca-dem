import { env } from 'cloudflare:workers';
import { newGame,joinGame,startGame,tickWorld,applyInput,releaseOrphanCarts,type Game,type Input,type Season } from '@/lib/game';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return reply({error:'Nguồn yêu cầu không hợp lệ.'},403);
 if(!env.DB)return reply({error:'Máy chủ phòng chơi chưa sẵn sàng. Bạn vẫn có thể chơi một mình.'},503);
 const raw=await req.text();if(raw.length>2500)return reply({error:'Yêu cầu quá lớn.'},400);const body=JSON.parse(raw);
 const {action,id,token}=body;if(typeof token!=='string'||!/^[a-zA-Z0-9-]{32,80}$/.test(token))return reply({error:'Phiên chơi không hợp lệ.'},400);if(typeof id!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(id))return reply({error:'Mã người chơi không hợp lệ.'},400);
 const now=Date.now();const name=typeof body.name==='string'?body.name:'Lao công';
 if(action==='create'){
  const season:Season=['autumn','rain','mixed'].includes(body.season)?body.season:'mixed';
  await env.DB.prepare('DELETE FROM rooms WHERE updated_at < ?').bind(now-86400000).run();
  for(let i=0;i<5;i++){const code=crypto.randomUUID().replace(/-/g,'').slice(0,6).toUpperCase();const g=newGame(season,now,body.pace==='relaxed'?'relaxed':'shift');g.code=code;joinGame(g,id,name,now);
   const result=await env.DB.prepare('INSERT OR IGNORE INTO rooms (code,state,tokens,version,updated_at) VALUES (?,?,?,0,?)').bind(code,JSON.stringify(g),JSON.stringify({[id]:token}),now).run();if(result.meta.changes)return reply({game:g});}
  return reply({error:'Chưa tạo được phòng. Thử lại nhé.'},503);
 }
 const code=String(body.code??'').toUpperCase();if(!/^[A-F0-9]{6}$/.test(code))return reply({error:'Mã phòng gồm 6 ký tự.'},400);
 for(let tries=0;tries<8;tries++){
 const row=await env.DB.prepare('SELECT state,tokens,version,updated_at FROM rooms WHERE code=?').bind(code).first<{state:string;tokens:string;version:number;updated_at:number}>();if(!row||now-row.updated_at>86400000)return reply({error:'Không tìm thấy phòng hoặc phòng đã hết hạn.'},404);
 const g:Game=JSON.parse(row.state);if(g.format!==3)return reply({error:"Phòng thuộc bản cũ. Về đầu phố và tạo phòng mới nhé."},409);const tokens:Record<string,string>=JSON.parse(row.tokens);if(tokens[id]&&tokens[id]!==token)return reply({error:'Phiên chơi không khớp.'},403);if(action!=='join'&&!tokens[id])return reply({error:'Bạn chưa vào phòng.'},403);tickWorld(g,now);
 g.players=g.players.filter(p=>p.id===id||now-p.lastSeen<25000);if(!g.players.some(p=>p.id===g.host))g.host=g.players[0]?.id??'';releaseOrphanCarts(g);
 if(action==='join'){joinGame(g,id,name,now);tokens[id]=token;}
 else {const p=g.players.find(p=>p.id===id);if(!p)return reply({error:'Bạn đã rời phòng. Hãy vào lại bằng mã phòng.'},403);
  p.lastSeen=now;
  if(action==='start')startGame(g,id,now);
  else if(action==='leave'){g.players=g.players.filter(p=>p.id!==id);if(g.host===id)g.host=g.players[0]?.id??'';releaseOrphanCarts(g);}
  else if(action==='input'){const v=body.input??{};const n=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;const input:Input={x:n(v.x),y:n(v.y),work:v.work===true,sprint:v.sprint===true,mask:v.mask===true,crouch:v.crouch===true,grab:v.grab===true,tool:v.tool==='scoop'?'scoop':'broom',yaw:typeof v.yaw==='number'&&Number.isFinite(v.yaw)?Math.max(-Math.PI,Math.min(Math.PI,v.yaw)):undefined,pitch:typeof v.pitch==='number'&&Number.isFinite(v.pitch)?Math.max(-1.4,Math.min(1.1,v.pitch)):undefined};if(!Number.isSafeInteger(body.seq)||body.seq<0)return reply({error:'Nhịp cập nhật không hợp lệ.'},400);applyInput(g,id,input,now,body.seq);}
  else if(action!=='poll')return reply({error:'Thao tác không hợp lệ.'},400);
 }
 const updated=await env.DB.prepare('UPDATE rooms SET state=?,tokens=?,version=version+1,updated_at=? WHERE code=? AND version=?').bind(JSON.stringify(g),JSON.stringify(tokens),now,code,row.version).run();if(updated.meta.changes)return reply({game:g,revision:row.version+1});
 }
 return reply({error:'Phòng đang bận, đang đồng bộ lại…'},409);
 }catch(e){return reply({error:e instanceof Error?e.message:'Kết nối gặp lỗi. Hãy thử lại.'},400);}}
