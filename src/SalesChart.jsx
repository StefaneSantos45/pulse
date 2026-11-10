import React,{useState} from 'react';
export default function SalesChart({report,metric}){
 const [hover,setHover]=useState(null),series=report.series,key=metric==='value'?'value':'count';
 const amount=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:metric==='value'?2:0}).format(n);
 const label=d=>report.grouping==='month'?d.slice(5,7)+'/'+d.slice(0,4):d.slice(8,10)+'/'+d.slice(5,7);
 const W=1000,H=280,L=65,R=20,T=25,B=40,step=(W-L-R)/Math.max(1,series.length),maximum=Math.max(0,...series.map(d=>d[key]));
 const tick=Math.max(1,Math.ceil(maximum/4)),ceiling=tick*4,y=v=>H-B-v/ceiling*(H-T-B);
 const selected=hover===null?null:series[hover];
 return <div className="sales-chart"><div className="axis-label">{metric==='value'?'Valor registrado no CRM (moeda não informada)':'Quantidade de vendas (oportunidades)'}</div>{series.length?<><div className="sales-chart-scroll"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={metric==='value'?'Valor das vendas por período':'Quantidade de vendas por período'}>
 {[0,1,2,3,4].map(i=><g key={i}><line x1={L} x2={W-R} y1={y(tick*i)} y2={y(tick*i)} stroke="#e0e7de" strokeDasharray="3 5"/><text x={L-10} y={y(tick*i)+4} textAnchor="end" className="tick">{amount(tick*i)}</text></g>)}
 {series.map((d,i)=><g key={d.date} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}><rect x={L+i*step} y={T} width={step} height={H-T-B} fill="transparent"/><rect x={L+(i+.2)*step} y={y(d[key])} width={Math.max(.5,step*.6)} height={H-B-y(d[key])} rx={Math.min(4,step*.15)} fill={hover===i?'#214d3b':'#528363'}><title>{label(d.date)}: {d.count} oportunidades · valor {new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(d.value)}</title></rect>{(i===0||i===series.length-1||i%Math.ceil(series.length/10)===0)&&<text x={L+(i+.5)*step} y={H-17} textAnchor="middle" className="tick">{label(d.date)}</text>}</g>)}
 </svg></div><div className="chart-caption"><span aria-live="polite">{selected?`${label(selected.date)} · ${selected.count} oportunidades · valor ${new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(selected.value)}`:'Passe o cursor sobre as barras para ver quantidade e valor.'}</span><span>Entrada em Venda · {report.grouping==='month'?'mês/ano':'dia/mês'} · Brasília</span></div></>:<p className="no-results">Sem datas de venda disponíveis para o gráfico.</p>}<p className="chart-source">Fonte: GoHighLevel · Vendas → Venda · {report.chartStart||'sem início'} a {report.chartEnd||'sem fim'} · Soma por {report.grouping==='month'?'mês':'dia'}{report.missingStageDates?` · ${report.missingStageDates} registros sem data fora do gráfico`:''}.</p></div>;
}

