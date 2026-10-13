"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const patients=JSON.parse(fs.readFileSync(path.join(root,"data/patients.json"),"utf8"));
const profiles=JSON.parse(fs.readFileSync(path.join(root,"data/patient_profiles.json"),"utf8"));
const orders=JSON.parse(fs.readFileSync(path.join(root,"data/simulated_orders_SCHEMA_ONLY.json"),"utf8"));
const Profile=require("../patient-profile-model.js");
const M=require("../roster-library-model.js");
const config=require("../roster-import-config.js");
const parser=require("../roster-import-parser.js");
const scripts=["app.js","doctor-ui.js","history-ui.js","order-sheet-ui.js","roster-library-ui.js","roster-library-store.js"];
test("baseline four patients and eighteen unchanged synthetic orders",()=>{
 assert.equal(patients.length,4);assert.equal(orders.length,18);
 assert.equal(profiles.length,4);assert.equal(Profile.validate(patients,profiles),true);
});
test("each primary physician belongs to that patient context, prescriber records unchanged",()=>{
 for(const profile of profiles){
  const recorded=orders.filter(o=>o.patient_id===profile.patient_id);
  assert.ok(recorded.some(o=>o.prescriber_id===profile.primary_physician.id));
  assert.ok(Profile.rows(profile,patients.find(p=>p.patient_id===profile.patient_id)).length>=8);
 }
 assert.equal(new Set(orders.map(o=>o.prescriber_id)).size,5);
});
test("unknown allergy and missing vitals are not fabricated negatives",()=>{
 for(const profile of profiles){
  assert.equal(profile.allergy.status,"unknown");
  assert.equal(profile.assessments.vitals.status,"not_provided");
  assert.equal(profile.assessments.labs.status,"not_provided");
  assert.equal(profile.assessments.device_status.status,"not_provided");
  const rows=Profile.rows(profile,patients.find(p=>p.patient_id===profile.patient_id));
  assert.equal(rows.find(r=>r[0]==="알레르기")[1],"미확인");
  assert.equal(rows.find(r=>r[0]==="활력징후")[1],"측정 자료 미제공");
 }
});
test("patient profiles reject duplicated identifiers",()=>{
 const duplicated=profiles.map(x=>JSON.parse(JSON.stringify(x)));
 duplicated[1].patient_id=duplicated[0].patient_id;
 assert.throws(()=>Profile.validate(patients,duplicated));
});
test("MICU pure parser reads Excel-like cell matrices without storage coupling",()=>{
 const head=["번호","이름",1,2,3];
 const parsed=parser.parseRows([head,[1,"정하늘","D","E","N"],[2,"이서연","N","D","NC"]],{});
 assert.equal(parsed.all.length,2);assert.equal(parsed.shifts["2"][1],"D");
 assert.equal(config.ruleProfiles["micu-v1"].dutyCodes.NC,"N");
 const record=M.make(parsed,2026,10,"2026_10_synthetic.xlsx","Sheet1");
 assert.equal(M.validate(record),true);
 assert.equal(M.onDuty(record,"2026-10-02","D").length,1);
 assert.equal(M.onDuty(record,"2026-10-03","N").length,2);
 assert.deepEqual(M.onDuty(record,"2026-11-02","D"),[]);
 assert.ok(!("sourceBlob" in record));
});
test("roster import rejects impossible months, invalid day lengths and raw Excel bytes",()=>{
 const r={id:"2026-02",year:2026,month:2,fileName:"demo.xlsx",source:"synthetic-authorized",all:[{name:"가상",group:"저연차"}],shifts:{"30":["D"]}};
 assert.throws(()=>M.validate(r));
 r.shifts={"2":["D"]};r.fileBuffer="bytes";
 assert.throws(()=>M.validate(r));
 delete r.fileBuffer;assert.equal(M.validate(r),true);
 assert.throws(()=>M.onDuty(r,"bad","D"));
});
test("Kardex and Excel browser scripts remain separate from existing order modules",()=>{
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.ok(html.includes("v0.6.0"));
 for(const p of ["patient-profile-model.js","vendor/xlsx.full.min.js","roster-library-ui.js"])
   assert.ok(html.includes("./"+p));
 for(const p of scripts){
  const text=fs.readFileSync(path.join(root,p),"utf8");
  assert.ok(!text.includes("localStorage.setItem("));
 }
 const roster=fs.readFileSync(path.join(root,"roster-library-store.js"),"utf8");
 assert.ok(roster.includes("prnRosterTeachingDB_v1"));
 assert.ok(!roster.includes("fireEvacuationRosterDB_v0617"));
 const sheet=fs.readFileSync(path.join(root,"order-sheet-ui.js"),"utf8");
 assert.ok(sheet.includes("kardex-type-fold"));
 assert.ok(sheet.includes("kardex-order-item"));
});
