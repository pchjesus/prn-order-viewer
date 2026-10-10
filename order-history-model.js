"use strict";
/* In-memory order revisions only. Not real clinical orders, credentials, or audit logs. */
(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.PRNHistoryModel=api;})(globalThis,function(){
  const STATES=Object.freeze(["active","on-hold","stopped","cancelled"]);
  const ACTIONS=Object.freeze({add:"추가",revise:"변경",hold:"보류",resume:"재개",stop:"중지(D/C)",cancel:"취소"});
  const copy=value=>JSON.parse(JSON.stringify(value));
  const text=(x,n)=>String(x??"").trim().slice(0,n);
  const requireValid=(condition,message)=>{if(!condition)throw Error(message);};
  const validTime=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
  function nextId(events){const ids=new Set(events.map(e=>e.event_id));for(let i=1;i<1000000;i++){const id="SIM-OEVENT-"+String(i).padStart(6,"0");if(!ids.has(id))return id;}throw Error("이벤트 ID 공간이 부족합니다.");}
  function createAddEvent(orders,events,order){
    requireValid(Array.isArray(orders)&&Array.isArray(events)&&order?.simulated_input&&orders.some(x=>x.order_id===order.order_id),"기록할 가상 처방이 없습니다.");
    requireValid(validTime(order.ordered_at),"처방 시각이 올바르지 않습니다.");
    requireValid(!events.some(e=>e.order_id===order.order_id&&e.action==="add"),"이미 등록한 가상 처방입니다.");
    const event={event_id:nextId(events),action:"add",order_id:order.order_id,patient_id:order.patient_id,
      occurred_at:order.ordered_at,actor_id:order.prescriber_id,actor_name:order.prescriber_name,
      reason:"가상 신규 처방",before:null,after:copy(order),session_only:true};
    return [...events,event];
  }
  function transition(orders,events,input){
    requireValid(Array.isArray(orders)&&Array.isArray(events)&&input&&typeof input==="object","처방 이력 데이터 형식이 올바르지 않습니다.");
    const index=orders.findIndex(o=>o.order_id===input.order_id&&o.patient_id===input.patient_id);
    requireValid(index>=0,"현재 환자의 처방만 변경할 수 있습니다.");
    const current=orders[index], action=input.action;
    requireValid(["revise","hold","resume","stop","cancel"].includes(action),"지원하지 않는 변경 유형입니다.");
    requireValid(validTime(input.occurred_at)&&Date.parse(input.occurred_at)>=Date.parse(current.ordered_at),
      "변경 시각이 원래 처방 시각보다 앞서거나 유효하지 않습니다.");
    const actorId=text(input.actor_id,64),actorName=text(input.actor_name,100),reason=text(input.reason,300);
    requireValid(actorId&&actorName&&reason,"가상의사·변경 사유를 입력해야 합니다.");
    requireValid(!["stopped","cancelled","completed","entered-in-error"].includes(current.order_status),"이미 종료·취소된 처방을 변경할 수 없습니다.");
    const statusNext={hold:"on-hold",resume:"active",stop:"stopped",cancel:"cancelled"};
    if(action==="hold")requireValid(current.order_status==="active","유효한 처방만 보류할 수 있습니다.");
    if(action==="resume")requireValid(current.order_status==="on-hold","보류 처방만 재개할 수 있습니다.");
    if(action==="stop"||action==="cancel")requireValid(["active","on-hold"].includes(current.order_status),"이 처방을 종료할 수 없습니다.");
    if(action==="revise")requireValid(["active","on-hold"].includes(current.order_status),"이 처방은 수정할 수 없습니다.");
    const next={...current};
    if(action==="revise"){
      const changes=input.changes||{};
      requireValid(Object.keys(changes).length>0&&Object.keys(changes).every(k=>["dose_instruction","route_instruction","frequency_instruction","indication","administration_condition"].includes(k)),
        "변경 가능한 처방 필드가 없습니다.");
      let changed=false;
      for(const [key,v] of Object.entries(changes)){
        const candidate=text(v,key==="administration_condition"?300:180);
        requireValid(candidate,"빈 값으로 변경할 수 없습니다.");
        if(next[key]!==candidate){next[key]=candidate;changed=true;}
      }
      requireValid(changed,"실제 변경된 항목이 없습니다.");
      if(next.order_type==="prn")requireValid(text(next.indication,180)&&text(next.administration_condition,300),"PRN 조건을 확인해 주세요.");
    } else next.order_status=statusNext[action];
    next.order_revision=(current.order_revision||0)+1;
    next.last_modified_at=input.occurred_at;
    next.last_modifier_id=actorId;
    next.last_modifier_name=actorName;
    const event={event_id:nextId(events),action,order_id:current.order_id,patient_id:current.patient_id,
      occurred_at:input.occurred_at,actor_id:actorId,actor_name:actorName,reason,
      before:copy(current),after:copy(next),session_only:true};
    const updated=orders.slice();updated[index]=next;
    return {orders:updated,events:[...events,event],event};
  }
  function patientHistory(events,patientId){return events.filter(e=>e.patient_id===patientId).slice().sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at));}
  return {ACTIONS,STATES,createAddEvent,transition,patientHistory};
});
