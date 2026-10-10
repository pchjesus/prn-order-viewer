"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {createHash, webcrypto} = require("node:crypto");
const bridge = require("../roster-bridge.js");

function exampleBackup() {
  const body = {
    format:"micu-full-backup", formatVersion:1, appVersion:"0.7.4",
    createdAt:"2026-10-10T01:00:00.000Z",
    data:{
      rosters:[{
        id:"2026-10",year:2026,month:10,
        all:[{name:"교육용A",group:"Charge"},{name:"교육용B",group:"저연차"},{name:"교육용C",group:"저연차"},{name:"교육용D",group:"저연차"}],
        shifts:{"10":["D","NC","D","OF"],"11":["E","N","N","N"]},
        ruleSnapshot:{dutyCodes:{D:"D",E:"E",N:"N",NC:"N"}},
        groups:[{name:"Charge"},{name:"저연차"}]
      }],
      personnel:[{id:"2026-10",profiles:{"source:2026-10:0":{name:"교육용A 변경",group:"Charge",kind:"nurse"}},contexts:{
        "2026-10-10-D":{added:[{id:"added:simulation",name:"교육용추가",group:"중간년차",kind:"nurse"}],excluded:["source:2026-10:2"]}
      }}],
      overrides:[],
      meta:[{id:"activeRosterId",value:"2026-10"}],
      logs:[]
    }
  };
  const checksum = createHash("sha256").update(JSON.stringify(bridge.canonical(body))).digest("hex");
  return {...body,checksum:{algorithm:"SHA-256",value:checksum}};
}
test("MICU snapshot converts to read-only D duty, respecting profile/exclusion/addition", async () => {
  const backup=exampleBackup();
  const result=await bridge.importBackupText(JSON.stringify(backup),"2026-10-10","D",webcrypto);
  assert.equal(result.people.length,2);
  assert.deepEqual(result.people.map(p=>p.name),["교육용A 변경","교육용추가"]);
  assert.equal(result.loginVerified,false);
  assert.equal(result.date,"2026-10-10");
  assert.equal(result.duty,"D");
});
test("NC maps to N and empty duty is distinguishable from missing date", async () => {
  const backup=exampleBackup();
  const n=await bridge.importBackupText(JSON.stringify(backup),"2026-10-10","N",webcrypto);
  assert.deepEqual(n.people.map(p=>p.name),["교육용B"]);
  const e=await bridge.importBackupText(JSON.stringify(backup),"2026-10-10","E",webcrypto);
  assert.deepEqual(e.people,[]);
  await assert.rejects(bridge.importBackupText(JSON.stringify(backup),"2026-10-12","D",webcrypto),/날짜의 근무표/);
});
test("tampered backups reject before reading any on-duty names", async () => {
  const bad=exampleBackup();
  bad.data.rosters[0].all[0].name="무단변경";
  await assert.rejects(bridge.importBackupText(JSON.stringify(bad),"2026-10-10","D",webcrypto),/검증값/);
  assert.throws(()=>bridge.getOnDuty({}, "2026-10-10","D"),/구조/);
});
test("unsupported version, missing active roster, other month and invalid date fail closed", async () => {
  const bad=exampleBackup();
  bad.formatVersion=2;
  await assert.rejects(bridge.importBackupText(JSON.stringify(bad),"2026-10-10","D",webcrypto),/지원하지 않는/);
  const source=exampleBackup().data;
  assert.throws(()=>bridge.getOnDuty({...source,meta:[]},"2026-10-10","D"),/활성/);
  assert.throws(()=>bridge.getOnDuty(source,"2026-09-10","D"),/활성/);
  assert.throws(()=>bridge.getOnDuty(source,"2026-02-30","D"),/유효하지 않은/);
  assert.throws(()=>bridge.getOnDuty(source,"2026-10-10","NC"),/D\/E\/N/);
});
test("bridge never mutates original MICU snapshot or adds patient, login, or acknowledgement data", async () => {
  const backup=exampleBackup(),before=JSON.stringify(backup);
  const result=await bridge.importBackupText(JSON.stringify(backup),"2026-10-10","D",webcrypto);
  assert.equal(JSON.stringify(backup),before);
  assert.deepEqual(Object.keys(result).sort(),["date","duty","loginVerified","people","rosterId","source"].sort());
  assert.equal(result.people.every(person=>!("patient_id" in person) && !("login_id" in person) && !("confirmed_at" in person)),true);
});
