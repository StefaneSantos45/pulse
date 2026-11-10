import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, validateRange, day } from '../metrics.mjs';
const snapshot=contacts=>({account:'test',retrievedAt:'2026-09-17T14:00:00Z',contacts});
test('Brasilia midnight and complete days',()=>{
 assert.equal(day('2026-09-17T02:59:59Z'),'2026-09-16');
 assert.equal(day('2026-09-17T03:00:00Z'),'2026-09-17');
 const result=aggregate(snapshot([{id:'a',dateAdded:'2026-09-17T02:59:59Z'},{id:'b',dateAdded:'2026-09-17T03:00:00Z'}]),'2026-09-16','2026-09-16');
 assert.equal(result.total,1);
});
test('deduplication, zero dates and equal prior window',()=>{
 const result=aggregate(snapshot([{id:'a',dateAdded:'2026-09-16T12:00:00Z'},{id:'a',dateAdded:'2026-09-16T12:00:00Z'},{id:'b',dateAdded:'2026-09-14T12:00:00Z'},{id:'c',dateAdded:'invalid'}]),'2026-09-15','2026-09-16');
 assert.deepEqual(result.current.map(r=>r.count),[0,1]);assert.equal(result.previousStart,'2026-09-13');assert.equal(result.previousEnd,'2026-09-14');assert.equal(result.previousTotal,1);assert.equal(result.change,0);assert.equal(result.average,.5);assert.equal(result.invalidDates,1);
});
test('zero baseline has no fabricated percent',()=>{
 const result=aggregate(snapshot([]),'2026-09-15','2026-09-16');assert.equal(result.change,null);assert.equal(result.total,0);
});
test('rejects malformed, reversed, future and excessive ranges',()=>{
 for(const [a,b] of [['2026-02-30','2026-03-02'],['2026-09-16','2026-09-15'],['2026-09-17','2026-09-17'],['2020-01-01','2026-09-16']])assert.throws(()=>validateRange(a,b,'2026-09-17'));
});
test('lead table matches card cohort, deduplicates IDs and sorts newest first',()=>{const d=aggregate(snapshot([{id:'a',name:'A',dateAdded:'2026-09-01T03:00:00Z'},{id:'b',name:'B',dateAdded:'2026-09-02T02:59:59Z'},{id:'a',name:'A atualizado',dateAdded:'2026-09-01T03:00:00Z'},{id:'out',dateAdded:'2026-09-02T03:00:00Z'},{id:'bad',dateAdded:'invalid'}]),'2026-09-01','2026-09-01');assert.equal(d.rows.length,d.total);assert.deepEqual(d.rows.map(r=>r.id),['b','a']);assert.equal(d.rows[1].name,'A atualizado');});
