export const selectedTags=['trigger_ebillions_beeplace','trigger-ebillions','ebillions_pre_evento_icp','dn solution','lucas blessy','thais ayub','thiago1k','naka1k','origem - indicação'];
export async function collectTags(ghl,locationId){
 const catalog=(await ghl('/locations/'+encodeURIComponent(locationId)+'/tags')).tags;if(!Array.isArray(catalog))throw Error('Não foi possível conferir as tags da conta.');
 const contacts=new Map();let expected,complete=false;
 for(let page=1;page<=1000;page++){const d=await ghl('/contacts/search',{locationId,page,pageLimit:100});if(!Array.isArray(d.contacts)||!Number.isInteger(d.total))throw Error('Resposta inesperada ao conferir contatos e tags.');if(expected!==undefined&&expected!==d.total)throw Error('A base mudou durante a consulta. Atualize novamente.');expected=d.total;
 for(const c of d.contacts){if(!c.id||!Array.isArray(c.tags))throw Error('Um contato veio sem informações válidas de tags.');contacts.set(c.id,{id:c.id,name:c.contactName||c.name||[c.firstName,c.lastName].filter(Boolean).join(' ')||'Não informado',phone:c.phone||'',email:c.email||'',dateAdded:c.dateAdded||null,tags:[...new Set(c.tags)].filter(t=>selectedTags.includes(t))});}if(contacts.size===expected){complete=true;break;}if(!d.contacts.length)break;}
 if(!complete)throw Error('A consulta de tags ficou incompleta; os dados anteriores foram preservados.');
 const rows=[...contacts.values()],individual=rows.filter(r=>!/\bgrupos?\b|@g\.us/i.test(r.name));return {retrievedAt:new Date().toISOString(),baseTotal:rows.length,excludedGroups:rows.length-individual.length,availableTags:selectedTags.filter(t=>catalog.some(c=>c.name===t)),rows:individual};
}
export function tagsReport(snapshot,{tag='',query=''}={}){
 const contacts=[...new Map(snapshot.rows.map(r=>[r.id,r])).values()];const matched=contacts.map(r=>({...r,tags:[...new Set(r.tags)].filter(t=>selectedTags.includes(t))})).filter(r=>r.tags.length);
 const counts=selectedTags.map(name=>({name,count:matched.filter(r=>r.tags.includes(name)).length,available:snapshot.availableTags.includes(name)}));
 const q=query.trim().toLocaleLowerCase('pt-BR');const rows=matched.filter(r=>(!tag||r.tags.includes(tag))&&(!q||[r.name,r.phone,r.email].join(' ').toLocaleLowerCase('pt-BR').includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return {counts,total:matched.length,multiple:matched.filter(r=>r.tags.length>1).length,assignments:counts.reduce((n,t)=>n+t.count,0),rows};
}
