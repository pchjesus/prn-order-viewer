"use strict";
/* Teaching order-sheet model, modeled on two educational PDFs; NOT a real order printout. */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.PRNSheetModel=api;
})(globalThis,function(){
  function assert(ok,message){if(!ok)throw new Error(message);}
  const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
  const display=(value)=>value===null||value===undefined||String(value).trim()===""?"미기재":String(value).trim();
  function category(order){
    if(order.order_priority==="stat"||order.order_mode==="emergency")return "응급(STAT)";
    return order.order_type==="prn"?"PRN":"정규";
  }
  function timestamp(order){
    const value=order?.ordered_at;
    if(typeof value!=="string"||!(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value))||!Number.isFinite(Date.parse(value)))return null;
    return value;
  }
  function groupOrders(orders,patientId){
    assert(Array.isArray(orders)&&typeof patientId==="string"&&patientId,"잘못된 처방지 조회 대상입니다.");
    const filtered=orders.map((order,index)=>({order,index})).filter(({order})=>order&&order.patient_id===patientId);
    const groups=new Map();
    for(const {order,index} of filtered){
      const time=timestamp(order);
      const batch=order.simulated_input?"추가":"기존";
      // Order sheet grouping: date + minute + prescriber + provenance; not an actual hospital batch ID.
      const stamp=time?time.slice(0,16):"시각 미기재";
      const doctor=display(order.prescriber_name);
      const key=JSON.stringify([stamp,doctor,batch]);
      if(!groups.has(key))groups.set(key,{group_key:key,stamp,doctor,batch,firstIndex:index,orderRows:[]});
      groups.get(key).orderRows.push({
        id:display(order.order_id),
        classification:category(order),
        code:display(order.order_id), // synthetic code, never hospital's original order code
        drug:display(order.order_display_name||order.ingredient_name_ko),
        dailyDose:"미기재",   // cannot safely derive a daily dose from free text
        dailyQuantity:"미기재",
        dailyFrequency:"미기재",
        route:display(order.route_instruction),
        instruction:display(order.frequency_instruction),
        perDose:display(order.dose_instruction),
        perQuantity:"미기재",
        schedule:display(order.scheduled_at?String(order.scheduled_at).replace("T"," ").slice(0,16):null),
        prescriber:doctor,
        status:display(order.order_status),
        indication:display(order.indication),
        original:display(order.original_order_text)
      });
    }
    return [...groups.values()].sort((a,b)=>{
      // ISO timestamps share the same +09:00 offset in synthetic fixtures, yet order can be malformed.
      const aTime=a.stamp==="시각 미기재"?"":a.stamp,bTime=b.stamp==="시각 미기재"?"":b.stamp;
      return aTime.localeCompare(bTime,"ko")||a.firstIndex-b.firstIndex;
    });
  }
  function validateTeachingContexts(patients,contexts){
    assert(Array.isArray(patients)&&Array.isArray(contexts),"사례 목록이 배열이 아닙니다.");
    const ids=new Set(patients.map(x=>x.patient_id)),used=new Set();
    for(const s of contexts){
      assert(s&&typeof s.patient_id==="string"&&ids.has(s.patient_id)&&!used.has(s.patient_id),"가상 사례의 환자 ID가 없거나 중복됩니다.");
      assert(typeof s.scenario_title==="string"&&s.scenario_title.trim(),"가상 사례명이 없습니다.");
      assert(Array.isArray(s.skill_topics)&&Array.isArray(s.kardex_notes)&&Array.isArray(s.watch_points),"가상 사례의 워크리스트/Kardex 구조가 잘못되었습니다.");
      assert(s.kardex_notes.every(x=>typeof x==="string"&&x.trim()&&x.length<=500),"잘못된 인계 정보가 있습니다.");
      assert(!own(s,"patient_name")&&!own(s,"real_patient_id"),"실제 환자식별자 필드는 허용하지 않습니다.");
      used.add(s.patient_id);
    }
    assert(used.size===ids.size,"모든 가상 환자에 대해 인계 구조를 제공해야 합니다.");
    return true;
  }
  return {display,category,groupOrders,validateTeachingContexts};
});
