import {useDataRevision} from './SystemSync.jsx';
import React,{useEffect,useState} from 'react';
import {ClipboardList} from 'lucide-react';
import {countFormLeads} from '../form-leads.mjs';
export default function FormLeadsCard({start,end,revision}){
 const dataRevision=useDataRevision();
 const [snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[loading,setLoading]=useState(true);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');fetch('/api/forms',{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível consultar os formulários.');return d;}).then(setSnapshot).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[revision,retry,dataRevision]);
 const report=snapshot?countFormLeads(snapshot.rows,start,end):null;
 return <section className="acquisition-form-card" aria-label="Leads via formulários"><div className="form-leads-total"><ClipboardList size={23}/><div><div className="eyebrow">LEADS VIA FORMULÁRIOS</div><strong>{loading?'…':error?'Indisponível':report?new Intl.NumberFormat('pt-BR').format(report.total):'—'}</strong><small>pessoas únicas no período</small></div></div><div className="form-leads-note">{error?<p role="alert">{error} <button className="outline" onClick={()=>setRetry(n=>n+1)}>Tentar novamente</button></p>:<><p>Contatos que enviaram formulários nas datas selecionadas, incluindo os formulários do Facebook. Cada pessoa conta uma vez, mesmo com vários envios.</p><small>Usa a data do envio; pode incluir contatos cadastrados antes do período.{snapshot&&<> Consulta de formulários: {new Date(snapshot.retrievedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})} · Brasília.</>}</small></>}<a href="#forms">Ver formulários e respostas →</a></div></section>;
}
