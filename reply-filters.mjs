export const replyDateFields={dateAdded:'Data de cadastro',firstSent:'Primeiro envio',firstReply:'Primeira resposta',lastReply:'Última resposta',lastSent:'Último envio'};
const day=d=>new Date(Date.parse(d)-10800000).toISOString().slice(0,10);
export function filterReplyRows(rows,{status='all',query='',start='',end='',dateField='dateAdded',tag=''}={}){
 if(!Object.hasOwn(replyDateFields,dateField))throw Error('Critério de data inválido.');
 for(const d of [start,end])if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))throw Error('Selecione datas válidas.');
 if(start&&end&&start>end)throw Error('A data inicial deve ser anterior ou igual à final.');
 const q=query.trim().toLocaleLowerCase('pt-BR');return rows.filter(r=>(status==='all'||(status==='never'?r.status!=='responded':r.status===status))&&(!q||[r.name,r.phone,...(r.tags||[])].join(' ').toLocaleLowerCase('pt-BR').includes(q))&&(!tag||(r.tags||[]).includes(tag))&&(!(start||end)||(r[dateField]&&Number.isFinite(Date.parse(r[dateField]))&&(!start||day(r[dateField])>=start)&&(!end||day(r[dateField])<=end))));
}
