"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const model=require("../order-sheet-model.js"),composer=require("../order-composer.js"),core=require("../app.js");
const load=p=>JSON.parse(fs.readFileSync(path.join(__dirname,"..","data",p),"utf8"));
const patients=load("patients.json"),notes=load("teaching_case_context.json"),
 catalog=load("medication_catalog_candidates.json"),orders=load("simulated_orders_SCHEMA_ONLY.json");
const enrich=core.enrichOrders(catalog,orders);
test("Kardex/worksheet teaching cases correspond to four distinct existing synthetic patients",()=>{
  assert.equal(model.validateTeachingContexts(patients,notes),true);
  assert.equal(notes.length,4);
  assert.deepEqual(notes.map(x=>x.patient_id),patients.map(x=>x.patient_id));
  assert.ok(notes.every(x=>x.kardex_notes.length>0 && x.skill_topics.length>0 && x.watch_points.length>0));
});
test("order-sheet grouping preserves original per-patient order counts",()=>{
  const expected=[6,2,6,4];
  for(let i=0;i<patients.length;i++){
    const groups=model.groupOrders(enrich,patients[i].patient_id);
    assert.equal(groups.reduce((n,g)=>n+g.orderRows.length,0),expected[i]);
    assert.ok(groups.every(g=>g.batch==="기존"));
  }
});
test("daily totals and quantities are missing, never derived from dose instructions",()=>{
  const g=model.groupOrders(enrich,patients[0].patient_id);
  const rows=g.flatMap(x=>x.orderRows);
  assert.ok(rows.every(x=>x.dailyDose==="미기재"&&x.dailyQuantity==="미기재"&&x.dailyFrequency==="미기재"&&x.perQuantity==="미기재"));
  assert.ok(rows.some(x=>x.perDose!=="미기재"));
});
test("synthetic added prescription appears in an added group and keeps baseline unchanged",()=>{
  const original=JSON.stringify(enrich);
  const doctors=[{prescriber_id:orders[0].prescriber_id,prescriber_name:orders[0].prescriber_name}];
  const created=composer.createOrder({patient_id:patients[0].patient_id,medication_catalog_id:catalog[0].medication_catalog_id,
    prescriber_id:doctors[0].prescriber_id,mode:"prn",ordered_at:"2026-10-10T10:30:00+09:00",
    dose_instruction:"TEST dose only",route_instruction:"TEST route",frequency_instruction:"TEST timing",
    indication:"TEST symptom",administration_condition:"TEST condition"},
    {patients,catalog,existing:orders,doctors});
  const groups=model.groupOrders(core.enrichOrders(catalog,[...orders,created]),patients[0].patient_id);
  assert.ok(groups.some(x=>x.batch==="추가"&&x.orderRows.some(row=>row.id===created.order_id&&row.classification==="PRN")));
  assert.equal(JSON.stringify(enrich),original);
  assert.equal(model.groupOrders(enrich,patients[1].patient_id).reduce((n,g)=>n+g.orderRows.length,0),2);
});
test("STAT priority remains distinct from PRN and order status",()=>{
  assert.equal(model.category({order_type:"regular",order_priority:"stat"}),"응급(STAT)");
  assert.equal(model.category({order_type:"prn",order_priority:"routine"}),"PRN");
  assert.equal(model.category({order_type:"regular",order_priority:"routine"}),"정규");
});
test("unreported order times and optional values are not invented",()=>{
  const missing={...enrich[0],ordered_at:null,scheduled_at:null,dose_instruction:null};
  const g=model.groupOrders([missing],missing.patient_id);
  assert.equal(g[0].stamp,"시각 미기재");
  assert.equal(g[0].orderRows[0].perDose,"미기재");
  assert.equal(g[0].orderRows[0].schedule,"미기재");
});
test("patient isolation, duplicates and unknown patients fail closed in teaching-case validation",()=>{
  assert.equal(model.groupOrders(enrich,"DEMO-OTHER").length,0);
  assert.throws(()=>model.validateTeachingContexts(patients,[...notes,notes[0]]),/중복/);
  assert.throws(()=>model.validateTeachingContexts(patients,notes.slice(1)),/모든 가상 환자/);
  assert.throws(()=>model.validateTeachingContexts(patients,[{...notes[0],real_patient_id:"REAL"},...notes.slice(1)]),/식별자/);
});
