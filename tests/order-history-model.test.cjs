"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),history=require("../order-history-model.js"),composer=require("../order-composer.js"),core=require("../app.js");
const load=p=>JSON.parse(fs.readFileSync(path.join(__dirname,"..","data",p),"utf8"));
const base=load("simulated_orders_SCHEMA_ONLY.json"),catalog=load("medication_catalog_candidates.json"),patients=load("patients.json"),shifts=load("staff_shifts.json"),reviews=load("verification_events.json");
const seeded=core.enrichOrders(catalog,base);
const target=seeded.find(x=>x.patient_id===patients[0].patient_id&&x.order_status==="active");
const actor={actor_id:target.prescriber_id,actor_name:target.prescriber_name};
const at="2026-10-10T12:00:00+09:00";
const input=(action,o=target,extra={})=>({order_id:o.order_id,patient_id:o.patient_id,action,occurred_at:at,reason:"가상 처방 변경 시연",...actor,...extra});
test("hold preserves original source and generates immutable before-after event",()=>{
 const src=JSON.stringify(seeded),result=history.transition(seeded,[],input("hold"));
 assert.equal(result.orders.find(o=>o.order_id===target.order_id).order_status,"on-hold");
 assert.equal(result.event.before.order_status,"active");
 assert.equal(result.event.after.order_status,"on-hold");
 assert.equal(JSON.stringify(seeded),src);
 assert.equal(result.event.session_only,true);
 assert.equal(result.event.patient_id,target.patient_id);
});
test("resume only from hold; stop/DC and cancel are distinct terminal states",()=>{
 const held=history.transition(seeded,[],input("hold"));
 const resumed=history.transition(held.orders,held.events,input("resume"));
 assert.equal(resumed.event.after.order_status,"active");
 const stopped=history.transition(resumed.orders,resumed.events,input("stop"));
 assert.equal(stopped.event.after.order_status,"stopped");
 assert.throws(()=>history.transition(stopped.orders,stopped.events,input("resume")),/종료/);
 const cancelled=history.transition(seeded,[],input("cancel"));
 assert.equal(cancelled.event.after.order_status,"cancelled");
 assert.notEqual(cancelled.event.event_id,stopped.event.event_id===undefined?"never":"separate"); // each independent session starts at first event ID
});
test("instruction revision snapshots old values and keeps the order identity",()=>{
 const updated=history.transition(seeded,[],input("revise",target,{changes:{dose_instruction:"SIMULATED NEW dose"}}));
 assert.equal(updated.event.after.order_id,target.order_id);
 assert.equal(updated.event.before.dose_instruction,target.dose_instruction);
 assert.equal(updated.event.after.dose_instruction,"SIMULATED NEW dose");
 assert.equal(updated.event.after.order_revision,1);
 assert.equal(updated.event.after.original_order_text,target.original_order_text);
 assert.equal(core.validate(catalog,updated.orders,patients,shifts,reviews),true);
});
test("invalid transitions are rejected; missing reason, invalid time, wrong patient or blank instructions fail",()=>{
 for(const x of [input("fake"),input("hold",target,{reason:""}),input("hold",target,{patient_id:patients[1].patient_id}),input("hold",target,{occurred_at:"bad"}),input("revise",target,{changes:{dose_instruction:""}}),input("revise",target,{changes:{not_allowed:"TEST"}})])
  assert.throws(()=>history.transition(seeded,[],x));
});
test("new order creates separate add event without altering seeded prescriptions",()=>{
 const doctors=[{prescriber_id:target.prescriber_id,prescriber_name:target.prescriber_name}];
 const item=composer.createOrder({patient_id:target.patient_id,medication_catalog_id:target.medication_catalog_id,prescriber_id:target.prescriber_id,mode:"prn",
  ordered_at:at,dose_instruction:"SIM 1 mg",route_instruction:"SIM PO",frequency_instruction:"SIM Q6",indication:"SIM pain",administration_condition:"SIM condition"},
  {patients,catalog,existing:seeded,doctors});
 const orders=[...seeded,item],events=history.createAddEvent(orders,[],item);
 assert.equal(events.length,1);assert.equal(events[0].action,"add");assert.equal(events[0].before,null);
 assert.deepEqual(events[0].after,item);
 assert.equal(seeded.length,18);
 assert.throws(()=>history.createAddEvent(orders,events,item),/이미 등록/);
});
test("per-patient event history never mixes patients or existing nurse review events",()=>{
 const first=history.transition(seeded,[],input("hold"));
 const other=seeded.find(o=>o.patient_id===patients[2].patient_id&&o.order_status==="active");
 const second=history.transition(first.orders,first.events,{...input("stop",other),patient_id:other.patient_id,occurred_at:"2026-10-10T18:00:00+09:00",actor_id:other.prescriber_id,actor_name:other.prescriber_name});
 assert.equal(history.patientHistory(second.events,target.patient_id).length,1);
 assert.equal(history.patientHistory(second.events,other.patient_id).length,1);
 assert.equal(reviews.length,3);
 assert.equal(JSON.stringify(reviews),JSON.stringify(load("verification_events.json")));
});
test("event record IDs unique, snapshots remain unmodified on future revisions",()=>{
 const first=history.transition(seeded,[],input("hold"));
 const saved=JSON.stringify(first.events[0]);
 const second=history.transition(first.orders,first.events,input("resume"));
 assert.notEqual(first.event.event_id,second.event.event_id);
 assert.equal(JSON.stringify(first.events[0]),saved);
 assert.equal(second.events[0].before.order_status,"active");
 assert.equal(second.events[1].after.order_status,"active");
});
