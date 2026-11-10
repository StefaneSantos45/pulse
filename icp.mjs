export function interactionOf(person,sources={}){
 if(person.firstReply)return 'responded';
 if(person.firstSent)return 'waiting';
 const cutoffs=[sources.messages,sources.approaches].map(Date.parse).filter(Number.isFinite);
 const created=Date.parse(person.dateAdded);
 return person.messageCoverage&&Number.isFinite(created)&&cutoffs.length===2&&created<=Math.min(...cutoffs)?'untouched':'unknown';
}
export function matchesInteraction(row,filter){return !filter||filter==='all'||(filter==='never'?['waiting','untouched'].includes(row.interaction):row.interaction===filter)}
export const ICP_START='2026-10-01T03:00:00.000Z';
export const criteria=[{id:'market',label:'Vende no Mercado Livre e/ou Shopee'},{id:'store',label:'Possui e-commerce próprio'},{id:'volume',label:'Mais de 3.000 NF/mês'},{id:'revenue',label:'Faturamento acima de R$ 100 mil/mês'},{id:'catalog',label:'Catálogo com produtos de recompra'},{id:'marketing',label:'Investe em marketing e tem interesse em CRM/WhatsApp'}];
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('_',' ');
export function threshold(value,limit){
 const t=norm(value).replace(/(\d)\.(?=\d{3})/g,'$1').replace(/,(\d{2})\b/g,'.$1');
 const numbers=[...t.matchAll(/\d+(?:\.\d+)?\s*(milhao|milhoes|mil|k)?/g)].map(m=>Number(m[0].replace(/[^\d.]/g,''))*(/milhao|milhoes/.test(m[0])?1e6:/mil|k/.test(m[0])?1000:1));
 if(!numbers.length)return 'unknown';
 if(/menos|abaixo|ate|</.test(t))return numbers[0]<=limit?'no':'unknown';
 if(/mais de|acima|>/.test(t))return numbers[0]>=limit?'yes':'unknown';
 if(numbers.length>1)return Math.min(...numbers)>limit?'yes':Math.max(...numbers)<=limit?'no':'unknown';
 if(t.includes('+'))return numbers[0]>limit?'yes':'unknown';
 return numbers[0]>limit?'yes':'no';
}
function automatic(person){
 const results=Object.fromEntries(criteria.map(c=>[c.id,{state:'unknown',evidence:'Não informado nos formulários consultados.',date:null}]));
 const events=person.events.filter(e=>e.type==='formulario').sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 function set(id,state,e,a){const old=results[id];const evidence=a.question+': '+a.value;if(old.date===e.date&&old.state!==state&&old.evidence!==evidence){results[id]={state:'unknown',date:e.date,evidence:old.evidence+' / '+evidence+' — conferir respostas divergentes'};}else results[id]={state,date:e.date,evidence,form:e.detail};}
 for(const e of events)for(const a of e.answers||[]){const q=norm(a.question),v=norm(a.value);if(/test lead|dummy data/.test(v))continue;
  const volume=/nfe|notas/.test(v)||(/nfe|notas/.test(q)&&!v.includes('r$'));
  const revenue=!volume&&(/faturamento/.test(q)||v.includes('r$'))&&!/investimento|planos|valor faz|suportar|volume,/.test(q);
  if(volume)set('volume',threshold(v,3000),e,a);
  if(revenue)set('revenue',threshold(v,100000),e,a);
  if(/vendas hoje|UuKBnSrcxFIsr0HUTxq2/i.test(a.question)||/apenas marketplace|marketplace e e-commerce|ainda nao vendo online/.test(v)){
   set('store',/marketplace e e-commerce/.test(v)?'yes':/apenas marketplace|ainda nao vendo online/.test(v)?'no':'unknown',e,a);
   set('market',/mercado livre|shopee/.test(v)?'yes':/ainda nao vendo online/.test(v)?'no':'unknown',e,a);
  }
 }
 return results;
}
export function icpReport(data,manual={}){
 const rows=data.rows.map(p=>{const auto=automatic(p),saved=manual[p.id];const checks=criteria.map(c=>{const override=saved?.values?.[c.id];return {...c,...auto[c.id],...(override?{state:override,evidence:saved.note,date:saved.updatedAt,manual:true}:{}),automatic:auto[c.id]};});const yes=checks.filter(c=>c.state==='yes').length,no=checks.filter(c=>c.state==='no').length;const status=no?'outside':yes===criteria.length?'confirmed':yes?'potential':'unknown';const created=Date.parse(p.dateAdded);return {id:p.id,name:p.name,phone:p.phone,email:p.email,tags:p.tags,owner:p.owner,source:p.source,dateAdded:p.dateAdded,submissions:p.events.filter(e=>e.type==='formulario').map(e=>({id:e.id,name:e.detail||'Questionário não identificado',date:e.date,answers:e.answers||[]})).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)),cohort:Number.isFinite(created)?created>=Date.parse(ICP_START)?'new':'base':'undated',checks,yes,status,firstReply:p.firstReply,interaction:interactionOf(p,data.sources),opportunities:p.opportunities,customer:p.opportunities.some(o=>o.status==='won'||o.stage==='Venda')||p.tags.some(t=>/^(cliente ativo|cliente-ativo)$/.test(norm(t))),manual:saved||null};});
 return {start:ICP_START,sources:data.sources,criteria,rows,undated:rows.filter(r=>r.cohort==='undated').length};
}
