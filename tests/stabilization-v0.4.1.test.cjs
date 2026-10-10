"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const history=require("../order-history-model.js"),core=require("../app.js");
const load=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const json=p=>JSON.parse(load("data/"+p));
const catalog=json("medication_catalog_candidates.json"),patients=json("patients.json"),
  shifts=json("staff_shifts.json"),reviews=json("verification_events.json"),
  baseline=core.enrichOrders(catalog,json("simulated_orders_SCHEMA_ONLY.json"));
const target=baseline.find(o=>o.patient_id==="DEMO-P001"&&o.order_status==="active");
const action=(kind,time,extra={})=>({order_id:target.order_id,patient_id:target.patient_id,action:kind,
  occurred_at:time,actor_id:target.prescriber_id,actor_name:target.prescriber_name,
  reason:"시뮬레이션 기록 검증",...extra});

test("v0.4.1 rejects backdated changes relative to the last revision, preserving current state",()=>{
 const first=history.transition(baseline,[],action("hold","2026-10-10T16:00:00+09:00"));
 const original=JSON.stringify(first);
 assert.throws(()=>history.transition(first.orders,first.events,action("resume","2026-10-10T12:00:00+09:00")),/직전 변경 시각/);
 assert.equal(JSON.stringify(first),original);
});
test("multiple revisions in the same simulated minute retain append order and increasing revision numbers",()=>{
 const first=history.transition(baseline,[],action("hold","2026-10-10T16:00:00+09:00"));
 const second=history.transition(first.orders,first.events,action("resume","2026-10-10T16:00:00+09:00"));
 assert.deepEqual(second.events.map(e=>e.order_revision),[1,2]);
 assert.equal(second.event.after.order_status,"active");
 assert.equal(second.event.after.order_revision,2);
 assert.notEqual(second.events[0].event_id,second.events[1].event_id);
});
test("a legacy PRN missing detailed conditions may be revised without inventing a condition",()=>{
 const old=baseline.find(o=>o.order_type==="prn" && !o.administration_condition && o.order_status==="active");
 assert.ok(old,"at least one incomplete seeded PRN exists");
 const edited=history.transition(baseline,[],{
  order_id:old.order_id,patient_id:old.patient_id,action:"revise",
  occurred_at:"2026-10-10T16:00:00+09:00",
  actor_id:old.prescriber_id,actor_name:old.prescriber_name,reason:"가상 용량 필드 변경",
  changes:{dose_instruction:"DEMO value only"}
 });
 assert.equal(edited.event.after.administration_condition,old.administration_condition);
 assert.equal(edited.event.after.dose_instruction,"DEMO value only");
 assert.equal(edited.event.before.dose_instruction,old.dose_instruction);
});
test("older nurse acknowledgements cannot stand in for a new revision; time constraints remain effective",()=>{
 const first=history.transition(baseline,[],action("revise","2026-10-10T16:00:00+09:00",
  {changes:{dose_instruction:"DEMO revised dose"}}));
 const current=first.orders.find(o=>o.order_id===target.order_id);
 assert.equal(current.order_revision,1);
 assert.equal(core.canAcknowledge(current,shifts[0]),false);
 assert.equal(core.canAcknowledge(current,shifts[1]),true);
 const previous=reviews.filter(r=>r.order_id===target.order_id);
 assert.ok(previous.some(r=>(r.order_revision??0)===0));
 assert.equal(previous.some(r=>(r.order_revision??0)===current.order_revision),false);
 const marked=core.appendAcknowledge(reviews,current,shifts[1]);
 assert.equal(marked[marked.length-1].order_revision,1);
 assert.equal(core.validate(catalog,first.orders,patients,shifts,marked),true);
});
test("original order wording is visibly separated from revised instructions",()=>{
 const app=load("app.js");
 assert.ok(app.includes("최초 입력 처방 원문 · 버전 0"));
 assert.ok(app.includes("현재 변경 버전에 대한 간호사 열람 확인 기록이 없습니다"));
 assert.ok(app.includes("currentRevisionAcknowledged"));
 assert.ok(app.includes('field("최종 변경 시각"'));
});
test("same-patient physician draft survives reopening; patient switch discards previous draft",()=>{
 const doctor=load("doctor-ui.js");
 assert.ok(doctor.includes("previousMedication=med.value"));
 assert.ok(doctor.includes("med.value=previousMedication"));
 assert.ok(doctor.includes("previousProvider=provider.value"));
 assert.ok(doctor.includes("form.reset();"));
 assert.ok(doctor.includes("환자가 변경되어 이전 환자의 미등록 처방 입력값"));
});
test("doctor-to-order shortcut requires success and navigation remains isolated",()=>{
 const doc=load("doctor-ui.js"),index=load("index.html"),nav=load("workspace-nav.js");
 assert.ok(index.includes('id="composerViewOrder" type="button" hidden'));
 assert.ok(doc.includes('viewOrder.addEventListener("click"'));
 assert.ok(doc.includes('viewOrder.hidden=false'));
 assert.ok(doc.includes('viewOrder.hidden=true'));
 assert.ok(nav.includes('navigate("orders")'));
 assert.ok(!nav.includes("localStorage")&&!nav.includes("indexedDB"));
});
test("stabilization does not modify initial synthetic orders or staff/login data",()=>{
 assert.equal(patients.length,4);
 assert.equal(catalog.length,107);
 assert.equal(baseline.length,18);
 assert.equal(reviews.length,3);
 assert.equal(shifts.length,3);
 assert.equal(core.validate(catalog,baseline,patients,shifts,reviews),true);
});
