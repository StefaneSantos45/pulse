import {summarizeReplies} from './replies.mjs';

// Split bounded exports instead of silently accepting the API's 500-row limit.
export async function collectReplies(ghl,locationId,{cutoff=new Date().toISOString(),limit=1000,previous}={}){
 const fullRetrievedAt=previous?.fullRetrievedAt||previous?.cutoff;
 if(fullRetrievedAt&&Date.parse(cutoff)-Date.parse(fullRetrievedAt)>86400000)previous=undefined;
 const channels={};
 const start=previous?.cutoff?Math.max(Date.parse('2000-01-01T00:00:00Z'),Date.parse(previous.cutoff)-86400000):Date.parse('2000-01-01T00:00:00Z');
 if(!Number.isFinite(start)||start>Date.parse(cutoff))throw Error('Histórico anterior inválido.');
 for(const channel of ['SMS','WhatsApp']){
  const messages=new Map();
  async function interval(start,end){
   const d=await ghl('/conversations/messages/export?'+new URLSearchParams({locationId,channel,limit:String(limit),sortOrder:'asc',sortBy:'createdAt',startDate:new Date(start).toISOString(),endDate:new Date(end).toISOString()}));
   if(!Number.isInteger(d.total)||!Array.isArray(d.messages))throw Error('Resposta inesperada do histórico de mensagens.');
   if(d.nextCursor){
    const expected=d.total,seen=new Map(),cursors=new Set();let batch=d,rawCount=0;
    for(let page=0;page<10000;page++){
     rawCount+=batch.messages.length;const before=seen.size;for(const m of batch.messages){if(!m.id)throw Error('Mensagem sem identificação.');seen.set(m.id,{id:m.id,contactId:m.contactId,dateAdded:m.dateAdded,direction:m.direction});}
     const cursor=batch.nextCursor;if(!cursor)break;
     if(seen.size===before)throw Error('A paginação de mensagens não avançou.');cursors.add(cursor);
     batch=await ghl('/conversations/messages/export?'+new URLSearchParams({locationId,channel,limit:String(limit),sortOrder:'asc',sortBy:'createdAt',startDate:new Date(start).toISOString(),endDate:new Date(end).toISOString(),cursor}));
     if(!Array.isArray(batch.messages))throw Error('Resposta inesperada de mensagens.');
    }
    if(rawCount!==expected)throw Error('Histórico incompleto na paginação.');
    for(const [id,m]of seen)messages.set(id,m);return expected;
   }
   if(d.total>limit){
    if(end-start<2)throw Error('Intervalo de mensagens excedeu o limite da API.');
    const mid=Math.floor((start+end)/2);
    const left=await interval(start,mid),right=await interval(mid+1,end);
    if(left+right!==d.total)throw Error('O histórico mudou durante a consulta. Tente atualizar novamente.');
    return d.total;
   }
   if(d.messages.length!==d.total)throw Error('Histórico de mensagens incompleto. A consulta anterior foi preservada.');
   for(const m of d.messages){if(!m.id)throw Error('Mensagem sem identificação.');messages.set(m.id,{id:m.id,contactId:m.contactId,dateAdded:m.dateAdded,direction:m.direction});}
   return d.total;
  }
  const total=await interval(start,Date.parse(cutoff));
  // Counts validate exported records; contact metrics deduplicate message IDs.
  for(const m of previous?.channels?.[channel]?.messages||[])if(Date.parse(m.dateAdded)<start&&!messages.has(m.id))messages.set(m.id,m);
  channels[channel]={messages:[...messages.values()]};
 }
 const contacts=new Map();let complete=false,expected;
 for(let page=1;page<=1000;page++){
  const d=await ghl('/contacts/search',{locationId,page,pageLimit:100});
  if(!Array.isArray(d.contacts)||!Number.isInteger(d.total))throw Error('Consulta de contatos inválida.');
  if(expected!==undefined&&expected!==d.total)throw Error('A base de contatos mudou durante a consulta. Tente novamente.');
  expected=d.total;const before=contacts.size;
  for(const c of d.contacts)contacts.set(c.id,{id:c.id,name:c.contactName||c.name||[c.firstName,c.lastName].filter(Boolean).join(' ')||'Sem nome',phone:c.phone||'',dateAdded:c.dateAdded,type:c.type,assignedTo:c.assignedTo||null});
  if(contacts.size===expected){complete=true;break;}if(contacts.size===before)break;
 }
 if(!complete)throw Error('Base de contatos incompleta.');
 return {...summarizeReplies({retrievedAt:new Date().toISOString(),contacts:[...contacts.values()]},{cutoff,channels}),_history:{cutoff,channels,fullRetrievedAt:previous?(previous.fullRetrievedAt||previous.cutoff):cutoff}};
}
