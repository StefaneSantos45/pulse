export function salesCycle(rows){
 const durations=rows.map(r=>{const start=Date.parse(r.leadCreatedAt),end=Date.parse(r.saleStageEnteredAt);return Number.isFinite(start)&&Number.isFinite(end)&&end>=start?(end-start)/86400000:null;}).filter(d=>d!==null);
 return {averageDaysToSale:durations.length?durations.reduce((sum,d)=>sum+d,0)/durations.length:null,cycleSampleSize:durations.length,cycleExcludedCount:rows.length-durations.length};
}
export const pipelineId='uc5n6oHtO72C1eZdDGgj';
export const stageId='247566a2-eb97-4fe3-9b90-32bfc68f6a40';
export function shapeSales(opportunities,contacts,retrievedAt=new Date().toISOString()){
 const contactMap=new Map(contacts.map(c=>[c.id,c]));const seen=new Map();
 for(const o of opportunities){if(o.pipelineId!==pipelineId||o.pipelineStageId!==stageId)throw Error('A consulta retornou uma oportunidade fora da coluna Venda.');seen.set(o.id,o);}
 const rows=[...seen.values()].map(o=>({id:o.id,contactId:o.contactId,name:o.contact?.name||contactMap.get(o.contactId)?.name||o.name||'Sem nome',phone:o.contact?.phone||contactMap.get(o.contactId)?.phone||'',opportunityName:o.name,amount:typeof o.monetaryValue==='number'?o.monetaryValue:null,leadCreatedAt:contactMap.get(o.contactId)?.dateAdded||null,opportunityCreatedAt:o.createdAt||null,saleStageEnteredAt:o.lastStageChangeAt||null,status:o.status})).sort((a,b)=>(b.saleStageEnteredAt||'').localeCompare(a.saleStageEnteredAt||'')||a.name.localeCompare(b.name,'pt-BR'));
 return {...salesCycle(rows),pipeline:'Vendas',stage:'Venda',retrievedAt,opportunityCount:rows.length,contactCount:new Set(rows.map(r=>r.contactId)).size,totalValue:Math.round(rows.reduce((s,r)=>s+(r.amount??0),0)*100)/100,missingValues:rows.filter(r=>r.amount===null).length,missingLeadDates:rows.filter(r=>!r.leadCreatedAt).length,rows};
}
export async function collectSales(ghl,locationId,knownContacts=[]){
 const opportunities=new Map();let expected,after,afterId;
 for(let page=1;page<=100;page++){
 const q=new URLSearchParams({location_id:locationId,pipeline_id:pipelineId,pipeline_stage_id:stageId,status:'all',limit:'100',...(after?{startAfter:String(after),startAfterId:afterId}:{})});
 const data=await ghl('/opportunities/search?'+q);
 if(!Array.isArray(data.opportunities)||!Number.isInteger(data.meta?.total))throw Error('Resposta inesperada ao consultar oportunidades.');
 if(expected!==undefined&&data.meta.total!==expected)throw Error('A coluna mudou durante a consulta. Atualize novamente.');expected=data.meta.total;
 const before=opportunities.size;data.opportunities.forEach(o=>opportunities.set(o.id,o));if(opportunities.size===expected)break;
 if(opportunities.size===before||!data.meta.startAfterId)throw Error('Não foi possível carregar a coluna completa.');after=data.meta.startAfter;afterId=data.meta.startAfterId;
 }
 if(opportunities.size!==expected)throw Error('Não foi possível carregar a coluna completa.');
 const contacts=new Map(knownContacts.map(c=>[c.id,c]));
 for(const id of new Set([...opportunities.values()].map(o=>o.contactId))){if(contacts.get(id)?.dateAdded)continue;try{const d=await ghl('/contacts/'+encodeURIComponent(id));if(d.contact)contacts.set(id,d.contact);}catch{}}
 return shapeSales([...opportunities.values()],[...contacts.values()]);
}
