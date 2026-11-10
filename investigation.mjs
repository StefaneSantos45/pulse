export const WINDOWS=[24,72,168];
const stamp=v=>Date.parse(v);
export function investigate({contacts,messages,forms,cutoff,users=[]}){
 const byContact=new Map(),seen=new Set();
 for(const m of messages){if(seen.has(m.id)||!Number.isFinite(stamp(m.dateAdded))||stamp(m.dateAdded)>stamp(cutoff))continue;seen.add(m.id);if(!byContact.has(m.contactId))byContact.set(m.contactId,[]);byContact.get(m.contactId).push(m);}
 const rows=[];
 for(const raw of contacts){const c={...raw,name:raw.name||raw.contactName||[raw.firstName,raw.lastName].filter(Boolean).join(' ')};if(/\bgrupos?\b|@g\.us/i.test((c.name||'')+' '+(c.phone||'')))continue;
 const history=(byContact.get(c.id)||[]).sort((a,b)=>stamp(a.dateAdded)-stamp(b.dateAdded)||a.id.localeCompare(b.id));
 const first=history.find(m=>m.direction==='outbound');if(!first)continue;
 const before=history.some(m=>m.direction==='inbound'&&stamp(m.dateAdded)<=stamp(first.dateAdded));
 const reply=history.find(m=>m.direction==='inbound'&&stamp(m.dateAdded)>stamp(first.dateAdded));
 const sent=history.filter(m=>m.direction==='outbound'&&(!reply||stamp(m.dateAdded)<stamp(reply.dateAdded)));
 let attempts=0,last=-Infinity;for(const m of sent){if(stamp(m.dateAdded)-last>30*60000)attempts++;last=stamp(m.dateAdded);}
 const burst=sent.filter(m=>stamp(m.dateAdded)-stamp(first.dateAdded)<=5*60000);
 const text=burst.map(m=>m.body||'[Mensagem sem texto]').join('\n\n');
 // Only explicit sender metadata and the contact's own name are normalized.
 let version=text.replace(/\nSource:[^\n]*/gi,'').normalize('NFKC').toLocaleLowerCase('pt-BR');
 for(const name of [c.name,...(c.name||'').split(/\s+/).filter(s=>s.length>=3)].filter(Boolean).sort((a,b)=>b.length-a.length)){const escaped=name.toLocaleLowerCase('pt-BR').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');version=version.replace(new RegExp('(?<![\\p{L}])'+escaped+'(?![\\p{L}])','gu'),'{nome}');}
 version=version.replace(/\s+/g,' ').trim();
 const submissions=forms.filter(f=>f.contactId===c.id&&stamp(f.createdAt)<=stamp(first.dateAdded)).sort((a,b)=>stamp(b.createdAt)-stamp(a.createdAt));
 const form=submissions[0];const owner=users.find(u=>u.id===c.assignedTo);
 rows.push({id:c.id,name:c.name||[c.firstName,c.lastName].filter(Boolean).join(' ')||'Sem nome',phone:c.phone||'',origin:c.source||'Não informada',owner:owner?.name||[owner?.firstName,owner?.lastName].filter(Boolean).join(' ')||c.assignedTo||'Sem responsável',firstAt:first.dateAdded,firstReply:reply?.dateAdded||null,leadInitiated:before,attempts,sentBeforeReply:sent.length,text,version,form:form?.formName||'Sem envio anterior registrado',formAt:form?.createdAt||null,formHours:form?(stamp(first.dateAdded)-stamp(form.createdAt))/3600000:null,replyHours:reply?(stamp(reply.dateAdded)-stamp(first.dateAdded))/3600000:null,delivery:first.status||'unknown',initialMessages:burst.map(m=>({date:m.dateAdded,text:m.body||'[Mensagem sem texto]',status:m.status||'unknown'}))});
 }
 return {cutoff,rows};
}
export function responseWindows(rows,cutoff){return WINDOWS.map(hours=>{const eligible=rows.filter(r=>!r.leadInitiated&&stamp(cutoff)-stamp(r.firstAt)>=hours*3600000);const responded=eligible.filter(r=>r.replyHours!==null&&r.replyHours<=hours).length;return {hours,eligible:eligible.length,responded,rate:eligible.length?responded/eligible.length:null};});}
