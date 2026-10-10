"use strict";
/* In-memory physician order history UI. Never writes patient, roster or nurse acknowledgement storage. */
(function(){
  if(typeof document==="undefined")return;
  const $=id=>document.getElementById(id);
  const form=$("historyForm"),selector=$("historyOrder"),action=$("historyAction"),
    doctor=$("historyDoctor"),reason=$("historyReason"),clock=$("historyWhen"),
    fields=$("historyRevisionFields"),feedback=$("historyFeedback"),listing=$("historyEvents");
  if(![form,selector,action,doctor,reason,clock,fields,feedback,listing].every(Boolean))return;
  const node=(tag,text,className)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n;};
  const context=()=>window.PRNComposerHost?.context();
  function refreshSelect(){
    const ctx=context();
    if(!ctx?.ready)return;
    const old=selector.value;
    selector.replaceChildren();
    for(const o of ctx.existing.filter(o=>o.patient_id===ctx.patientId)){
      const item=new Option(o.order_id+" · "+(o.ingredient_name_ko||o.order_display_name)+" · "+o.order_status,o.order_id);
      selector.add(item);
    }
    if([...selector.options].some(o=>o.value===old))selector.value=old;
    const previous=doctor.value;
    doctor.replaceChildren();
    for(const d of ctx.doctors)doctor.add(new Option(d.prescriber_name+" ("+d.prescriber_id+")",d.prescriber_id));
    if([...doctor.options].some(o=>o.value===previous))doctor.value=previous;
    clock.value=(ctx.simulatedNow||"2026-10-10T10:30:00+09:00").slice(0,16);
  }
  function viewHistory(){
    listing.replaceChildren();
    const ctx=context();if(!ctx?.ready)return;
    const entries=window.PRNHistoryModel.patientHistory(window.PRNComposerHost.getHistory(),ctx.patientId);
    if(!entries.length){listing.appendChild(node("p","현재 탭에서 발생한 처방 변경 이력이 없습니다. 기존 가상 처방에는 과거 변경 이벤트가 입력돼 있지 않습니다.","history-none"));return;}
    for(const e of entries){
      const item=node("article",undefined,"history-record");
      item.appendChild(node("h4",window.PRNHistoryModel.ACTIONS[e.action]+" · "+e.order_id));
      item.appendChild(node("p",e.actor_name+" · "+e.occurred_at+" · "+e.reason));
      const before=e.before||{},after=e.after||{};
      const parts=[];
      for(const key of ["order_status","dose_instruction","route_instruction","frequency_instruction","indication","administration_condition"]){
        if(before[key]!==after[key]){
          const labels={order_status:"상태",dose_instruction:"1회량",route_instruction:"경로",frequency_instruction:"빈도/시간",indication:"적응증",administration_condition:"PRN 조건"};
          parts.push(labels[key]+": "+(before[key]??"없음")+" → "+(after[key]??"없음"));
        }
      }
      if(e.action==="add")parts.unshift("신규 처방 등록(시뮬레이션)");
      for(const line of parts)item.appendChild(node("p",line,"history-diff"));
      listing.appendChild(item);
    }
  }
  function configureAction(){
    const revise=action.value==="revise";
    fields.hidden=!revise;
    for(const input of fields.querySelectorAll("input")){
      input.disabled=!revise;
      input.required=revise;
    }
    if(revise){
      const ctx=context(),o=ctx?.existing.find(x=>x.order_id===selector.value);
      $("historyDose").value=o?.dose_instruction||"";
      $("historyRoute").value=o?.route_instruction||"";
      $("historyFrequency").value=o?.frequency_instruction||"";
    }
  }
  function resetDraft(){
    form.reset();reason.value="";
    action.value="hold";
    configureAction();
    refreshSelect();
  }
  form.addEventListener("submit",event=>{
    event.preventDefault();
    feedback.textContent="";
    const ctx=context();if(!ctx?.ready){feedback.textContent="기본 데이터를 아직 불러오지 못했습니다.";return;}
    const person=ctx.doctors.find(d=>d.prescriber_id===doctor.value);
    if(!person){feedback.textContent="가상의사를 선택해 주세요.";return;}
    const now=clock.value;
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(now)){feedback.textContent="가상 변경 시각을 선택해 주세요.";return;}
    const input={order_id:selector.value,patient_id:ctx.patientId,action:action.value,
      actor_id:person.prescriber_id,actor_name:person.prescriber_name,reason:reason.value,
      occurred_at:now+":00+09:00"};
    if(action.value==="revise"){
      input.changes={
        dose_instruction:$("historyDose").value,
        route_instruction:$("historyRoute").value,
        frequency_instruction:$("historyFrequency").value
      };
    }
    try{
      const id=window.PRNComposerHost.updateOrder(input);
      feedback.textContent=id+" · 가상 처방 변경이 기록됐습니다. 새로고침하면 이 이력은 사라집니다.";
      refreshSelect();viewHistory();
    }catch(err){feedback.textContent="변경되지 않음: "+(err?.message||"확인 필요");}
  });
  action.addEventListener("change",configureAction);
  selector.addEventListener("change",()=>{
    const ctx=context(),o=ctx?.existing.find(x=>x.order_id===selector.value);
    $("historyDose").value=o?.dose_instruction||"";
    $("historyRoute").value=o?.route_instruction||"";
    $("historyFrequency").value=o?.frequency_instruction||"";
  });
  document.addEventListener("prn-data-ready",()=>{refreshSelect();configureAction();viewHistory();});
  document.addEventListener("prn-orders-changed",()=>{refreshSelect();configureAction();viewHistory();});
  $("patientSelect")?.addEventListener("change",()=>{resetDraft();viewHistory();});
  refreshSelect();configureAction();
})();
