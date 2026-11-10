import {salesDay} from './sales-report.mjs';
export function countFormLeads(rows,start,end){
 const ids=new Set();let submissions=0;
 for(const r of rows){if(r.type!=='Formulário'||!r.createdAt||!Number.isFinite(Date.parse(r.createdAt)))continue;const d=salesDay(r.createdAt);if(d<start||d>end)continue;submissions++;if(r.contactId)ids.add(r.contactId);}
 return {total:ids.size,submissions};
}
