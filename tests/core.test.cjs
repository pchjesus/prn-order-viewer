"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../app.js");
const getJson = file => JSON.parse(fs.readFileSync(path.join(__dirname,"..","data",file),"utf8"));
const catalog = getJson("medication_catalog_candidates.json");
const raw = getJson("simulated_orders_SCHEMA_ONLY.json");
const enriched = core.enrichOrders(catalog, raw);
const visible = (patientId, tab="all",query="",status="all") => core.getVisibleOrders(enriched,{patientId,tab,query,status});
test("schema integrity: 107 candidates and 14 synthetic orders",()=>{
  assert.equal(catalog.length,107); assert.equal(raw.length,14);assert.equal(core.validate(catalog,raw),true);
  assert.equal(new Set(raw.map(o=>o.order_id)).size,14);
  assert.ok(raw.every(o=>o.is_clinically_complete===false));
});
test("default all orders include both PRN and regular",()=>{
  assert.equal(visible("DEMO-P001").length,6);
  assert.ok(visible("DEMO-P001").some(x=>x.order_type==="regular"));
  assert.ok(visible("DEMO-P001").some(x=>x.order_type==="prn"));
});
test("PRN tab shows all statuses and active first",()=>{
  const list=visible("DEMO-P001","prn");
  assert.equal(list.length,4);
  assert.deepEqual(list.map(o=>o.order_status),["active","active","on-hold","stopped"]);
  assert.equal(visible("DEMO-P003","prn").length,5);
});
test("status filter and search combine, case insensitive and code search",()=>{
  assert.equal(visible("DEMO-P003","prn","살부타몰","stopped").length,1);
  assert.equal(visible("DEMO-P001","all","SIM-ORD-000001").length,1);
  assert.equal(visible("DEMO-P001","prn","통증").length,1);
  assert.equal(visible("DEMO-P001","prn","없는 약물").length,0);
});
test("patient isolation, PRN empty patient, and order IDs stay separate",()=>{
  assert.deepEqual(visible("DEMO-P002","prn"),[]);
  assert.ok(visible("DEMO-P003").every(o=>o.patient_id==="DEMO-P003"));
  assert.equal(visible("DEMO-P003","prn","살부타몰").length,2);
  assert.notEqual(visible("DEMO-P003","prn","살부타몰")[0].order_id,visible("DEMO-P003","prn","살부타몰")[1].order_id);
});
test("filter/sort do not mutate authoritative orders",()=>{
  const snapshot=JSON.stringify(enriched);
  visible("DEMO-P003","prn");visible("DEMO-P001","prn","", "on-hold");
  assert.equal(JSON.stringify(enriched),snapshot);
});
test("missing clinical values stay missing, and potentially unsafe HTML is escaped",()=>{
  assert.ok(raw.some(o=>o.indication===null));
  assert.ok(raw.every(o=>o.dose_instruction===null && o.frequency_instruction===null));
  assert.equal(core.escapeHTML('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
});
test("invalid catalog refs, duplicate IDs, and order types are rejected",()=>{
  assert.throws(()=>core.validate(catalog,[raw[0],{...raw[0]}]));
  assert.throws(()=>core.validate(catalog,[{...raw[0],medication_catalog_id:"NOT-MED"}]));
  assert.throws(()=>core.validate(catalog,[{...raw[0],order_type:"fake"}]));
});
