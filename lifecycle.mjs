import {formatAnswer} from './forms.mjs';
import {pipelineId} from './sales.mjs';
export async function collectLifecycle(ghl,locationId){
 const catalog=await ghl('/opportunities/pipelines?'+new URLSearchParams({locationId}));const pipeline=catalog.pipelines?.find(p=>p.id===pipelineId);if(!pipeline)throw Error('Pipeline Vendas não encontrada.');
 const contacts=new Map();let complete=false;
 for(let page=1;page<=1000;page++){const d=await ghl('/contacts/search',{locationId,page,pageLimit:100});const before=contacts.size;for(const c of d.contacts||[])contacts.set(c.id,{id:c.id,name:c.contactName||c.name||[c.firstName,c.lastName].filter(Boolean).join(' ')||'Sem nome',phone:c.phone||'',email:c.email||'',dateAdded:c.dateAdded,source:c.source||'Não informada',assignedTo:c.assignedTo||'',tags:c.tags||[]});if(contacts.size===d.total){complete=true;break;}if(before===contacts.size)break;}if(!complete)throw Error('Base de contatos incompleta; consulta anterior preservada.');
 const opps=new Map();let after,afterId,expected;complete=false;
 for(let page=1;page<=1000;page++){const d=await ghl('/opportunities/search?'+new URLSearchParams({location_id:locationId,pipeline_id:pipelineId,status:'all',limit:'100',...(after?{startAfter:String(after),startAfterId:afterId}:{})}));if(!Array.isArray(d.opportunities)||!Number.isInteger(d.meta?.total))throw Error('Resposta inesperada de oportunidades.');if(expected!==undefined&&expected!==d.meta.total)throw Error('Oportunidades mudaram durante a coleta. Tente novamente.');expected=d.meta.total;const before=opps.size;for(const o of d.opportunities){if(o.pipelineId!==pipelineId)throw Error('Pipeline divergente.');opps.set(o.id,{id:o.id,contactId:o.contactId,name:o.name,stageId:o.pipelineStageId,stage:pipeline.stages?.find(s=>s.id===o.pipelineStageId)?.name||'Etapa não identificada',status:o.status,amount:typeof o.monetaryValue==='number'?o.monetaryValue:null,createdAt:o.createdAt||null,stageAt:o.lastStageChangeAt||null});}if(opps.size===expected){complete=true;break;}if(before===opps.size||!d.meta.startAfterId)break;after=d.meta.startAfter;afterId=d.meta.startAfterId;}if(!complete)throw Error('Oportunidades incompletas; consulta anterior preservada.');
 let users=[];try{users=(await ghl('/users/?'+new URLSearchParams({locationId}))).users||[];}catch{}
 return {retrievedAt:new Date().toISOString(),contacts:[...contacts.values()].map(c=>({...c,owner:users.find(u=>u.id===c.assignedTo)?.name||c.assignedTo||'Sem responsável'})),opportunities:[...opps.values()],pipeline:pipeline.name};
}
const ms=d=>Date.parse(d);const valid=d=>Number.isFinite(ms(d));
export const elapsed=(a,b)=>valid(a)&&valid(b)&&ms(b)>=ms(a)?(ms(b)-ms(a))/86400000:null;
export function lifecycleReport({base,forms,replies,investigation}){
 const index=(rows,key)=>{const map=new Map();for(const r of rows||[]){const k=r[key];if(!map.has(k))map.set(k,[]);map.get(k).push(r)}return map};
 const fi=index(forms.rows,'contactId'),oi=index(base.opportunities,'contactId'),ri=new Map(replies.rows.map(r=>[r.id,r])),ii=new Map(investigation.rows.map(r=>[r.id,r]));let excludedGroups=0;
 const rows=[];for(const c of base.contacts){if(/\bgrupos?\b|@g\.us/i.test(c.name+' '+c.phone)){excludedGroups++;continue;}
 const r=ri.get(c.id),i=ii.get(c.id),opportunities=oi.get(c.id)||[],submissions=fi.get(c.id)||[];const events=[];
 const add=(id,date,title,detail,type,extra={})=>{if(valid(date))events.push({id,date,title,detail:detail||'',type,...extra})};
 add('created',c.dateAdded,'Cadastro do lead','Data de criação registrada no CRM','cadastro');
 for(const f of submissions)add('form:'+f.id,f.createdAt,'Formulário / pesquisa enviado',f.formName,'formulario',{answers:Object.entries(f.answers||{}).map(([question,value])=>({question,value:formatAnswer(value)})).filter(a=>a.value.trim()!=='')});
 const firstSent=i?.firstAt||r?.firstSent;const firstReply=[r?.firstReply,i?.firstReply].filter(valid).sort((a,b)=>ms(a)-ms(b))[0]||null;
 add('firstSent',firstSent,'Primeira mensagem enviada',i?.text||'Primeiro envio disponível no histórico WhatsApp / SMS','mensagem');
 add('firstReply',firstReply,'Primeira mensagem recebida','Pode ter ocorrido antes da abordagem da equipe.','resposta');
 if(r?.lastSent&&r.lastSent!==firstSent)add('lastSent',r.lastSent,'Último envio no resumo de mensagens','Resumo consultado em '+new Date(replies.cutoff).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),'mensagem');
 if(r?.lastReply&&r.lastReply!==firstReply)add('lastReply',r.lastReply,'Última resposta no resumo de mensagens','Última resposta disponível nessa consulta; não representa ausência de atividade posterior.','resposta');
 for(const o of opportunities){add('opp:'+o.id,o.createdAt,'Oportunidade criada',o.name+' · Pipeline Vendas','oportunidade');add('stage:'+o.id,o.stageAt,'Última entrada na etapa '+o.stage,o.name+' · Não é o histórico de todas as movimentações',o.stageId==='247566a2-eb97-4fe3-9b90-32bfc68f6a40'?'venda':'etapa');}
 events.sort((a,b)=>ms(a.date)-ms(b.date)||a.id.localeCompare(b.id));
 const sales=opportunities.filter(o=>o.stageId==='247566a2-eb97-4fe3-9b90-32bfc68f6a40');
 const coverage=r||i;const state=sales.length?'Na coluna Venda':opportunities.some(o=>o.status==='open')?'Oportunidade aberta':opportunities.length?'Oportunidade encerrada':firstReply?'Respondeu · sem oportunidade':firstSent?'Enviado · sem resposta registrada':coverage?'Sem troca registrada':'Cobertura de mensagens indisponível';
 const firstSale=sales.map(o=>o.stageAt).filter(valid).sort((a,b)=>ms(a)-ms(b))[0];
 rows.push({...c,state,messageCoverage:Boolean(coverage),events,opportunities,forms:submissions.length,firstSent,firstReply,firstSale:firstSale||null,daysToContact:elapsed(c.dateAdded,firstSent),daysToSale:elapsed(c.dateAdded,firstSale),lastEvent:events.at(-1)?.date||null,attempts:i?.attempts??null});
 }
 return {rows,excludedGroups,retrievedAt:base.retrievedAt,sources:{contactsAndOpportunities:base.retrievedAt,forms:forms.retrievedAt,messages:replies.cutoff,approaches:investigation.cutoff},unmatchedOpportunities:base.opportunities.filter(o=>!base.contacts.some(c=>c.id===o.contactId)).length};
}
