import {selectedTags} from './tags-analysis.mjs';
const clean=a=>Object.fromEntries(['sessionSource','medium','source','url','referrer','campaign','utmCampaign','utmSource','utmMedium','utmContent','formId','formName','adSource'].filter(k=>typeof a?.[k]==='string'&&a[k]).map(k=>[k,a[k]]));
export const cleanOriginContact=c=>({id:c.id,source:c.source||'',tags:Array.isArray(c.tags)?c.tags:[],attributionSource:clean(c.attributionSource),lastAttributionSource:clean(c.lastAttributionSource)});
export async function collectSaleOrigins(ghl,sales){const contacts=[];const ids=[...new Set(sales.rows.map(r=>r.contactId).filter(Boolean))];for(let i=0;i<ids.length;i+=4){const batch=await Promise.all(ids.slice(i,i+4).map(async id=>{const d=await ghl('/contacts/'+encodeURIComponent(id));if(!d.contact||d.contact.id!==id)throw Error('Não foi possível conferir a origem de um contato.');return cleanOriginContact(d.contact);}));contacts.push(...batch);}return {retrievedAt:new Date().toISOString(),contacts};}
export function saleOrigin(row,contact,forms){
 const c=contact?cleanOriginContact(contact):null,a=c?.attributionSource||{},last=c?.lastAttributionSource||{};
 const source=c?.source||'',session=a.sessionSource||'',medium=a.medium||'';
 const names={'CRM UI':'Cadastro manual','Paid Social':'Anúncios em redes sociais','Social media':'Redes sociais','Direct traffic':'Acesso direto','Organic Search':'Busca orgânica','Paid Search':'Anúncios de pesquisa','Referral':'Referência de outro site','Other':'Outra origem registrada'};
 const originGroup=session?(names[session]||session):source||'Origem não identificada';
 const allTags=c?.tags||[];const originTags=allTags.filter(t=>selectedTags.includes(t)||/^origem - |^evento - /i.test(t)||['metaads','parceria','talks-icomm'].includes(t));
 const previousForms=(forms?.rows||[]).filter(f=>f.contactId===row.contactId&&f.createdAt&&row.saleStageEnteredAt&&Number.isFinite(Date.parse(f.createdAt))&&Date.parse(f.createdAt)<=Date.parse(row.saleStageEnteredAt)).sort((x,y)=>Date.parse(y.createdAt)-Date.parse(x.createdAt)).map(f=>({id:f.id,name:f.formName,date:f.createdAt,source:f.source,campaign:f.campaign}));
 return {originGroup,originAvailable:!!c,origin:{source,session,medium,first:a,last,originTags,allTags,previousForms}};
}
export function decorateSales(sales,origins,forms){const contacts=new Map(origins.contacts.map(c=>[c.id,c]));return {...sales,originsRetrievedAt:origins.retrievedAt,originFormsRetrievedAt:forms?.retrievedAt||null,rows:sales.rows.map(r=>({...r,...saleOrigin(r,contacts.get(r.contactId),forms)}))};}
export function originSummary(rows,mode='registered'){
 const groups=new Map();for(const r of rows){const names=mode==='tags'?(r.origin?.originTags?.length?r.origin.originTags:['Sem tag de origem selecionada']):mode==='forms'?(r.origin?.previousForms?.length?[...new Set(r.origin.previousForms.map(f=>f.name))]:['Sem formulário anterior localizado']):[r.originGroup||'Origem não identificada'];for(const name of new Set(names)){const g=groups.get(name)||{name,count:0,value:0};g.count++;g.value+=r.amount??0;groups.set(name,g);}}
 return [...groups.values()].map(g=>({...g,value:Math.round(g.value*100)/100})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'pt-BR'));
}
export function matchesSaleOrigin(row,filter=''){
 if(!filter)return true;
 if(filter.startsWith('tag:')){const name=filter.slice(4);return name==='Sem tag de origem selecionada'?!row.origin?.originTags?.length:row.origin?.originTags?.includes(name)||false;}
 if(filter.startsWith('form:')){const name=filter.slice(5);return name==='Sem formulário anterior localizado'?!row.origin?.previousForms?.length:row.origin?.previousForms?.some(f=>f.name===name)||false;}
 return row.originGroup===filter;
}
