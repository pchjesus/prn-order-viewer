"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const structured=require("../order-structure.js"),composer=require("../order-composer.js");
const history=require("../order-history-model.js"),core=require("../app.js");
const json=name=>JSON.parse(fs.readFileSync(path.join(__dirname,"..","data",name),"utf8"));
const catalog=json("medication_catalog_candidates.json"),patients=json("patients.json"),
  original=json("simulated_orders_SCHEMA_ONLY.json"),shifts=json("staff_shifts.json"),reviews=json("verification_events.json");
const doctors=[...new Map(original.map(o=>[o.prescriber_id,{prescriber_id:o.prescriber_id,prescriber_name:o.prescriber_name}])).values()];
const context={patients,catalog,existing:original,doctors};
const base={patient_id:patients[0].patient_id,medication_catalog_id:catalog[0].medication_catalog_id,
  prescriber_id:doctors[0].prescriber_id,ordered_at:"2026-10-10T10:30:00+09:00",
  mode:"prn",indication:"SIM symptom",administration_condition:"SIM explicit condition"};
const typed={product_name:"TEST product",dosage_form:"TEST form",strength_text:"TEST strength",
  dose_value:"0.5",dose_unit:"mg",route_code:"oral",frequency_count:"2",frequency_period:"day",
  interval_value:"6",interval_unit:"hour",administration_times:"08:00,20:00",
  max_dose_value:"1",max_dose_unit:"mg",max_count:"3",max_count_period:"hours24"};
const make=changes=>composer.createOrder({...base,structured_fields:typed,...changes},context);
test("original 107 candidates, 4 patients and 18 orders remain unchanged and valid",()=>{
  assert.equal(catalog.length,107);assert.equal(patients.length,4);assert.equal(original.length,18);
  assert.equal(core.validate(catalog,original,patients,shifts,reviews),true);
  assert.ok(original.every(o=>o.instruction_structure===undefined));
});
test("legacy free-text entries are preserved with null optional structure",()=>{
  const record=composer.createOrder({...base,dose_instruction:"SIM dose",route_instruction:"SIM route",
    frequency_instruction:"SIM freq",structured_fields:{}},context);
  assert.equal(record.dose_instruction,"SIM dose");assert.equal(record.route_instruction,"SIM route");
  assert.equal(record.instruction_structure,null);assert.equal(record.is_clinically_complete,false);
});
test("explicit structured fields stay separate from legacy display instructions",()=>{
  const item=make();
  assert.equal(item.dose_instruction,"0.5 mg");assert.equal(item.route_instruction,"PO");
  assert.match(item.frequency_instruction,/6시간 간격/);
  assert.match(item.maximum_limit_instruction,/24시간 최대 3회/);
  assert.deepEqual(item.instruction_structure.dose,{value:"0.5",unit:"mg"});
  assert.deepEqual(item.instruction_structure.route,{code:"oral",display:"PO"});
  assert.equal(item.instruction_structure.product.name,"TEST product");
  assert.deepEqual(item.instruction_structure.schedule.times,["08:00","20:00"]);
  assert.equal(item.instruction_structure.verification_status,"simulation_unverified");
  assert.equal(item.is_clinically_complete,false);
  assert.equal(core.validate(catalog,[item],patients),true);
});
test("PRN criteria are explicit but STAT remains independent",()=>{
  const prn=make(),stat=make({mode:"emergency",indication:"",administration_condition:""});
  assert.deepEqual([prn.order_type,prn.order_priority],["prn","routine"]);
  assert.deepEqual([stat.order_type,stat.order_priority],["regular","stat"]);
  assert.equal(stat.instruction_structure.prn,null);
});
test("typed fields reject missing pairs, invalid routes, zero values, duplicate clock times",()=>{
  const bad=[
    {dose_value:"1"},{dose_unit:"mg"},{route_code:"INVENTED"},
    {interval_value:"6"},{frequency_count:"2"},{max_count:"3"},
    {dose_value:"0",dose_unit:"mg"},{administration_times:"24:00"},
    {administration_times:"08:00,08:00"},{max_dose_value:"1"}
  ];
  for(const item of bad)assert.throws(()=>structured.compose({structured_fields:item}),undefined,JSON.stringify(item));
});
test("conflicting explicit values and free-text instructions are rejected, not silently overwritten",()=>{
  assert.throws(()=>make({dose_instruction:"SIM 20 mg"}),/중복/);
  assert.throws(()=>make({route_instruction:"SIM IV"}),/중복/);
  assert.throws(()=>make({frequency_instruction:"SIM OTHER"}),/중복/);
  assert.throws(()=>make({maximum_limit_instruction:"SIM limit"}),/중복/);
});
test("patient partition, order identity and new revision stay correct",()=>{
  const o=make();
  const orders=core.enrichOrders(catalog,[...original,o]);
  assert.equal(core.getVisibleOrders(orders,{patientId:patients[1].patient_id,tab:"prn"}).some(x=>x.order_id===o.order_id),false);
  const events=history.createAddEvent(orders,[],o);
  const revision=history.transition(orders,events,{order_id:o.order_id,patient_id:o.patient_id,
    action:"revise",actor_id:o.prescriber_id,actor_name:o.prescriber_name,
    reason:"SIM revision",occurred_at:"2026-10-10T12:00:00+09:00",
    changes:{dose_instruction:"SIM NEW dose",route_instruction:"SIM NEW route"}});
  const updated=revision.orders.find(x=>x.order_id===o.order_id);
  assert.equal(updated.order_revision,1);assert.equal(updated.order_id,o.order_id);
  assert.deepEqual(updated.instruction_structure.stale_sections,["dose","route"]);
  assert.equal(structured.section(updated,"dose"),null);
  assert.ok(structured.section(updated,"schedule"));
  assert.deepEqual(revision.event.before.instruction_structure.stale_sections,[]);
  assert.equal(revision.event.before.dose_instruction,"0.5 mg");
  assert.equal(revision.event.after.dose_instruction,"SIM NEW dose");
  assert.equal(core.validate(catalog,revision.orders,patients,shifts,reviews),true);
});
test("earlier nurse acknowledgements never acknowledge the new revision",()=>{
  const source=core.enrichOrders(catalog,original);
  const target=source.find(o=>reviews.some(x=>x.order_id===o.order_id));
  const modified=history.transition(source,[],{order_id:target.order_id,patient_id:target.patient_id,
    action:"revise",actor_id:target.prescriber_id,actor_name:target.prescriber_name,
    reason:"SIM review",occurred_at:"2026-10-10T12:00:00+09:00",
    changes:{dose_instruction:"SIM revised"}});
  const revised=modified.orders.find(o=>o.order_id===target.order_id);
  assert.equal(revised.order_revision,1);
  assert.equal(reviews.filter(r=>r.order_id===target.order_id&&r.order_revision===1).length,0);
  assert.equal(core.canAcknowledge(revised,shifts[0]),false);
  assert.equal(modified.event.after.order_revision,1);
});
