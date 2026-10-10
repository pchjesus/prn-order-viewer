"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../app.js");
const getJson = file => JSON.parse(fs.readFileSync(path.join(__dirname,"..","data",file),"utf8"));
const catalog = getJson("medication_catalog_candidates.json");
const raw = getJson("simulated_orders_SCHEMA_ONLY.json");
const patients = getJson("patients.json");
const shifts = getJson("staff_shifts.json");
const reviews = getJson("verification_events.json");
const enriched = core.enrichOrders(catalog, raw);
const visible = (patientId, tab="all",query="",status="all") => core.getVisibleOrders(enriched,{patientId,tab,query,status});
test("schema integrity: 107 candidates and 18 synthetic orders",()=>{
  assert.equal(catalog.length,107); assert.equal(raw.length,18);assert.equal(core.validate(catalog,raw,patients,shifts,reviews),true);
  assert.equal(new Set(raw.map(o=>o.order_id)).size,18);
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
  assert.ok(raw.some(o=>o.dose_instruction !== null && o.frequency_instruction !== null));
  assert.ok(raw.every(o=>o.dose_review_status==="simulation_unverified" && o.is_clinically_complete===false));
  assert.equal(core.escapeHTML('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
});
test("invalid catalog refs, duplicate IDs, and order types are rejected",()=>{
  assert.throws(()=>core.validate(catalog,[raw[0],{...raw[0]}]));
  assert.throws(()=>core.validate(catalog,[{...raw[0],medication_catalog_id:"NOT-MED"}]));
  assert.throws(()=>core.validate(catalog,[{...raw[0],order_type:"fake"}]));
});


test("four different patients and corresponding simulated medical histories", () => {
  assert.equal(patients.length,4);
  assert.equal(new Set(patients.map(p=>p.patient_id)).size,4);
  assert.deepEqual(patients.map(p=>p.patient_id),["DEMO-P001","DEMO-P002","DEMO-P003","DEMO-P004"]);
  assert.ok(patients.every(p=>p.primary_problem && p.medical_history.length && p.current_condition));
  assert.equal(visible("DEMO-P004").length,4);
  assert.equal(visible("DEMO-P004","prn").length,3);
  assert.equal(visible("DEMO-P002","prn").length,0);
});

test("prescribers, example doses and referenced catalog entries retained",()=>{
  assert.ok(raw.every(o=>o.prescriber_id.startsWith("SIM-MD-") && o.prescriber_name && o.ordered_at));
  assert.ok(raw.some(o=>o.dose_instruction !== null && o.route_instruction !== null));
  assert.ok(raw.every(o=>catalog.some(m=>m.medication_catalog_id===o.medication_catalog_id)));
  assert.ok(raw.every(o=>o.original_order_text.includes("DEMO")));
});

test("a seeded acknowledgement belongs to nurse logged on during that shift",()=>{
  assert.equal(shifts.length,3);
  assert.equal(reviews.length,3);
  for(const ack of reviews) {
    const sh=shifts.find(s=>s.shift_id===ack.shift_id);
    assert.ok(sh && sh.nurse_id===ack.nurse_id);
    assert.ok(Date.parse(sh.starts_at)<=Date.parse(ack.confirmed_at));
    assert.ok(Date.parse(ack.confirmed_at)<Date.parse(sh.ends_at));
  }
  assert.equal(core.validate(catalog,raw,patients,shifts,reviews),true);
});

test("click acknowledgement inherits current login, never edits original events",()=>{
  const snapshot=JSON.stringify(reviews);
  const newReviews=core.appendAcknowledge(reviews,raw[1],shifts[0]);
  assert.equal(newReviews.length,4);
  assert.equal(newReviews[3].nurse_id,shifts[0].nurse_id);
  assert.equal(newReviews[3].shift_id,shifts[0].shift_id);
  assert.equal(newReviews[3].confirmed_at,shifts[0].simulated_now);
  assert.equal(JSON.stringify(reviews),snapshot);
  assert.throws(()=>core.appendAcknowledge(newReviews,raw[1],shifts[0]));
});

test("invalid/off-shift nurse confirmation and phantom patient are rejected",()=>{
  const off={...shifts[0],simulated_now:"2026-10-10T23:30:00+09:00"};
  assert.equal(core.canAcknowledge(raw[1],off),false);
  assert.throws(()=>core.appendAcknowledge(reviews,raw[1],off));
  assert.throws(()=>core.validate(catalog,raw,patients,shifts,[{...reviews[0],nurse_id:"SIM-RN-999"}]));
  assert.throws(()=>core.validate(catalog,[{...raw[0],patient_id:"DEMO-UNKNOWN"}],patients,shifts,[]));
});

test("review history exposes all past reviewers without mixing orders",()=>{
  const next=core.appendAcknowledge(reviews,raw[0],shifts[1]);
  const history=core.getOrderReviews(next,raw[0].order_id);
  assert.equal(history.length,2);
  assert.equal(history[0].nurse_id,shifts[1].nurse_id);
  assert.equal(history[1].nurse_id,shifts[0].nurse_id);
  assert.equal(core.getOrderReviews(next,raw[1].order_id).length,0);
});
