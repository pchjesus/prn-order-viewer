"use strict";
/* A UI-independent, synthetic physician-order factory. Not a prescribing or clinical decision system. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PRNOrderComposer = api;
})(globalThis, function () {
  const MODES = Object.freeze(["regular", "prn", "emergency"]);
  const PRIORITY = Object.freeze({regular:"routine",prn:"routine",emergency:"stat"});
  const LIMITS = Object.freeze({dose:120,route:100,frequency:180,indication:180,condition:300,max:180,special:600});
  const trim = (value,max) => String(value ?? "").trim().slice(0,max);
  function assert(value, message) { if (!value) throw new Error(message); }
  function generateOrderId(existing) {
    const ids = new Set((existing || []).map(item => item.order_id));
    for(let n=1;n<1000000;n++){
      const id="SIM-ORD-NEW-"+String(n).padStart(6,"0");
      if(!ids.has(id))return id;
    }
    throw new Error("가상 처방 ID 공간을 모두 사용했습니다.");
  }
  function createOrder(input,context) {
    assert(input && typeof input === "object" && context && typeof context === "object","입력 데이터가 올바르지 않습니다.");
    const {patients,catalog,existing,doctors} = context;
    assert(Array.isArray(patients)&&Array.isArray(catalog)&&Array.isArray(existing)&&Array.isArray(doctors),"기본 데이터가 준비되지 않았습니다.");
    const patient=patients.find(p=>p.patient_id===input.patient_id);
    const medicine=catalog.find(m=>m.medication_catalog_id===input.medication_catalog_id);
    const doctor=doctors.find(d=>d.prescriber_id===input.prescriber_id);
    assert(patient && medicine && doctor,"환자·약물·처방자 중 선택할 수 없는 항목이 있습니다.");
    assert(MODES.includes(input.mode),"처방 형태를 확인해 주세요.");
    const order_type=input.mode==="prn"?"prn":"regular";
    const priority=PRIORITY[input.mode];
    const dose=trim(input.dose_instruction,LIMITS.dose);
    const route=trim(input.route_instruction,LIMITS.route);
    const freq=trim(input.frequency_instruction,LIMITS.frequency);
    const indication=trim(input.indication,LIMITS.indication);
    const condition=trim(input.administration_condition,LIMITS.condition);
    const maximum=trim(input.maximum_limit_instruction,LIMITS.max);
    const special=trim(input.special_instruction,LIMITS.special);
    assert(dose && route && freq,"가상 1회 용량·경로·투여 시간/빈도를 모두 입력해 주세요.");
    if(input.mode==="prn")assert(indication && condition,"PRN에는 적응증과 구체적인 투여 조건이 필요합니다.");
    const orderedAt=String(input.ordered_at ?? "");
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(orderedAt) && Number.isFinite(Date.parse(orderedAt)),
      "가상 처방 작성시각을 확인해 주세요.");
    const schedule=trim(input.scheduled_at,35);
    if(schedule)assert(Number.isFinite(Date.parse(schedule)), "가상 예정 시각을 확인해 주세요.");
    const modeLabel={regular:"정규",prn:"PRN",emergency:"응급(STAT)"}[input.mode];
    const orderId=generateOrderId(existing);
    const result={
      order_id:orderId, order_domain:"medication", order_mode:input.mode,
      order_priority:priority, order_type, order_status:"active",
      order_display_name:"[DEMO] "+medicine.ingredient_name_ko+" / "+modeLabel,
      patient_id:patient.patient_id,medication_catalog_id:medicine.medication_catalog_id,
      prescriber_id:doctor.prescriber_id,prescriber_name:doctor.prescriber_name,ordered_at:orderedAt,
      dose_instruction:dose,route_instruction:route,frequency_instruction:freq,
      indication:indication||null,administration_condition:condition||null,
      maximum_limit_instruction:maximum||null,special_instruction:special||null,
      scheduled_at:schedule||null,
      original_order_text:"[DEMO] "+medicine.ingredient_name_ko+" / "+modeLabel+
        "\n1회: "+dose+" · 경로: "+route+" · 빈도·시간: "+freq+
        (indication?"\n적응증: "+indication:"")+(condition?"\nPRN 조건: "+condition:"")+
        (schedule?"\n모의 예정: "+schedule:"")+(maximum?"\n최대 지시: "+maximum:"")+
        (special?"\n기타: "+special:""),
      is_clinically_complete:false,dose_review_status:"simulation_unverified",
      scenario_note:"의사 처방 입력 화면에서 작성한 현재 탭 한정 교육용 사례",
      simulated_input:true
    };
    return result;
  }
  function createEnvelope(order) {
    assert(order && order.order_domain==="medication" && order.order_id && order.patient_id,"약물 처방 구조가 올바르지 않습니다.");
    return {envelope_version:1,request_id:order.order_id,patient_id:order.patient_id,
      domain:"medication",mode:order.order_mode,priority:order.order_priority,
      status:order.order_status,prescriber_id:order.prescriber_id,ordered_at:order.ordered_at,
      medication_order_id:order.order_id,related_service_request_id:null};
  }
  return {MODES,PRIORITY,generateOrderId,createOrder,createEnvelope};
});
