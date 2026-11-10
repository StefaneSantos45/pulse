import test from 'node:test';import assert from 'node:assert/strict';import {shapeSales,collectSales,pipelineId,stageId} from '../sales.mjs';
const opp=(id,extra={})=>({id,contactId:'c',pipelineId,pipelineStageId:stageId,monetaryValue:100.1,name:'Registro',contact:{name:'Contato',phone:'+5511999990000'},createdAt:'2026-01-02T10:00:00Z',lastStageChangeAt:'2026-02-03T10:00:00Z',lastStatusChangeAt:'2026-02-04T10:00:00Z',updatedAt:'2026-03-01T10:00:00Z',...extra});
const contacts=[{id:'c',dateAdded:'2025-12-01T10:00:00Z'}];
test('preserves distinct contact, opportunity and stage dates',()=>{const r=shapeSales([opp('a')],contacts);assert.equal(r.rows[0].leadCreatedAt,contacts[0].dateAdded);assert.equal(r.rows[0].opportunityCreatedAt,'2026-01-02T10:00:00Z');assert.equal(r.rows[0].saleStageEnteredAt,'2026-02-03T10:00:00Z');});
test('deduplicates opportunity IDs without merging different opportunities for one contact',()=>{const r=shapeSales([opp('a'),opp('a'),opp('b',{monetaryValue:200.2})],contacts);assert.equal(r.opportunityCount,2);assert.equal(r.contactCount,1);assert.equal(r.totalValue,300.3);});
test('rejects another stage and preserves missing values',()=>{assert.throws(()=>shapeSales([opp('a',{pipelineStageId:'other'})],contacts));const r=shapeSales([opp('a',{monetaryValue:undefined,lastStageChangeAt:null})],[]);assert.equal(r.rows[0].amount,null);assert.equal(r.rows[0].leadCreatedAt,null);assert.equal(r.rows[0].saleStageEnteredAt,null);});
test('collects every page even when contact repeats',async()=>{const calls=[];const fake=async route=>{calls.push(route);return calls.length===1?{opportunities:[opp('a')],meta:{total:2,startAfter:1,startAfterId:'a'}}:{opportunities:[opp('b')],meta:{total:2}}};const r=await collectSales(fake,'loc',contacts);assert.equal(r.opportunityCount,2);assert.equal(calls.length,2);assert.match(calls[1],/startAfterId=a/);});
import {salesCycle} from '../sales.mjs';
test('cycle averages fractional elapsed days and excludes invalid or reversed dates',()=>{
 const r=salesCycle([{leadCreatedAt:'2026-01-01T03:00:00Z',saleStageEnteredAt:'2026-01-02T15:00:00Z'},{leadCreatedAt:'2026-01-01T03:00:00Z',saleStageEnteredAt:'2026-01-03T15:00:00Z'},{leadCreatedAt:null,saleStageEnteredAt:'2026-01-03T00:00:00Z'},{leadCreatedAt:'2026-01-04T00:00:00Z',saleStageEnteredAt:'2026-01-03T00:00:00Z'}]);
 assert.equal(r.averageDaysToSale,2);assert.equal(r.cycleSampleSize,2);assert.equal(r.cycleExcludedCount,2);
});
test('cycle preserves instantaneous sales and distinguishes no usable observations',()=>{
 assert.equal(salesCycle([{leadCreatedAt:'2026-01-01T00:00:00Z',saleStageEnteredAt:'2026-01-01T00:00:00Z'}]).averageDaysToSale,0);
 assert.equal(salesCycle([]).averageDaysToSale,null);
});
