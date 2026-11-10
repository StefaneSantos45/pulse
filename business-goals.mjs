import {salesDay} from './sales-report.mjs';
export const monthlySalesGoal=30000;
export function monthlyGoal(sales,now=new Date().toISOString()){
 const today=salesDay(now),month=today.slice(0,7),start=month+'-01';
 const last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
 const cutoff=salesDay(sales.retrievedAt),available=cutoff>=start;
 const rows=[...new Map(sales.rows.map(r=>[r.id,r])).values()].filter(r=>r.saleStageEnteredAt&&Number.isFinite(Date.parse(r.saleStageEnteredAt))&&salesDay(r.saleStageEnteredAt).slice(0,7)===month&&Date.parse(r.saleStageEnteredAt)<=Math.min(Date.parse(sales.retrievedAt),Date.parse(now)));
 const amount=Math.round(rows.reduce((n,r)=>n+(typeof r.amount==='number'?r.amount:0),0)*100)/100;
 const remainingDays=Number(last.slice(8))-Number(today.slice(8))+1,remaining=Math.max(0,monthlySalesGoal-amount);
 return {target:monthlySalesGoal,month,start,end:last,available,amount:available?amount:null,percent:available?amount/monthlySalesGoal*100:null,remaining:available?remaining:null,remainingDays,requiredDaily:available?remaining/remainingDays:null,salesCount:rows.length,missingValues:rows.filter(r=>typeof r.amount!=='number').length,retrievedAt:sales.retrievedAt};
}
