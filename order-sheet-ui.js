"use strict";
/* Read-only synthetic handoff / order-sheet UI. Never changes medication orders. */
(function(){
 if(typeof document==="undefined")return;
 const by=id=>document.getElementById(id);
 const button=by("sheetToggle"),panel=by("sheetPanel"),intro=by("sheetIntro"),
       caseBox=by("sheetCase"),table=by("sheetTable"),status=by("sheetStatus");
 if(![button,panel,intro,caseBox,table,status].every(Boolean))return;
 let scenarios=null,loading=null,generation=0;
 const node=(tag,value,className)=>{
   const element=document.createElement(tag);
   if(className)element.className=className;
   if(value!==undefined&&value!==null)element.textContent=String(value);
   return element;
 };
 const label=value=>value===null||value===undefined||String(value).trim()===""?"미기재":String(value);
 async function ensureCases(){
   if(scenarios)return scenarios;
   if(!loading)loading=fetch("./data/teaching_case_context.json",{cache:"no-store"})
     .then(r=>{if(!r.ok)throw Error("교육용 시나리오 자료를 불러오지 못했습니다.");return r.json();})
     .then(rows=>{
       const context=window.PRNComposerHost?.context();
       if(!context?.ready)throw Error("환자 데이터가 준비되지 않았습니다.");
       window.PRNSheetModel.validateTeachingContexts(context.patients,rows);
       scenarios=rows;return rows;
     }).finally(()=>{loading=null;});
   return loading;
 }
 function addList(parent,title,contents){
   const section=node("section",null,"kardex-info-section"),heading=node("h4",title);
   section.appendChild(heading);
   const list=node("ul");
   for(const item of contents||[])list.appendChild(node("li",item));
   if(!list.children.length)list.appendChild(node("li","미기재 · 가상 시나리오에 제공되지 않음"));
   section.appendChild(list);parent.appendChild(section);
 }
 function buildCase(ctx,scenario){
   caseBox.replaceChildren();
   const patient=ctx.patients.find(p=>p.patient_id===ctx.patientId);
   const profile=window.PRNPatientProfiles?.find(ctx.profiles||[],ctx.patientId);
   caseBox.appendChild(node("h3",label(scenario?.scenario_title)+" · "+label(patient?.display_name)));
   caseBox.appendChild(node("p","가상 병상 "+label(patient?.bed)+" · 입원 "+label(patient?.admission_date)+" · 주치의(가상) "+label(profile?.primary_physician?.name)));
   if(profile&&patient){
     const section=node("details",null,"kardex-info-fold");
     section.open=true;section.appendChild(node("summary","환자정보 · 진료 맥락 · 미확인 사항"));
     const rows=node("div",null,"kardex-info-grid");
     for(const [name,value] of window.PRNPatientProfiles.rows(profile,patient)){
       const item=node("div",null,"kardex-info-entry");
       item.appendChild(node("strong",name));item.appendChild(node("span",label(value)));rows.appendChild(item);
     }
     section.appendChild(rows);caseBox.appendChild(section);
   }
   const handoff=node("details",null,"kardex-info-fold");
   handoff.appendChild(node("summary","인계 · 관찰 · 술기 참고"));
   addList(handoff,"인계 참고",scenario?.kardex_notes);
   addList(handoff,"관찰 초점",scenario?.watch_points);
   addList(handoff,"교육용 술기",scenario?.skill_topics);
   caseBox.appendChild(handoff);
   caseBox.appendChild(node("p","교육용·합성 사례. 미제공 검사는 정상이라는 뜻이 아니며 인계는 투약 지시가 아닙니다.","sheet-warning"));
 }
 const typeLabels=[["prn","PRN 처방"],["regular","정규 처방"],["stat","응급(STAT) 처방"]];
 const typeOf=o=>o.order_priority==="stat"||o.order_mode==="emergency"?"stat":o.order_type==="prn"?"prn":"regular";
 const statusLabel={active:"유효", "on-hold":"보류", stopped:"중지", cancelled:"취소"};
 function addOrderDetail(parent,order,row){
   const item=node("details",null,"kardex-order-item");
   item.dataset.orderId=order.order_id;
   const summary=node("summary",null,"kardex-order-summary");
   summary.appendChild(node("strong",label(row.drug)));
   summary.appendChild(node("span",label(row.perDose)+" · "+label(row.route)+" · "+label(row.instruction),"kardex-order-sub"));
   summary.appendChild(node("span",statusLabel[order.order_status]||label(order.order_status),"kardex-order-status"));
   item.appendChild(summary);
   const details=node("div",null,"kardex-order-metadata");
   for(const [key,value] of [
      ["처방 ID",order.order_id],["가상 처방코드",row.code],["처방 유형",row.classification],
      ["적응증",row.indication],["PRN 조건",order.administration_condition],["1회 용량",row.perDose],
      ["경로",row.route],["용법·간격",row.instruction],["최대 지시",order.maximum_limit_instruction],
      ["예정시각",row.schedule],["처방 작성자",row.prescriber],["작성시각",order.ordered_at],
      ["상태",statusLabel[order.order_status]||order.order_status],
      ["최초 처방 원문(과거 자료)",row.original]
   ]) {
     const entry=node("div",null,"kardex-order-attribute");
     entry.appendChild(node("strong",key));entry.appendChild(node("span",label(value)));details.appendChild(entry);
   }
   details.appendChild(node("p","현재 처방과 원본·변경 전 버전은 구별해야 합니다. 이 화면은 실제 투약 가능 여부를 판단하지 않습니다.","sheet-warning"));
   item.appendChild(details);parent.appendChild(item);
 }
 function buildTable(ctx){
   table.replaceChildren();
   const original=ctx.existing.filter(o=>o.patient_id===ctx.patientId);
   const groups=window.PRNSheetModel.groupOrders(ctx.existing,ctx.patientId);
   const map=new Map(groups.flatMap(g=>g.orderRows.map(row=>[row.id,row])));
   status.textContent="가상 처방 "+original.length+"건 · 종류별 접이식 · 각 처방의 작성자/ID/원문 보존";
   if(!original.length){table.appendChild(node("p","조회 환자에 등록된 약물 처방이 없습니다."));return;}
   for(const [type,title] of typeLabels){
     const orders=original.filter(o=>typeOf(o)===type);
     const fold=node("details",null,"kardex-type-fold");
     fold.dataset.kind=type;fold.open=type==="prn";
     fold.appendChild(node("summary",title+" · "+orders.length+"건"));
     if(!orders.length)fold.appendChild(node("p","이 유형의 처방이 없습니다.","kardex-empty"));
     for(const order of orders) {
       const row=map.get(order.order_id);
       if(!row)throw Error("가상 처방지에서 개별 주문이 누락되었습니다.");
       addOrderDetail(fold,order,row);
     }
     table.appendChild(fold);
   }
 }
 async function refresh(){
   if(panel.hidden)return;
   const requested=++generation,host=window.PRNComposerHost,model=window.PRNSheetModel;
   if(!host||!model){intro.textContent="조회 기능 초기화를 기다리고 있습니다.";return;}
   const ctx=host.context();
   if(!ctx.ready){intro.textContent="가상 환자·처방 데이터를 불러오는 중입니다.";return;}
   try{
     const result=await ensureCases();
     if(panel.hidden||requested!==generation)return;
     const latest=host.context();
     if(!latest.ready)return;
     const scenario=result.find(s=>s.patient_id===latest.patientId);
     if(!scenario){intro.textContent="선택 환자의 시나리오를 찾을 수 없습니다.";return;}
     intro.textContent="합성 교육 사례. 환자 맥락과 처방 목록을 개별 접이식으로 확인합니다.";
     buildCase(latest,scenario);buildTable(latest);
   }catch(err){if(requested===generation)intro.textContent="가상 사례 표시 오류: "+(err?.message||"자료 확인 필요");}
 }
 button.addEventListener("click",()=>{panel.hidden=!panel.hidden;button.setAttribute("aria-expanded",String(!panel.hidden));if(!panel.hidden)void refresh();});
 document.addEventListener("prn-data-ready",()=>{if(!panel.hidden)void refresh();});
 by("patientSelect")?.addEventListener("change",()=>{if(!panel.hidden)void refresh();});
 document.addEventListener("prn-orders-changed",()=>{if(!panel.hidden)void refresh();});
 document.addEventListener("prn-page-changed",()=>{if(!panel.hidden)void refresh();});
})();
