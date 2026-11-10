import {collectInvestigation} from './investigation-sync.mjs';
process.loadEnvFile('.env');
async function get(route,body){let error;for(let attempt=0;attempt<3;attempt++){try{const r=await fetch('https://services.leadconnectorhq.com'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+process.env.GHL_TOKEN,Version:'2021-07-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}catch(e){error=e;}}throw error;}
await collectInvestigation(get,process.env.GHL_LOCATION_ID,{root:process.cwd(),onProgress:d=>console.log(JSON.stringify(d))});
