"use strict";
/* Physician-order entry simulator. Ephemeral records only, no medical advice, no real signing. */
(function () {
  if (typeof document === "undefined") return;
  const el = id => document.getElementById(id);
  const toggle = el("composerToggle"), panel = el("composerPanel"), form = el("composerForm");
  const info = el("composerMessage"), patient = el("composerPatient"), provider = el("composerProvider"),
    med = el("composerMedication"), mode = el("composerMode"), condition = el("composerConditionRow"),
    when = el("composerWhen");
  if (![toggle,panel,form,info,patient,provider,med,mode,condition,when].every(Boolean)) return;
  const append = (select,label,value) => select.add(new Option(String(label),String(value)));
  function context() {
    if (!window.PRNComposerHost || !window.PRNOrderComposer) throw new Error("의사 처방 시뮬레이터가 아직 준비되지 않았습니다.");
    return window.PRNComposerHost.context();
  }
  function refresh() {
    const ctx=context();
    if(!ctx.ready){form.querySelector("button[type=submit]").disabled=true;return;}
    patient.textContent=ctx.patients.find(p=>p.patient_id===ctx.patientId)?.display_name+
      " ("+ctx.patientId+") · 가상 환자";
    provider.replaceChildren();
    for(const d of ctx.doctors) append(provider,d.prescriber_name+" ("+d.prescriber_id+")",d.prescriber_id);
    med.replaceChildren();
    append(med,"약물 성분을 선택하세요","");
    for(const item of ctx.catalog) append(med,item.ingredient_name_ko+" · "+item.category_name_ko,item.medication_catalog_id);
    when.value=(ctx.simulatedNow||"2026-10-10T10:30:00+09:00").slice(0,16);
    form.querySelector("button[type=submit]").disabled=false;
  }
  function updateMode() {
    const prn=mode.value==="prn";
    condition.hidden=!prn;
    el("composerCondition").required=prn;
    el("composerIndication").required=prn;
    el("composerModeHint").textContent=mode.value==="emergency"?
      "응급은 우선순위 STAT로 보존되며 PRN 자동 분류가 아닙니다.":
      prn?"PRN은 적응증과 구체적인 투여 조건이 모두 필요합니다.":
      "정규 처방은 기본 우선순위 routine으로 기록됩니다.";
  }
  toggle.addEventListener("click",()=>{
    panel.hidden=!panel.hidden;
    toggle.setAttribute("aria-expanded",String(!panel.hidden));
    if(!panel.hidden){try{refresh();}catch(e){info.textContent=e.message;}panel.scrollIntoView({block:"nearest"});}
  });
  mode.addEventListener("change",updateMode);
  document.addEventListener("prn-data-ready",()=>{if(!panel.hidden)refresh();});
  el("patientSelect").addEventListener("change",()=>{if(!panel.hidden)refresh();});
  form.addEventListener("submit",ev=>{
    ev.preventDefault();
    info.textContent="";
    try {
      const ctx=context();
      if(!ctx.ready) throw new Error("기본 자료가 준비되지 않았습니다.");
      const local=when.value;
      if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("모의 처방 시각을 입력해 주세요.");
      // Fixed +09:00 only for this synthetic Korean time-zone scenario.
      const get=id=>el(id).value;
      const data={
        patient_id:ctx.patientId,medication_catalog_id:med.value,prescriber_id:provider.value,
        mode:mode.value,dose_instruction:get("composerDose"),route_instruction:get("composerRoute"),
        frequency_instruction:get("composerFrequency"),indication:get("composerIndication"),
        administration_condition:get("composerCondition"),maximum_limit_instruction:get("composerLimit"),
        special_instruction:get("composerSpecial"),ordered_at:local+":00+09:00",
        scheduled_at:get("composerScheduled")?get("composerScheduled")+":00+09:00":null
      };
      const record=window.PRNOrderComposer.createOrder(data,ctx);
      const code=window.PRNComposerHost.addOrder(record);
      info.textContent="가상 처방 "+code+"이(가) 현재 탭의 조회 목록에 추가됐습니다. 새로고침하면 사라집니다. 실제 처방·서명 또는 투약 지시가 아닙니다.";
      form.reset();
      mode.value="regular";
      updateMode();
      // Keep the doctor panel on screen; subsequent entries see the new ID.
      refresh();
    } catch(error) {
      info.textContent="등록되지 않음: "+(error?.message||"가상 처방을 확인해 주세요.");
    }
  });
  updateMode();
})();
