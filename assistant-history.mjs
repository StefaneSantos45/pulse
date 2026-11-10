// Read this contact independently of the slow, whole-account export.
export async function readAssistantHistory(get,locationId,contactId){
 const cutoff=new Date().toISOString();
 const result=await get('/conversations/search?'+new URLSearchParams({locationId,contactId,limit:'100'}));
 if(!Array.isArray(result.conversations)||!Number.isInteger(result.total)||result.total>result.conversations.length)throw Error('Consulta de conversas incompleta.');
 const messages=new Map();
 for(const conversation of result.conversations){
  if(conversation.contactId!==contactId)throw Error('Conversa de outro contato.');
  let cursor;const cursors=new Set();
  for(let page=0;page<1000;page++){
   const data=await get('/conversations/'+encodeURIComponent(conversation.id)+'/messages?'+new URLSearchParams({limit:'100',type:'TYPE_SMS,TYPE_WHATSAPP',...(cursor?{lastMessageId:cursor}:{})}));
   const batch=data.messages;
   if(!Array.isArray(batch?.messages))throw Error('Histórico indisponível.');
   for(const m of batch.messages){
    if(m.contactId!==contactId)throw Error('Mensagem de outro contato.');
    if(['TYPE_SMS','TYPE_WHATSAPP','TYPE_CUSTOM_SMS','SMS','WhatsApp'].includes(m.messageType))messages.set(m.id,m);
   }
   if(!batch.nextPage)break;
   cursor=batch.lastMessageId;
   if(!cursor||cursors.has(cursor)||page===999)throw Error('Histórico incompleto.');
   cursors.add(cursor);
  }
 }
 return {cutoff,messages:[...messages.values()]};
}
