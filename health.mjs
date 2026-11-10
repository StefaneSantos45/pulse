import {monthlyGoal} from './business-goals.mjs';
import {salesDay,shiftDay} from './sales-report.mjs';
import {salesCycle} from './sales.mjs';
import {strategyReport} from './strategies.mjs';
const valid=d=>d&&Number.isFinite(Date.parse(d));
const unique=(rows,key)=>[...new Map(rows.map(r=>[r[key],r])).values()];
const variation=(current,previous)=>({current,previous,change:previous?(current-previous)/previous*100:null,direction:current>previous?'up':current<previous?'down':current===0?'empty':'flat'});
export function healthReport(payload,{days=30,now=new Date().toISOString()}={}){
 days=Number(days);if(![7,30,90].includes(days))throw Error('Selecione 7, 30 ou 90 dias.');
 const {acquisition,replies,forms,sales}=payload;
 const timestamps={acquisition:acquisition.retrievedAt,replies:replies.cutoff,forms:forms.retrievedAt,sales:sales.retrievedAt};if(Object.values(timestamps).some(d=>!valid(d)))throw Error('Uma consulta não tem data válida para a análise de saúde.');
 const oldest=new Date(Math.min(...Object.values(timestamps).map(Date.parse),Date.parse(now))).toISOString(),end=shiftDay(salesDay(oldest),-1),start=shiftDay(end,1-days),previousEnd=shiftDay(start,-1),previousStart=shiftDay(start,-days);
 const dateCache=new Map();const localDay=d=>{if(!dateCache.has(d))dateCache.set(d,valid(d)?salesDay(d):null);return dateCache.get(d);};
 const within=(d,a,b)=>{const key=localDay(d);return key!==null&&key>=a&&key<=b;};
 const contacts=unique(acquisition.contacts,'id'),submissions=unique(forms.rows,'id'),opportunities=unique(sales.rows,'id');
 const countContacts=(a,b)=>contacts.filter(r=>within(r.dateAdded,a,b));
 const formRows=(a,b)=>submissions.filter(r=>within(r.createdAt,a,b));
 const saleRows=(a,b)=>opportunities.filter(r=>within(r.saleStageEnteredAt,a,b));
 const currentContacts=countContacts(start,end),priorContacts=countContacts(previousStart,previousEnd),currentForms=formRows(start,end),priorForms=formRows(previousStart,previousEnd),currentSales=saleRows(start,end),priorSales=saleRows(previousStart,previousEnd);
 const people=rows=>new Set(rows.map(r=>r.contactId).filter(Boolean)).size;
 const sum=rows=>Math.round(rows.reduce((n,r)=>n+(typeof r.amount==='number'?r.amount:0),0)*100)/100;
 const acquisitionMetric=variation(currentContacts.length,priorContacts.length),formsMetric=variation(people(currentForms),people(priorForms)),salesMetric=variation(currentSales.length,priorSales.length),valueMetric=variation(sum(currentSales),sum(priorSales));
 const messageMap=new Map(replies.rows.map(r=>[r.id,r])),cohort=currentContacts.map(c=>messageMap.get(c.id)).filter(r=>r&&!/\bgrupos?\b|@g\.us/i.test(r.name||''));
 const responded=cohort.filter(r=>r.received>0).length,waiting=cohort.filter(r=>!r.received&&r.sent>0).length,untouched=cohort.filter(r=>!r.received&&!r.sent).length;
 const currentIds=new Set(currentContacts.map(r=>r.id)),salesInCohort=new Set(opportunities.filter(r=>currentIds.has(r.contactId)).map(r=>r.contactId)).size;
 const saleCycle=salesCycle(currentSales),priorCycle=salesCycle(priorSales);
 const series=[];for(let d=start;d<=end;d=shiftDay(d,1))series.push({date:d,leads:contacts.filter(r=>within(r.dateAdded,d,d)).length,forms:people(submissions.filter(r=>within(r.createdAt,d,d))),sales:opportunities.filter(r=>within(r.saleStageEnteredAt,d,d)).length});
 const strategies=strategyReport(payload,{start,end});
 const signals=[{key:'acquisition',name:'Entrada de leads',...acquisitionMetric,explanation:'Cadastros criados no período. Confira campanhas e importações antes de atribuir a mudança à qualidade da aquisição.',link:'#overview'},{key:'forms',name:'Pessoas com formulário',...formsMetric,explanation:'Pessoas únicas que preencheram formulário ou pesquisa. Pode incluir contatos antigos; reenvios não duplicam pessoas no período.',link:'#forms'},{key:'sales',name:'Entradas na coluna Venda',...salesMetric,explanation:'Última entrada em Venda das oportunidades que ainda estão nessa coluna. Não reconstrói negócios que saíram dela.',link:'#opportunities'},{key:'value',name:'Valor registrado em Venda',...valueMetric,explanation:'Soma dos valores das oportunidades com entrada no período. Não confirma recebimento, receita contábil ou lucro.',link:'#opportunities'}];
 return {goal:monthlyGoal(sales,now),days,start,end,previousStart,previousEnd,analyzedAt:now,sources:Object.entries(timestamps).map(([key,date])=>({key,date,ageDays:Math.max(0,(Date.parse(now)-Date.parse(date))/86400000)})),oldestSource:oldest,signals,declines:signals.filter(s=>s.direction==='down').length,increases:signals.filter(s=>s.direction==='up').length,series,forms:{submissions:currentForms.length,people:people(currentForms),unidentified:currentForms.filter(r=>!r.contactId).length},response:{cohort:cohort.length,excluded:currentContacts.length-cohort.length,responded,waiting,untouched,rate:cohort.length?responded/cohort.length*100:null},saleCycle,priorCycle,salesInCohort,ticket:{current:currentSales.filter(r=>typeof r.amount==='number').length?sum(currentSales)/currentSales.filter(r=>typeof r.amount==='number').length:null,previous:priorSales.filter(r=>typeof r.amount==='number').length?sum(priorSales)/priorSales.filter(r=>typeof r.amount==='number').length:null},salesWithMissingValue:currentSales.filter(r=>typeof r.amount!=='number').length,quality:{invalidContactDates:contacts.filter(r=>!valid(r.dateAdded)).length,invalidFormDates:submissions.filter(r=>!valid(r.createdAt)).length,invalidSaleDates:opportunities.filter(r=>!valid(r.saleStageEnteredAt)).length},priorities:strategies.strategies.slice(0,4).map(({id,title,count,action})=>({id,title,count,action})),notComparable:strategies.notComparable};
}



