"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const html=read("index.html"),nav=read("workspace-nav.js"),css=read("styles.css");
test("exactly six independent workspace destinations",()=>{
  for(const page of ["orders","patient","handoff","doctor","history","roster"]){
    assert.ok(html.includes('data-nav="'+page+'"'));
    assert.ok(html.includes('data-page="'+page+'"'));
  }
  assert.equal((html.match(/data-nav=/g)||[]).length,6);
});
test("orders remain first active screen, selected patient shared outside routed sections",()=>{
  assert.ok(html.includes('<main class="workspace" data-view="orders">'));
  assert.ok(html.includes('data-nav="orders" aria-current="page"'));
  assert.ok(html.indexOf('id="patientSelect"')<html.indexOf('data-page="patient"'));
  assert.ok(!html.includes('data-page="patient" data-page="'));
});
test("navigation is display-only and does not touch clinical data or browser storage",()=>{
  assert.ok(nav.includes('workspace.dataset.view=view'));
  assert.ok(nav.includes('section.hidden=section.dataset.page!==view'));
  assert.ok(nav.includes('aria-current'));
  for(const keyword of ["localStorage","indexedDB","state.orders","getHistory","updateOrder","save","fetch("]){
    assert.equal(nav.includes(keyword),false);
  }
});
test("mobile layout and hidden routed panels supported without modifying core markup",()=>{
  assert.ok(css.includes('@media(max-width:700px)'));
  assert.ok(css.includes('.sidebar-links{flex-direction:row'));
  assert.ok(css.includes('[data-page][hidden],[hidden]{display:none!important}'));
  assert.ok(html.includes('id="historyForm"'));
  assert.ok(html.includes('id="sheetPanel" hidden'));
});
