import {salesCycle} from './sales.mjs';
export const salesDay=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
export const shiftDay=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function validateSalesRange(start='',end=''){
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if((start&&!valid(start))||(end&&!valid(end))||(start&&end&&start>end))throw Error('Informe um intervalo de datas válido.');
 if(start&&end&&(Date.parse(end)-Date.parse(start))/86400000>3660)throw Error('Selecione um intervalo de até 10 anos.');
}
export function filterSalesRows(rows,{start='',end='',query=''}={}){
 validateSalesRange(start,end);const q=String(query).trim().toLocaleLowerCase('pt-BR');
 return rows.filter(r=>{if(start||end){if(!r.saleStageEnteredAt||!Number.isFinite(Date.parse(r.saleStageEnteredAt)))return false;const d=salesDay(r.saleStageEnteredAt);if((start&&d<start)||(end&&d>end))return false;}return (r.name+' '+r.phone+' '+r.opportunityName).toLocaleLowerCase('pt-BR').includes(q);});
}
export function salesReport(snapshot,options={}){
 const rows=filterSalesRows(snapshot.rows,options),dated=rows.filter(r=>r.saleStageEnteredAt&&Number.isFinite(Date.parse(r.saleStageEnteredAt)));
 const days=dated.map(r=>salesDay(r.saleStageEnteredAt)).sort();const start=options.start||days[0],end=options.end||days.at(-1);
 const span=start&&end?(Date.parse(end)-Date.parse(start))/86400000+1:0;
 const grouping=options.grouping==='month'||span>366?'month':'day';const buckets=new Map();
 if(start&&end){if(grouping==='day'){for(let d=start;d<=end;d=shiftDay(d,1))buckets.set(d,{date:d,count:0,value:0});}else{for(let d=start.slice(0,7)+'-01';d.slice(0,7)<=end.slice(0,7);){buckets.set(d.slice(0,7),{date:d.slice(0,7),count:0,value:0});const n=new Date(d+'T12:00:00Z');n.setUTCMonth(n.getUTCMonth()+1);d=n.toISOString().slice(0,10);}}}
 for(const r of dated){const d=salesDay(r.saleStageEnteredAt),key=grouping==='month'?d.slice(0,7):d;const b=buckets.get(key);if(b){b.count++;b.value+=(r.amount??0);}}
 return {...snapshot,...salesCycle(rows),rows,contactCount:new Set(rows.map(r=>r.contactId)).size,opportunityCount:rows.length,totalValue:Math.round(rows.reduce((s,r)=>s+(r.amount??0),0)*100)/100,grouping,series:[...buckets.values()].map(b=>({...b,value:Math.round(b.value*100)/100})),chartStart:start,chartEnd:end,missingStageDates:rows.length-dated.length};
}
