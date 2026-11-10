import {salesDay,shiftDay,validateSalesRange} from './sales-report.mjs';
export const formatAnswer=v=>v==null?'':Array.isArray(v)?v.map(formatAnswer).join(' · '):typeof v==='object'?(v.rating!=null?String(v.rating)+(v.count?' de '+v.count:''):v.value!=null?formatAnswer(v.value):Object.entries(v).map(([k,x])=>k+': '+formatAnswer(x)).join(' · ')):String(v);
const str=formatAnswer;
export function normalizeSubmission(s,type,catalog,fields,contacts){
 const o=s.others||{},a=o.lastAttributionSource||{},e=o.eventData||{},c=contacts.get(s.contactId)||{};
 const sourceId=o.facebookFormId||s.formId||s.surveyId;
 const answers={};
 for(const f of fields){const v=o[f.id]??o[f.fieldKey];if(v!=null)answers[f.name||f.id]=v;}
 for(const f of o.customFields||[])answers[fields.find(x=>x.id===f.id)?.name||f.id]=f.field_value??f.value;
 for(const f of o.facebookLeadSubmissionDetails?.field_data||[]){if(!['full_name','first_name','last_name','email','phone','phone_number'].includes(f.name)&&!Object.keys(answers).some(k=>k.toLowerCase().replaceAll(' ','_')===f.name.toLowerCase()))answers['Facebook · '+f.name.replaceAll('_',' ')]=f.values;}
 // Other user-entered fields, excluding tracking and identity metadata.
 const reserved=new Set(['locationId','name','first_name','last_name','full_name','email','phone','phone_number','customFields','eventData','lastAttributionSource','facebookLeadId','facebookFormName','facebookFormId','facebookLeadSubmissionDetails','productType','type','source','fieldsOriSequance','__submissions_other_field__','timezone','timeZone','terms_and_conditions','contact_id','formId','location_id','sessionId','Timezone','submissionId','signatureHash','ip','sessionFingerprint','funil']);
 for(const [k,v] of Object.entries(o))if(!reserved.has(k)&&!fields.some(f=>f.id===k||f.fieldKey===k)&&!k.startsWith('__')&&v!=null&&(typeof v!=='object'||Array.isArray(v)))answers[k]=v;
 return {id:type+':'+s.id,contactId:s.contactId||'',type,sourceId:type+':'+sourceId,formName:o.facebookFormName||catalog.find(x=>x.id===sourceId)?.name||'Formulário não identificado ('+sourceId+')',name:s.name||o.name||c.contactName||[c.firstName,c.lastName].filter(Boolean).join(' ')||'Não informado',phone:o.phone||o.phone_number||c.phone||'',email:s.email||o.email||c.email||'',createdAt:s.createdAt,answers:Object.fromEntries(Object.entries(answers).filter(([,v])=>v!=null&&v!=='').map(([k,v])=>[/^[a-zA-Z0-9]{20}$/.test(k)?'Campo sem título ('+k+')':k,v])),source:e.source||a.sessionSource||o.source||a.source||'',page:e.page?.url||e.url||'',referrer:e.referrer||a.referrer||'',campaign:e.campaign||a.utm_campaign||a.campaign||e.url_params?.utm_campaign||'',utmSource:e.url_params?.utm_source||a.utmSource||'',utmMedium:e.url_params?.utm_medium||a.utmMedium||'',utmContent:e.url_params?.utm_content||a.utmContent||''};
}
export async function collectForms(ghl,locationId){
 const all=[],catalog=[];
 for(const [path,type] of [['forms','Formulário'],['surveys','Pesquisa']]){
  const entries=new Map();let done=false;
  for(let page=1;page<=1000;page++){const d=await ghl('/'+path+'/?'+new URLSearchParams({locationId,limit:'50',skip:String((page-1)*50)}));for(const f of d[path]||[])entries.set(f.id,f);if(entries.size>=d.total){done=true;break;}if(!(d[path]||[]).length)break;}
  if(!done)throw Error('Não foi possível conferir a lista completa de '+path+'.');catalog.push(...[...entries.values()].map(f=>({...f,type})));
  const submissions=new Map();done=false;let expected;
  for(let page=1;page<=1000;page++){const d=await ghl('/'+path+'/submissions?'+new URLSearchParams({locationId,limit:'100',page:String(page),startAt:'2000-01-01',endAt:shiftDay(salesDay(new Date()),1)}));if(!Array.isArray(d.submissions)||!Number.isInteger(d.meta?.total))throw Error('Resposta de envios inesperada.');if(expected!==undefined&&expected!==d.meta.total)throw Error('Os envios mudaram durante a coleta. Atualize novamente.');expected=d.meta.total;for(const s of d.submissions)submissions.set(s.id,s);if(!d.meta.nextPage){done=submissions.size===expected;break;}}
  if(!done)throw Error('A coleta de envios ficou incompleta; a consulta anterior foi preservada.');all.push(...[...submissions.values()].map(s=>({s,type})));
 }
 const fields=(await ghl('/locations/'+encodeURIComponent(locationId)+'/customFields')).customFields||[];
 const contacts=new Map();let done=false;
 for(let page=1;page<=1000;page++){const d=await ghl('/contacts/search',{locationId,page,pageLimit:100});for(const c of d.contacts||[])contacts.set(c.id,c);if(contacts.size===d.total){done=true;break;}if(!d.contacts?.length)break;}
 if(!done)throw Error('Não foi possível conferir os contatos dos envios.');
 return {retrievedAt:new Date().toISOString(),coverageStart:'2000-01-01',catalog,rows:all.map(({s,type})=>normalizeSubmission(s,type,catalog,fields,contacts)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))};
}
export function formsReport(snapshot,{start='',end='',sourceId='',type='',query='',grouping='month',repeatedOnly=false}={}){
 validateSalesRange(start,end);const q=query.trim().toLocaleLowerCase('pt-BR');
 let rows=snapshot.rows.filter(r=>(!type||r.type===type)&&(!sourceId||r.sourceId===sourceId)&&(!start||r.createdAt&&salesDay(r.createdAt)>=start)&&(!end||r.createdAt&&salesDay(r.createdAt)<=end)&&(!q||[r.name,r.phone,r.email,r.formName].join(' ').toLocaleLowerCase('pt-BR').includes(q)));
 const matchedCounts=new Map();for(const r of rows)if(r.contactId)matchedCounts.set(r.contactId,(matchedCounts.get(r.contactId)||0)+1);
 if(repeatedOnly)rows=rows.filter(r=>r.contactId&&matchedCounts.get(r.contactId)>1);
 rows=rows.map(r=>({...r,submissionCount:r.contactId?matchedCounts.get(r.contactId):null}));
 const ids=new Set(rows.map(r=>r.contactId).filter(Boolean));const counts=new Map(),ranking=new Map();
 for(const r of rows){if(r.contactId)counts.set(r.contactId,(counts.get(r.contactId)||0)+1);const b=ranking.get(r.sourceId)||{id:r.sourceId,name:r.formName,type:r.type,count:0};b.count++;ranking.set(r.sourceId,b);}
 const dates=rows.filter(r=>r.createdAt&&Number.isFinite(Date.parse(r.createdAt))).map(r=>salesDay(r.createdAt)).sort();const from=start||dates[0],to=end||dates.at(-1);if(from&&to&&(Date.parse(to)-Date.parse(from))/86400000>366)grouping='month';
 const buckets=new Map();if(from&&to){for(let d=grouping==='month'?from.slice(0,7)+'-01':from;d<=to;){const key=grouping==='month'?d.slice(0,7):d;buckets.set(key,{date:key,count:0});if(grouping==='month'){const n=new Date(d+'T12:00:00Z');n.setUTCMonth(n.getUTCMonth()+1);d=n.toISOString().slice(0,10);}else d=shiftDay(d,1);}}
 for(const r of rows){if(!r.createdAt)continue;const d=salesDay(r.createdAt),key=grouping==='month'?d.slice(0,7):d;if(buckets.has(key))buckets.get(key).count++;}
 const sales=[];for(const s of snapshot.sales||[]){if(!s.contactId||!s.saleStageEnteredAt)continue;const preceding=rows.filter(r=>r.contactId===s.contactId&&Date.parse(r.createdAt)<=Date.parse(s.saleStageEnteredAt)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));if(preceding.length){const r=preceding[0];sales.push({...s,submissionId:r.id,formName:r.formName,submittedAt:r.createdAt,daysToSale:(Date.parse(s.saleStageEnteredAt)-Date.parse(r.createdAt))/86400000});}}
 return {rows,uniquePeople:ids.size,unidentified:rows.filter(r=>!r.contactId).length,repeatedPeople:[...counts.values()].filter(n=>n>1).length,ranking:[...ranking.values()].sort((a,b)=>b.count-a.count),series:[...buckets.values()],grouping,sales,convertedPeople:new Set(sales.map(s=>s.contactId)).size,salesValue:Math.round(sales.reduce((n,s)=>n+(s.amount??0),0)*100)/100,averageDays:sales.length?sales.reduce((n,s)=>n+s.daysToSale,0)/sales.length:null};
}
export function answerDistribution(rows,question){const counts=new Map();let respondents=0;for(const r of rows){const v=r.answers[question];if(v==null||v==='')continue;respondents++;for(const item of new Set((Array.isArray(v)?v:[v]).map(str)))counts.set(item,(counts.get(item)||0)+1);}return {respondents,values:[...counts].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count)};}






