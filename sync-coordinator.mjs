export function createSyncCoordinator(steps,{intervalMs=300000,now=()=>new Date().toISOString(),onChange=()=>{},initial}={}){
 let pending;
 const status={running:false,revision:0,startedAt:null,finishedAt:null,lastSuccessAt:null,nextRunAt:null,current:'',intervalMs,steps:steps.map(s=>({name:s.name,state:'pending',updatedAt:null,error:''}))};
 if(initial){status.revision=initial.revision||0;status.lastSuccessAt=initial.lastSuccessAt||null;status.finishedAt=initial.finishedAt||null;status.nextRunAt=initial.nextRunAt||null;for(const step of status.steps){const old=initial.steps?.find(s=>s.name===step.name);if(old){step.updatedAt=old.updatedAt;step.state=old.state==='running'?'pending':old.state;step.error=old.error||'';}}}
 const publish=()=>onChange(structuredClone(status));
 function run(){
  if(pending)return pending;
  status.running=true;status.startedAt=now();status.nextRunAt=null;status.steps.forEach(s=>{s.state='pending';s.error=''});publish();
  pending=(async()=>{for(let i=0;i<steps.length;i++){
   const state=status.steps[i];status.current=state.name;state.state='running';publish();
   try{await steps[i].run();state.state='success';state.updatedAt=now();}catch(e){state.state='error';state.error=e.message||'Falha na atualização.';}publish();
  }})().finally(()=>{status.running=false;status.current='';status.finishedAt=now();if(status.steps.every(s=>s.state==='success'))status.lastSuccessAt=status.finishedAt;status.nextRunAt=new Date(Date.parse(status.finishedAt)+intervalMs).toISOString();status.revision++;pending=undefined;publish();});
  return pending;
 }
 return {run,getStatus:()=>structuredClone(status)};
}
