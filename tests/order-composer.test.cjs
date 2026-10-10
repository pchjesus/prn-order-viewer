"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const composer=require("../order-composer.js");
const PRN=require("../app.js");
const load=name=>JSON.parse(fs.readFileSync(path.join(__dirname,"..","data",name),"utf8"));
const catalog=load("medication_catalog_candidates.json"),patients=load("patients.json");
const existing=load("simulated_orders_SCHEMA_ONLY.json");
const doctors=[...new Map(existing.filter(x=>x.prescriber_id&&x.prescriber_name).map(x=>[x.prescriber_id,{prescriber_id:x.prescriber_id,prescriber_name:x.prescriber_name}])).values()];
const ctx={catalog,patients,existing,doctors};
const doctor=doctors[0],medicine=catalog[0],patient=patients[0];
const base={
 patient_id:patient.patient_id,medication_catalog_id:medicine.medication_catalog_id,
 prescriber_id:doctor.prescriber_id,mode:"regular",dose_instruction:"SIMULATED: TEST mg",
 route_instruction:"TEST oral",frequency_instruction:"TEST schedule; not a real dose",
 ordered_at:"2026-10-10T10:30:00+09:00"
};
test("doctor factory preserves 107 drugs / 4 patients / original 18 orders",()=>{
  const before=JSON.stringify({catalog,patients,existing});
  const created=composer.createOrder(base,ctx);
  assert.ok(created.order_id.startsWith("SIM-ORD-NEW-"));
  assert.equal(created.patient_id,patient.patient_id);
  assert.equal(created.prescriber_id,doctor.prescriber_id);
  assert.equal(created.order_domain,"medication");
  assert.equal(JSON.stringify({catalog,patients,existing}),before);
});
test("regular, PRN and emergency are separate from urgency and active status",()=>{
  const regular=composer.createOrder(base,ctx);
  const prn=composer.createOrder({...base,mode:"prn",indication:"TEST symptom",administration_condition:"TEST PRN condition"},ctx);
  const stat=composer.createOrder({...base,mode:"emergency"},ctx);
  assert.deepEqual([regular.order_type,regular.order_priority],["regular","routine"]);
  assert.deepEqual([prn.order_type,prn.order_priority],["prn","routine"]);
  assert.deepEqual([stat.order_type,stat.order_priority],["regular","stat"]);
  assert.equal(stat.order_mode,"emergency");
  for(const record of [regular,prn,stat]) {
    assert.equal(record.order_status,"active");
    assert.equal(record.is_clinically_complete,false);
    assert.equal(record.dose_review_status,"simulation_unverified");
    assert.equal(PRN.validate(catalog,[record],patients),true);
  }
});
test("new PRN is visible only to the selected patient and in PRN tab",()=>{
  const record=composer.createOrder({...base,mode:"prn",indication:"TEST",administration_condition:"TEST condition"},ctx);
  const source=PRN.enrichOrders(catalog,[...existing,record]);
  const all=PRN.getVisibleOrders(source,{patientId:patient.patient_id,tab:"all"});
  const prn=PRN.getVisibleOrders(source,{patientId:patient.patient_id,tab:"prn"});
  assert.ok(all.some(x=>x.order_id===record.order_id));
  assert.ok(prn.some(x=>x.order_id===record.order_id));
  assert.equal(PRN.getVisibleOrders(source,{patientId:patients[1].patient_id,tab:"prn"}).some(x=>x.order_id===record.order_id),false);
});
test("PRN requires an indication and a PRN administration condition",()=>{
  assert.throws(()=>composer.createOrder({...base,mode:"prn"},ctx),/적응증/);
  assert.throws(()=>composer.createOrder({...base,mode:"prn",indication:"TEST"},ctx),/투여 조건/);
});
test("dose, route, frequency, patient and doctor are mandatory",()=>{
  for(const item of [{...base,dose_instruction:""},{...base,route_instruction:""},{...base,frequency_instruction:""},{...base,patient_id:"NOT-A-PATIENT"},{...base,prescriber_id:"NOT-A-DOCTOR"},{...base,medication_catalog_id:"FAKE"}]) assert.throws(()=>composer.createOrder(item,ctx));
});
test("mode, time format, scheduled time and reissued ID collisions reject or avoid",()=>{
  assert.throws(()=>composer.createOrder({...base,mode:"fake"},ctx));
  assert.throws(()=>composer.createOrder({...base,ordered_at:"not-a-date"},ctx));
  assert.throws(()=>composer.createOrder({...base,scheduled_at:"broken"},ctx));
  const first=composer.createOrder(base,ctx);
  const second=composer.createOrder(base,{...ctx,existing:[...ctx.existing,first]});
  assert.notEqual(first.order_id,second.order_id);
});
test("common envelope refers to medication not a test or dressing service",()=>{
  const o=composer.createOrder({...base,mode:"emergency"},ctx);
  assert.deepEqual(composer.createEnvelope(o),{
    envelope_version:1,request_id:o.order_id,patient_id:o.patient_id,
    domain:"medication",mode:"emergency",priority:"stat",status:"active",
    prescriber_id:doctor.prescriber_id,ordered_at:base.ordered_at,
    medication_order_id:o.order_id,related_service_request_id:null
  });
});
test("urgent orders do not become PRNs; model keeps source unchanged on sort",()=>{
  const stat=composer.createOrder({...base,mode:"emergency"},ctx),arr=PRN.enrichOrders(catalog,[...existing,stat]),original=JSON.stringify(arr);
  assert.equal(PRN.getVisibleOrders(arr,{patientId:patient.patient_id,tab:"prn"}).some(x=>x.order_id===stat.order_id),false);
  assert.equal(JSON.stringify(arr),original);
});
