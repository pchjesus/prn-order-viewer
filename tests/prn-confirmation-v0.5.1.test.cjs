"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const core=require("../app.js"),history=require("../order-history-model.js");
const file=name=>JSON.parse(fs.readFileSync(path.join(__dirname,"..","data",name),"utf8"));
const meds=file("medication_catalog_candidates.json"),raw=file("simulated_orders_SCHEMA_ONLY.json");
const enriched=core.enrichOrders(meds,raw);
test("PRN summary projects only the current explicit textual instructions",()=>{
  const order=enriched.find(o=>o.order_type==="prn");
  const before=JSON.stringify(order),v=core.getPrnConfirmation(order);
  assert.deepEqual(Object.keys(v),["indication","condition","dose","route","frequency","maximum"]);
  assert.equal(v.indication,order.indication==null?null:String(order.indication));
  assert.equal(v.condition,order.administration_condition==null?null:String(order.administration_condition));
  assert.equal(v.dose,order.dose_instruction==null?null:String(order.dose_instruction));
  assert.equal(JSON.stringify(order),before);
});
test("regular and STAT orders do not receive a PRN confirmation summary",()=>{
  assert.equal(core.getPrnConfirmation(enriched.find(o=>o.order_type==="regular")),null);
  assert.equal(core.getPrnConfirmation(null),null);
  assert.equal(core.getPrnConfirmation({order_type:"regular",order_priority:"stat"}),null);
});
test("missing and whitespace PRN instructions remain missing, never inferred",()=>{
  const v=core.getPrnConfirmation({order_type:"prn",indication:"  ",administration_condition:null,dose_instruction:undefined,
    route_instruction:"",frequency_instruction:"   ",maximum_limit_instruction:null,
    instruction_structure:{schema_version:1,dose:{value:"100",unit:"mg"},stale_sections:["dose"]}});
  assert.deepEqual(v,{indication:null,condition:null,dose:null,route:null,frequency:null,maximum:null});
});
test("modified order uses current revision text, not stale typed instructions",()=>{
  const original=enriched.find(o=>o.order_type==="prn");
  const updated={...original,order_revision:2,dose_instruction:"SIM NEW current dose",
    instruction_structure:{schema_version:1,dose:{value:"0.5",unit:"mg"},stale_sections:["dose"]}};
  assert.equal(core.getPrnConfirmation(updated).dose,"SIM NEW current dose");
  assert.equal(core.getPrnConfirmation(original).dose,original.dose_instruction);
});
test("search includes explicitly written PRN condition and preserves patient/PRN isolation",()=>{
  const example=enriched.find(x=>x.order_type==="prn");
  const needle="SIM-only explicit PRN condition";
  const source=enriched.map(x=>x.order_id===example.order_id?{...x,administration_condition:needle}:x);
  const results=core.getVisibleOrders(source,{patientId:example.patient_id,tab:"prn",query:needle});
  assert.ok(results.some(x=>x.order_id===example.order_id));
  assert.ok(results.every(x=>x.patient_id===example.patient_id&&x.order_type==="prn"));
  assert.equal(core.getVisibleOrders(source,{patientId:"NO-PATIENT",tab:"prn",query:needle}).length,0);
  assert.ok(raw.every(x=>x.administration_condition===undefined));
});
test("PRN all-status active-first, order count and unchanged raw dataset",()=>{
  assert.equal(core.getVisibleOrders(enriched,{patientId:"DEMO-P001",tab:"prn"}).length,4);
  assert.deepEqual(core.getVisibleOrders(enriched,{patientId:"DEMO-P001",tab:"prn"}).map(x=>x.order_status),["active","active","on-hold","stopped"]);
  assert.equal(raw.length,18);assert.equal(meds.length,107);
});
