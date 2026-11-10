import {icpReport,criteria as icpCriteria} from './icp.mjs';
import {assistantDetail} from './sales-assistant.mjs';
import {readAssistantHistory} from './assistant-history.mjs';
import {collectInvestigation} from './investigation-sync.mjs';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {createSyncCoordinator} from './sync-coordinator.mjs';
import {collectReplies} from './replies-sync.mjs';
import {filterReplyRows} from './reply-filters.mjs';
import {collectLifecycle,lifecycleReport} from './lifecycle.mjs';
import {collectSaleOrigins,decorateSales,matchesSaleOrigin} from './sales-origins.mjs';
import {healthReport} from './health.mjs';
import {collectTags} from './tags-analysis.mjs';
import {strategyReport} from './strategies.mjs';
import {filterSalesRows} from './sales-report.mjs';
import {collectForms} from './forms.mjs';
import express from 'express';
import {collectSales,salesCycle} from './sales.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aggregate, day, shift, validateRange } from './metrics.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(root, '.env')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const app = express(); const port = Number(process.env.PORT || 4317);
const locationId = process.env.GHL_LOCATION_ID;
let cached; let pending;
try { const saved = JSON.parse(await readFile(path.join(root,'.cache/snapshot.json'),'utf8')); if (saved.locationId === locationId) cached = saved; } catch {}
async function ghlOnce(route, body) {
  if (!process.env.GHL_TOKEN || !locationId) throw new Error('Configure o token e a subconta no arquivo .env do servidor.');
  const res = await fetch('https://services.leadconnectorhq.com' + route, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${process.env.GHL_TOKEN}`, Version: '2021-07-28', 'Content-Type':'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'O GoHighLevel recusou o acesso. Confira o token e a permissão de leitura de contatos.' : `GoHighLevel indisponível (HTTP ${res.status}). Tente novamente.`);
  return res.json();
}
async function ghl(route,body){let error;for(let attempt=0;attempt<3;attempt++){try{return await ghlOnce(route,body);}catch(e){error=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}}throw error;}
async function atomicCache(name,data){const dest=path.join(root,'.cache',name);await writeFile(dest+'.tmp',JSON.stringify(data));const {rename}=await import('node:fs/promises');await rename(dest+'.tmp',dest);}
async function synchronize() {
  if (pending) return pending;
  pending = (async () => {
    const info = await ghl('/locations/' + encodeURIComponent(locationId));
    const contacts = new Map(); let expected; let finished = false;
    for (let page = 1; page <= 100; page++) {
      const data = await ghl('/contacts/search', { locationId, page, pageLimit: 100 });
      if (!Array.isArray(data.contacts) || !Number.isInteger(data.total)) throw new Error('A API retornou dados inesperados.');
      if (expected !== undefined && expected !== data.total) throw new Error('A base mudou durante a consulta. Atualize novamente para garantir a contagem completa.');
      expected = data.total;
      for (const c of data.contacts) contacts.set(c.id, { id:c.id, dateAdded:c.dateAdded, name:c.contactName||c.name||[c.firstName,c.lastName].filter(Boolean).join(' ')||'Sem nome', phone:c.phone||'', email:c.email||'', source:c.source||'Não informada' });
      if (contacts.size === expected) { finished = true; break; }
      if (!data.contacts.length) break;
    }
    if (!finished) throw new Error('Não foi possível obter a base completa. O relatório anterior foi preservado.');
    const next = { detailsVersion:1, locationId, account:info.location.name, retrievedAt:new Date().toISOString(), contacts:[...contacts.values()] };
    await mkdir(path.join(root,'.cache'), { recursive:true });
    await atomicCache('snapshot.json',next);
    cached = next; return next;
  })().finally(() => { pending = undefined; });
  return pending;
}

function readIcpManual(){try{return JSON.parse(readFileSync(path.join(root,'.cache/icp-manual.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
app.get('/api/icp',async(req,res)=>{try{res.set('Cache-Control','no-store').json(icpReport(await lifecyclePayload(),readIcpManual()));}catch(e){res.status(503).json({error:'Não foi possível carregar a qualificação ICP. Tente novamente.'});}});
app.put('/api/icp/:id',express.json({limit:'20kb'}),async(req,res)=>{try{
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(req.params.id))return res.status(400).json({error:'Contato inválido.'});
 const {values,note}=req.body||{};if(!values||typeof values!=='object'||Array.isArray(values)||typeof note!=='string'||note.length>2000||Object.entries(values).some(([k,v])=>!icpCriteria.some(c=>c.id===k)||!['yes','no','unknown'].includes(v))||Object.keys(values).length&&!note.trim())return res.status(400).json({error:'Informe uma observação para justificar a qualificação (até 2.000 caracteres).'});
 const data=await lifecyclePayload();if(!data.rows.some(p=>p.id===req.params.id))return res.status(404).json({error:'Contato não encontrado.'});
 const all=readIcpManual();all[req.params.id]={values,note:note.trim(),updatedAt:new Date().toISOString()};writeFileSync(path.join(root,'.cache/icp-manual.json.tmp'),JSON.stringify(all));renameSync(path.join(root,'.cache/icp-manual.json.tmp'),path.join(root,'.cache/icp-manual.json'));res.json(all[req.params.id]);
 }catch{res.status(503).json({error:'Não foi possível salvar a qualificação.'});}});

app.use('/api', (req,res,next) => {
  res.set('Cache-Control','no-store');
  if (!['localhost','127.0.0.1'].includes(req.hostname)) return res.status(403).json({error:'Acesso local obrigatório.'});
  if (req.headers.origin && ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin)) return res.status(403).json({error:'Origem não permitida.'});
  next();
});
app.get('/api/leads', async (req,res) => {
  const end = req.query.end || shift(day(new Date()),-1), start = req.query.start || shift(end,-29);
  try { validateRange(start,end); } catch(e) { return res.status(400).json({error:e.message}); }
  try { const snapshot = cached?.detailsVersion===1 ? cached : await synchronize(); res.json(aggregate(snapshot,start,end)); }
  catch(e) { res.status(502).json({error:e.message}); }
});
app.get('/api/leads.csv', async (req,res) => {
  try {
    const {start,end}=req.query; validateRange(start,end);
    const data=aggregate(cached || await synchronize(),start,end);
    const csv='\uFEFFdata;contatos_criados;data_periodo_anterior;contatos_periodo_anterior\r\n'+data.current.map((row,i)=>[row.date,row.count,data.previous[i].date,data.previous[i].count].join(';')).join('\r\n');
    res.attachment('leads-'+start+'-'+end+'.csv').type('text/csv; charset=utf-8').send(csv);
  } catch(e) { res.status(400).json({error:e.message}); }
});
app.post('/api/sync', async (req,res) => {
  try { const snapshot = await synchronize(); res.json({retrievedAt:snapshot.retrievedAt}); }
  catch(e) { res.status(502).json({error:e.message}); }
});
async function replyData(){const data=JSON.parse(await readFile(path.join(root,'.cache/replies.json'),'utf8'));let catalog;try{catalog=JSON.parse(await readFile(path.join(root,'.cache/lifecycle.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}const contacts=new Map((catalog?.contacts||[]).map(c=>[c.id,c]));return {...data,tagsRetrievedAt:catalog?.retrievedAt||null,rows:data.rows.map(r=>({...r,tags:contacts.get(r.id)?.tags||[],tagsAvailable:contacts.has(r.id)}))};}
let messageSyncQueue=Promise.resolve();
function withMessageSync(run){const next=messageSyncQueue.then(run);messageSyncQueue=next.catch(()=>{});return next;}
let pendingReplies;
app.post('/api/replies/sync',async(req,res)=>{try{
 if(!pendingReplies)pendingReplies=withMessageSync(async()=>{let previous;try{previous=JSON.parse(await readFile(path.join(root,'.cache/replies-history.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}const {_history,...d}=await collectReplies(ghl,locationId,{previous});await writeFile(path.join(root,'.cache/replies-history.json.tmp'),JSON.stringify(_history));await writeFile(path.join(root,'.cache/replies.json.tmp'),JSON.stringify(d));const {rename}=await import('node:fs/promises');await rename(path.join(root,'.cache/replies-history.json.tmp'),path.join(root,'.cache/replies-history.json'));await rename(path.join(root,'.cache/replies.json.tmp'),path.join(root,'.cache/replies.json'));}).finally(()=>{pendingReplies=undefined});
 await pendingReplies;res.json(await replyData());
}catch(e){res.status(502).json({error:e.message});}});
app.get('/api/replies',async(req,res)=>{try{res.json(await replyData());}catch{res.status(503).json({error:'A consulta do histórico ainda não está pronta.'});}});
app.get('/api/replies.csv',async(req,res)=>{try{
 const data=await replyData();const status=String(req.query.status||'all'),query=String(req.query.query||'').trim().toLocaleLowerCase('pt-BR');
 const rows=filterReplyRows(data.rows,{status,query,start:String(req.query.start||''),end:String(req.query.end||''),dateField:String(req.query.dateField||'dateAdded'),tag:String(req.query.tag||'')});
 const cell=value=>{let s=String(value??'');if(/^[=+@\-\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const label={responded:'Respondeu',waiting:'Enviado, sem resposta',untouched:'Sem troca registrada'};
 const csv='\uFEFFnome;telefone;situacao;mensagens_recebidas;mensagens_enviadas;primeira_resposta_UTC;ultima_resposta_UTC;ultimo_envio_UTC;contato_id;tags;cadastro_UTC;primeiro_envio_UTC\r\n'+rows.map(r=>[r.name,r.phone,label[r.status],r.received,r.sent,r.firstReply,r.lastReply,r.lastSent,r.id,r.tagsAvailable?r.tags.join(' | '):'Tags indisponíveis',r.dateAdded,r.firstSent].map(cell).join(';')).join('\r\n');
 res.attachment('respostas-whatsapp-sms.csv').type('text/csv; charset=utf-8').send(csv);
}catch{res.status(503).json({error:'A consulta do histórico ainda não está pronta.'});}});
let pendingSales;
async function refreshSales(){
 if(pendingSales)return pendingSales;
 pendingSales=(async()=>{const data=await collectSales(ghl,locationId,cached?.contacts||[]);await mkdir(path.join(root,'.cache'),{recursive:true});await atomicCache('sales.json',data);return data;})().finally(()=>{pendingSales=undefined;});return pendingSales;
}
async function readSales(){try{const data=JSON.parse(await readFile(path.join(root,'.cache/sales.json'),'utf8'));return {...data,...salesCycle(data.rows)};}catch(e){if(e.code==='ENOENT')return refreshSales();throw e;}}
let pendingOrigins;
async function salesOriginPayload(sales,refresh=false){
 let origins;try{origins=JSON.parse(await readFile(path.join(root,'.cache/sales-origins.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(refresh||!origins||sales.rows.some(r=>!origins.contacts.some(c=>c.id===r.contactId))){if(!pendingOrigins)pendingOrigins=(async()=>{const d=await collectSaleOrigins(ghl,sales);await atomicCache('sales-origins.json',d);return d;})().finally(()=>{pendingOrigins=undefined;});origins=await pendingOrigins;}
 return decorateSales(sales,origins,await readForms());
}
app.get('/api/sales',async(req,res)=>{try{res.json(await salesOriginPayload(await readSales()));}catch(e){res.status(502).json({error:e.message});}});
app.post('/api/sales/sync',async(req,res)=>{try{res.json(await salesOriginPayload(await refreshSales(),true));}catch(e){res.status(502).json({error:e.message});}});
app.get('/api/sales.csv',async(req,res)=>{try{
 const data=await salesOriginPayload(await readSales()),query=String(req.query.query||'').trim().toLocaleLowerCase('pt-BR');const rows=filterSalesRows(data.rows.filter(r=>matchesSaleOrigin(r,String(req.query.origin||''))),{query,start:req.query.start||'',end:req.query.end||''});
 const cell=value=>{let s=String(value??'');if(/^[=+@\-\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const csv='\uFEFFnome;telefone;valor_CRM;cadastro_lead_UTC;criacao_oportunidade_UTC;ultima_entrada_Venda_UTC;nome_oportunidade;oportunidade_id;contato_id;origem_cadastro;fonte_CRM;tags_origem_atuais;formularios_anteriores;campanha_primeira_atribuicao\r\n'+rows.map(r=>[r.name,r.phone,r.amount===null?'':r.amount.toFixed(2).replace('.',','),r.leadCreatedAt,r.opportunityCreatedAt,r.saleStageEnteredAt,r.opportunityName,r.id,r.contactId,r.originGroup,r.origin.source,r.origin.originTags.join(' | '),r.origin.previousForms.map(f=>f.name).join(' | '),r.origin.first.campaign||r.origin.first.utmCampaign||''].map(cell).join(';')).join('\r\n');
 res.attachment('oportunidades-vendas.csv').type('text/csv; charset=utf-8').send(csv);
 }catch(e){res.status(502).json({error:e.message});}
});
let pendingForms;
async function refreshForms(){if(pendingForms)return pendingForms;pendingForms=(async()=>{const data=await collectForms(ghl,locationId);await mkdir(path.join(root,'.cache'),{recursive:true});await atomicCache('forms.json',data);return data;})().finally(()=>{pendingForms=undefined;});return pendingForms;}
async function readForms(){try{return JSON.parse(await readFile(path.join(root,'.cache/forms.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return refreshForms();throw e;}}
async function formsPayload(refresh=false){const data=await(refresh?refreshForms():readForms());try{const sales=await readSales();return {...data,sales:sales.rows,salesRetrievedAt:sales.retrievedAt};}catch{return {...data,sales:[],salesError:'O cruzamento de vendas está indisponível.'};}}
app.get('/api/forms',async(req,res)=>{try{res.json(await formsPayload());}catch(e){res.status(502).json({error:e.message});}});
app.post('/api/forms/sync',async(req,res)=>{try{res.json(await formsPayload(true));}catch(e){res.status(502).json({error:e.message});}});
app.get('/api/strategies',async(req,res)=>{try{const [acquisition,replies,forms,sales]=await Promise.all([cached||synchronize(),replyData(),readForms(),readSales()]);res.json(strategyReport({acquisition,replies,forms,sales},{start:String(req.query.start||''),end:String(req.query.end||'')}));}catch(e){res.status(502).json({error:e.message});}});
let pendingTags;
async function refreshTags(){if(pendingTags)return pendingTags;pendingTags=(async()=>{const d=await collectTags(ghl,locationId);await mkdir(path.join(root,'.cache'),{recursive:true});await atomicCache('tags.json',d);return d;})().finally(()=>{pendingTags=undefined;});return pendingTags;}
async function readTags(){try{return JSON.parse(await readFile(path.join(root,'.cache/tags.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return refreshTags();throw e;}}
app.get('/api/tags',async(req,res)=>{try{res.json(await readTags());}catch(e){res.status(502).json({error:e.message});}});
app.post('/api/tags/sync',async(req,res)=>{try{res.json(await refreshTags());}catch(e){res.status(502).json({error:e.message});}});
app.get('/api/health',async(req,res)=>{try{const [acquisition,replies,forms,sales]=await Promise.all([cached||synchronize(),replyData(),readForms(),readSales()]);res.json(healthReport({acquisition,replies,forms,sales},{days:req.query.days||30}));}catch(e){res.status(502).json({error:e.message});}});
let investigationJob={running:false,error:'',progress:0};
app.get('/api/investigation/status',(req,res)=>res.json(investigationJob));
app.post('/api/investigation/sync',(req,res)=>{
 if(investigationJob.running)return res.status(202).json(investigationJob);
 investigationJob={running:true,error:'',progress:0};
 withMessageSync(()=>collectInvestigation(ghl,locationId,{root,onProgress:d=>{if(d.messages)investigationJob.progress=d.messages;}})).then(()=>{investigationJob={...investigationJob,running:false,error:''};}).catch(e=>{investigationJob={...investigationJob,running:false,error:e.message||'A consulta ficou incompleta. Os dados anteriores foram preservados.'};});
 res.status(202).json(investigationJob);
});
app.get('/api/investigation',async(req,res)=>{try{res.json(JSON.parse(await readFile(path.join(root,'.cache/investigation.json'),'utf8')));}catch(e){res.status(503).json({error:'O histórico de investigação ainda não está disponível.'});}});
let pendingLifecycle;
async function lifecyclePayload(refresh=false){let base;try{base=JSON.parse(await readFile(path.join(root,'.cache/lifecycle.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(refresh||!base){if(!pendingLifecycle)pendingLifecycle=(async()=>{const d=await collectLifecycle(ghl,locationId);await writeFile(path.join(root,'.cache/lifecycle.json.tmp'),JSON.stringify(d));const {rename}=await import('node:fs/promises');await rename(path.join(root,'.cache/lifecycle.json.tmp'),path.join(root,'.cache/lifecycle.json'));return d;})().finally(()=>{pendingLifecycle=undefined});base=await pendingLifecycle;}
 const [forms,replies,investigation]=await Promise.all([readForms(),replyData(),readFile(path.join(root,'.cache/investigation.json'),'utf8').then(JSON.parse)]);return lifecycleReport({base,forms,replies,investigation});
}
app.get('/api/assistant/:id',async(req,res)=>{try{
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(req.params.id))return res.status(400).json({error:'Identificador inválido.'});
 const data=await lifecyclePayload();const person=data.rows.find(r=>r.id===req.params.id);
 if(!person)return res.status(404).json({error:'Contato não encontrado na consulta disponível.'});
 const history=await readAssistantHistory(ghl,locationId,person.id);
 res.set('Cache-Control','no-store');
 res.json({...assistantDetail(person,history),contactsCutoff:data.retrievedAt});
}catch(e){res.status(503).json({error:'Não foi possível reunir o contexto. Atualize os dados e tente novamente.'});}});
app.get('/api/lifecycle',async(req,res)=>{try{res.json(await lifecyclePayload());}catch(e){res.status(502).json({error:e.message});}});
app.post('/api/lifecycle/sync',async(req,res)=>{try{res.json(await lifecyclePayload(true));}catch(e){res.status(502).json({error:e.message});}});
async function syncRequest(route,method='POST'){
 const r=await fetch('http://127.0.0.1:'+port+route,{method,signal:AbortSignal.timeout(1800000)});const d=await r.json();if(!r.ok)throw Error(d.error||'Falha ao atualizar '+route);return d;
}
let globalTimer;let priorSync;try{priorSync=JSON.parse(await readFile(path.join(root,'.cache/system-sync.json'),'utf8'));}catch{}
const globalSync=createSyncCoordinator([
 {name:'Aquisição e contatos',run:()=>synchronize()},
 {name:'Formulários e pesquisas',run:()=>refreshForms()},
 {name:'Ciclo de vida e responsáveis',run:()=>lifecyclePayload(true)},
 {name:'Oportunidades e origens das vendas',run:async()=>salesOriginPayload(await refreshSales(),true)},
 {name:'Tags',run:()=>refreshTags()},
 {name:'Mensagens e respostas',run:()=>syncRequest('/api/replies/sync')},
 {name:'Investigação de mensagens',run:async()=>{if(!investigationJob.running){try{const d=JSON.parse(await readFile(path.join(root,'.cache/investigation.json'),'utf8'));const started=Date.parse(globalSync.getStatus().startedAt);if(Date.parse(d.contactsRetrievedAt)>=started&&Date.parse(d.cutoff)>=started-1000)return;}catch{}}await syncRequest('/api/investigation/sync');while(investigationJob.running)await new Promise(resolve=>setTimeout(resolve,1000));if(investigationJob.error)throw Error(investigationJob.error);}},
 {name:'Estratégias, saúde e cruzamentos',run:async()=>{for(const route of ['/api/strategies','/api/health','/api/lifecycle'])await syncRequest(route,'GET');}}
],{initial:priorSync,onChange:state=>{try{writeFileSync(path.join(root,'.cache/system-sync.json.tmp'),JSON.stringify(state));renameSync(path.join(root,'.cache/system-sync.json.tmp'),path.join(root,'.cache/system-sync.json'));}catch(e){console.error('Falha ao salvar estado de atualização:',e.message);}clearTimeout(globalTimer);if(!state.running)globalTimer=setTimeout(()=>globalSync.run(),300000);}});
app.get('/api/system/status',(req,res)=>res.json(globalSync.getStatus()));
app.post('/api/system/sync',(req,res)=>{globalSync.run().catch(()=>{});res.status(202).json(globalSync.getStatus());});
function scheduleGlobalSync(){
 const remaining=!priorSync?.running&&priorSync?.nextRunAt?Date.parse(priorSync.nextRunAt)-Date.now():0;
 if(remaining>0&&remaining<=300000)globalTimer=setTimeout(()=>globalSync.run(),remaining);else globalSync.run();
}
app.use('/api', (req,res) => res.status(404).json({error:'Rota não encontrada.'}));
if (!process.argv.includes('--production')) await import('./build.mjs');
app.use(express.static(path.join(root,'dist')));
app.get('/', (req,res) => res.sendFile(path.join(root,'dist/index.html')));
app.listen(port,'127.0.0.1',() => {console.log(`Dashboard disponível em http://localhost:${port}`);scheduleGlobalSync();});





