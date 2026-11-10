export function summarizeReplies(contacts,history){
 const byContact=new Map(),seen=new Set();let inboundMessages=0,unknownContactMessages=0;
 for(const batch of Object.values(history.channels))for(const m of batch.messages){
  if(seen.has(m.id))continue;seen.add(m.id);
  if(m.direction!=='inbound'&&m.direction!=='outbound')continue;
  if(m.direction==='inbound')inboundMessages++;
  if(!m.contactId){unknownContactMessages++;continue;}
  const r=byContact.get(m.contactId)||{received:0,sent:0,firstReply:null,lastReply:null,firstSent:null,lastSent:null};
  const valid=m.dateAdded&&Number.isFinite(Date.parse(m.dateAdded));
  if(m.direction==='inbound'){r.received++;if(valid){if(!r.firstReply||m.dateAdded<r.firstReply)r.firstReply=m.dateAdded;if(!r.lastReply||m.dateAdded>r.lastReply)r.lastReply=m.dateAdded;}}
  else{r.sent++;if(valid){if(!r.firstSent||m.dateAdded<r.firstSent)r.firstSent=m.dateAdded;if(!r.lastSent||m.dateAdded>r.lastSent)r.lastSent=m.dateAdded;}}
  byContact.set(m.contactId,r);
 }
 const rows=[...new Map(contacts.contacts.map(c=>[c.id,c])).values()].filter(c=>!/\bgrupos?\b|@g\.us/i.test(c.name)).map(c=>{
 const m=byContact.get(c.id)||{received:0,sent:0,firstReply:null,lastReply:null,firstSent:null,lastSent:null};
 return {...c,...m,status:m.received?'responded':m.sent?'waiting':'untouched'};
 }).sort((a,b)=>(b.lastReply||'').localeCompare(a.lastReply||'')||a.name.localeCompare(b.name,'pt-BR'));
 return {cutoff:history.cutoff,contactsRetrievedAt:contacts.retrievedAt,totalContacts:rows.length,responded:rows.filter(r=>r.status==='responded').length,neverResponded:rows.filter(r=>r.status!=='responded').length,contactedNoReply:rows.filter(r=>r.status==='waiting').length,noExchange:rows.filter(r=>r.status==='untouched').length,inboundMessages:rows.reduce((sum,r)=>sum+r.received,0),rows};
}
