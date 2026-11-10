import test from 'node:test';import assert from 'node:assert/strict';import {collectReplies} from '../replies-sync.mjs';
const cutoff='2026-09-18T18:00:00.000Z';
test('refresh detects replies after old cutoff, splits exports, excludes groups and other channels',async()=>{
 const messages=[{id:'1',contactId:'a',direction:'outbound',dateAdded:'2026-09-17T22:00:00.000Z'},{id:'2',contactId:'a',direction:'inbound',dateAdded:'2026-09-18T10:00:00.000Z'},{id:'3',contactId:'b',direction:'outbound',dateAdded:'2026-09-18T12:00:00.000Z'},{id:'4',contactId:'g',direction:'inbound',dateAdded:'2026-09-18T13:00:00.000Z'}];
 const result=await collectReplies(async(route)=>{if(route==='/contacts/search')return {total:4,contacts:[{id:'a',contactName:'A'},{id:'b',contactName:'B'},{id:'c',contactName:'C'},{id:'g',contactName:'Grupo exemplo'}]};const q=new URL('https://example.com'+route).searchParams;assert.ok(['SMS','WhatsApp'].includes(q.get('channel')));const found=q.get('channel')==='SMS'?messages.filter(m=>m.dateAdded>=q.get('startDate')&&m.dateAdded<=q.get('endDate')):[];return {total:found.length,messages:found.slice(0,2)};},'location',{cutoff,limit:2});
 assert.equal(result.cutoff,cutoff);assert.equal(result.responded,1);assert.equal(result.contactedNoReply,1);assert.equal(result.noExchange,1);assert.equal(result.totalContacts,3);assert.equal(result.rows.find(r=>r.id==='a').lastReply,'2026-09-18T10:00:00.000Z');
});
test('rejects truncated history rather than reporting contacts as untouched',async()=>{await assert.rejects(collectReplies(async()=>({total:2,messages:[]}),'location',{cutoff}),/incompleto/)});
test('incremental refresh replaces overlap, preserves older history and does not double-count replies',async()=>{
 const old={id:'old',contactId:'a',direction:'outbound',dateAdded:'2026-09-01T10:00:00.000Z'};
 const reply={id:'reply',contactId:'a',direction:'inbound',dateAdded:'2026-09-18T10:00:00.000Z'};
 const result=await collectReplies(async(route)=>route==='/contacts/search'?{total:1,contacts:[{id:'a',contactName:'A'}]}:{total:1,messages:[reply]},'location',{cutoff,previous:{cutoff:'2026-09-17T20:00:00Z',channels:{SMS:{messages:[old,reply]}}}});
 assert.equal(result.rows[0].sent,1);assert.equal(result.rows[0].received,1);assert.equal(result.rows[0].firstSent,old.dateAdded);assert.equal(result.rows[0].status,'responded');
});
test('daily reconciliation removes messages deleted from older API history',async()=>{
 const result=await collectReplies(async route=>route==='/contacts/search'?{total:1,contacts:[{id:'a',contactName:'A'}]}:{total:0,messages:[]},'location',{cutoff,previous:{cutoff:'2026-09-18T17:00:00Z',fullRetrievedAt:'2026-09-16T10:00:00Z',channels:{SMS:{messages:[{id:'removed',contactId:'a',direction:'inbound',dateAdded:'2026-09-01T10:00:00Z'}]}}}});
 assert.equal(result.rows[0].status,'untouched');assert.equal(result._history.fullRetrievedAt,cutoff);
});
test('uses API cursor pages without dropping or duplicating messages',async()=>{
 const first={id:'1',contactId:'a',direction:'outbound',dateAdded:'2026-09-17T10:00:00Z'},reply={id:'2',contactId:'a',direction:'inbound',dateAdded:'2026-09-18T10:00:00Z'};
 const result=await collectReplies(async route=>{if(route==='/contacts/search')return {total:1,contacts:[{id:'a',contactName:'A'}]};const q=new URL('https://example.com'+route).searchParams;if(q.get('channel')==='WhatsApp')return {total:0,messages:[]};return q.has('cursor')?{total:2,messages:[reply],nextCursor:null}:{total:2,messages:[first],nextCursor:'next'};},'location',{cutoff});assert.equal(result.rows[0].received,1);assert.equal(result.rows[0].sent,1);
});
test('accepts reused stateful cursor while new message IDs continue arriving',async()=>{
 let page=0;const result=await collectReplies(async route=>{if(route==='/contacts/search')return {total:1,contacts:[{id:'a',contactName:'A'}]};const q=new URL('https://example.com'+route).searchParams;if(q.get('channel')==='WhatsApp')return {total:0,messages:[]};page++;return {total:3,messages:[{id:String(page),contactId:'a',direction:'inbound',dateAdded:cutoff}],nextCursor:page<3?'same-cursor':null};},'location',{cutoff});assert.equal(result.rows[0].received,3);
});
test('export record total may include duplicate IDs; dashboard counts each message once',async()=>{
 const a={id:'a1',contactId:'a',direction:'inbound',dateAdded:cutoff},b={...a,id:'a2'};
 const result=await collectReplies(async route=>{if(route==='/contacts/search')return {total:1,contacts:[{id:'a',contactName:'Ana'}]};const q=new URL('https://example.com'+route).searchParams;if(q.get('channel')==='WhatsApp')return {total:0,messages:[]};return q.has('cursor')?{total:3,messages:[a,b],nextCursor:null}:{total:3,messages:[a],nextCursor:'next'};},'location',{cutoff});assert.equal(result.rows[0].received,2);assert.equal(result.inboundMessages,2);
});
