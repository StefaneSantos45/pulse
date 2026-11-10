import fs from 'node:fs';
import path from 'node:path';
import {investigate} from './investigation.mjs';
export async function collectInvestigation(get,locationId,{root,onProgress=()=>{}}){
const cutoff=new Date().toISOString(),base=path.join(root,'.cache')+path.sep;
let previous;try{previous=JSON.parse(fs.readFileSync(base+'investigation-history.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(previous&&Date.parse(cutoff)-Date.parse(previous.fullRetrievedAt||previous.cutoff)>86400000)previous=undefined;
if(!previous){try{
 const partial=JSON.parse(fs.readFileSync(base+'investigation-partial.json','utf8')),manifest=JSON.parse(fs.readFileSync(base+'replies-history.json','utf8'));
 if(partial.channel==='SMS'&&Date.parse(manifest.cutoff)>=Date.parse(partial.cutoff)&&Date.parse(cutoff)-Date.parse(partial.cutoff)<86400000){
  const expected=new Set((manifest.channels.SMS?.messages||[]).filter(m=>m.dateAdded<=partial.cutoff).map(m=>m.id)),actual=new Set(partial.messages.map(m=>m.id));
  if(expected.size===actual.size&&[...expected].every(id=>actual.has(id))&&!(manifest.channels.WhatsApp?.messages||[]).some(m=>m.dateAdded<=partial.cutoff))previous={cutoff:partial.cutoff,fullRetrievedAt:partial.cutoff,messages:partial.messages};
 }
 }catch(e){if(e.code&&e.code!=='ENOENT')throw e;}}
const recentStart=previous?.cutoff?new Date(Date.parse(previous.cutoff)-7*86400000).toISOString():null;
const messages=(previous?.messages||[]).filter(m=>m.dateAdded<recentStart),totals={};let intervals=0;
for(const channel of ['SMS','WhatsApp']){
 const seen=new Map(),cursors=new Set();let cursor,expected,rawCount=0;
 for(let page=0;page<10000;page++){
  const d=await get('/conversations/messages/export?'+new URLSearchParams({locationId,channel,limit:'1000',sortOrder:'asc',sortBy:'createdAt',endDate:cutoff,...(recentStart?{startDate:recentStart}:{}),...(cursor?{cursor}:{})}));
  if(!Array.isArray(d.messages)||!Number.isInteger(d.total))throw Error('Resposta inesperada do histórico.');expected??=d.total;
  rawCount+=d.messages.length;const before=seen.size;for(const m of d.messages){if(!m.id)throw Error('Mensagem sem identificação.');seen.set(m.id,Object.fromEntries(['id','contactId','dateAdded','direction','body','status'].map(k=>[k,m[k]])));}
  onProgress({messages:messages.length+seen.size});
  cursor=d.nextCursor;if(!cursor){
   if(rawCount!==expected){
    fs.writeFileSync(base+'investigation-partial.json',JSON.stringify({cutoff,channel,expected,messages:[...seen.values()]}));
    let manifest;try{manifest=JSON.parse(fs.readFileSync(base+'replies-history.json','utf8'));}catch{}
    const missing=(manifest?.channels?.[channel]?.messages||[]).filter(m=>!seen.has(m.id)&&m.dateAdded<=cutoff&&(!recentStart||m.dateAdded>=recentStart));
    if(missing.length>100)throw Error('Histórico incompleto: muitos registros precisam de conferência individual.');
    for(const m of missing){const detail=await get('/conversations/messages/'+encodeURIComponent(m.id));const current=detail.message||detail;if(current.id!==m.id||!current.dateAdded)throw Error('Não foi possível conferir uma mensagem ausente.');seen.set(m.id,Object.fromEntries(['id','contactId','dateAdded','direction','body','status'].map(k=>[k,current[k]])));}
    if(seen.size!==expected)throw Error('Histórico incompleto após conferência individual: '+seen.size+'/'+expected);
   }
   break;
  }

  if(seen.size===before)throw Error('A paginação de mensagens não avançou.');cursors.add(cursor);
  if(page===9999)throw Error('Limite de páginas excedido.');
 }
 totals[channel]=expected;messages.push(...seen.values());
}
const contacts=[];let expected,complete=false;for(let page=1;page<=1000;page++){const d=await get('/contacts/search',{locationId,page,pageLimit:100});if(!Array.isArray(d.contacts)||!Number.isInteger(d.total)||(expected!==undefined&&expected!==d.total))throw Error('A base de contatos mudou durante a investigação.');expected=d.total;const before=contacts.length;for(const c of d.contacts){if(!contacts.some(x=>x.id===c.id))contacts.push(c);}if(contacts.length===expected){complete=true;break;}if(contacts.length===before)break;}if(!complete)throw Error('Contatos incompletos');
let users=[];try{users=(await get('/users/?locationId='+locationId)).users||[];}catch{throw Error('Não foi possível atualizar os responsáveis.');}
const forms=JSON.parse(fs.readFileSync(base+'forms.json'));
const result={...investigate({contacts,messages,forms:forms.rows,cutoff,users}),formsRetrievedAt:forms.retrievedAt,contactsRetrievedAt:new Date().toISOString(),totals};
fs.writeFileSync(base+'investigation-history.json.tmp',JSON.stringify({cutoff,messages,fullRetrievedAt:previous?(previous.fullRetrievedAt||previous.cutoff):cutoff}));fs.renameSync(base+'investigation-history.json.tmp',base+'investigation-history.json');
fs.writeFileSync(base+'investigation.json.tmp',JSON.stringify(result));fs.renameSync(base+'investigation.json.tmp',base+'investigation.json');onProgress({complete:true,messages:messages.length});return result;

}
