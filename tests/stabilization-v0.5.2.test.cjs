"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../app.js");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const orders = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "simulated_orders_SCHEMA_ONLY.json"), "utf8"));

test("v0.5.2 marks current preview as education-only and leaves base orders untouched", () => {
  assert.match(html, /v0\.5\.2|v0\.6\.0/);
  assert.ok(html.includes("PRN 조건 검색"));
  assert.equal(orders.length, 18);
  assert.ok(orders.every(o => !Object.hasOwn(o, "administration_condition")));
});
test("missing simulated PRN conditions are not inferred or substituted", () => {
  const p = orders.find(o => o.order_type === "prn");
  assert.equal(core.getPrnConfirmation(p).condition, null);
  assert.equal(core.getPrnConfirmation({...p, administration_condition: "SIM explicit"}).condition, "SIM explicit");
});
test("list only shows separately entered conditions and does not repeat missing badges", () => {
  assert.ok(app.includes('o.order_type==="prn"&&!miss(o.administration_condition)'));
  assert.ok(app.includes('PRN 조건: ${e(o.administration_condition)}'));
  assert.ok(!app.includes('PRN 조건: ${miss(o.administration_condition)?"미기재"'));
});
test("PRN core fields appear once in detail; non PRN detail fields still available", () => {
  for (const name of ["1회 용량", "투여 경로", "적응증", "투여 빈도·간격", "최대량·횟수 지시", "PRN 투여 조건"]) {
    assert.ok(app.includes('prn ? "" : field("'+name+'"'));
    assert.ok(app.includes('field("'+name+'"'));
  }
  assert.ok(app.includes('const prnBrief = prn ?'));
});
test("search, read acknowledgement, and version-specific history functions stay present", () => {
  assert.ok(app.includes('order.indication, order.administration_condition'));
  assert.ok(app.includes('appendAcknowledge(state.reviews, order, currentShift())'));
  assert.ok(app.includes('currentRevisionAcknowledged'));
  assert.ok(app.includes('state.orderEvents=change.events'));
  assert.ok(!app.includes('localStorage.setItem('));
});
