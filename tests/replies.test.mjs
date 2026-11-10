import test from 'node:test';import assert from 'node:assert/strict';import {summarizeReplies} from '../replies.mjs';
test('unifies channels and distinguishes no reply from no contact',()=>{
 const contacts={retrievedAt:'2026-09-17T14:00:00Z',contacts:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'},{id:'g',name:'Grupo exemplo'}]};
 const shared={id:'1',contactId:'a',direction:'inbound',dateAdded:'2026-09-01T14:00:00Z'};
 const history={cutoff:'2026-09-17T14:00:00Z',channels:{SMS:{messages:[shared,{id:'2',contactId:'a',direction:'inbound',dateAdded:'2026-09-03T14:00:00Z'},{id:'3',contactId:'b',direction:'outbound',dateAdded:'2026-09-02T14:00:00Z'}]},WhatsApp:{messages:[shared,{id:'5',contactId:'g',direction:'inbound',dateAdded:'2026-09-02T14:00:00Z'},{id:'4',contactId:'deleted',direction:'inbound',dateAdded:'2026-09-02T14:00:00Z'}]}}};
 const r=summarizeReplies(contacts,history);assert.equal(r.responded,1);assert.equal(r.neverResponded,2);assert.equal(r.contactedNoReply,1);assert.equal(r.noExchange,1);assert.equal(r.inboundMessages,2);assert.equal(r.totalContacts,3);assert.equal(r.rows.some(c=>c.id==='g'),false);assert.equal(r.rows.find(c=>c.id==='a').firstReply,shared.dateAdded);assert.equal(r.rows.find(c=>c.id==='a').lastReply,'2026-09-03T14:00:00Z');
});
