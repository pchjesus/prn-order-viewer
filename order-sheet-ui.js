"use strict";
/* Optional teaching case/Kardex and order-sheet preview. Never changes PRN orders. */
(function(){
  if(typeof document==="undefined")return;
  const by=id=>document.getElementById(id);
  const button=by("sheetToggle"),panel=by("sheetPanel"),intro=by("sheetIntro"),caseBox=by("sheetCase"),
    table=by("sheetTable"),status=by("sheetStatus");
  if(!button||!panel||!intro||!caseBox||!table||!status)return;
  let scenarios=null,loading=null;
  const node=(tag,value,className)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(value!==undefined && value!==null)el.textContent=String(value);
    return el;
  };
  async function ensureCases(){
    if(scenarios)return scenarios;
    if(!loading)loading=fetch("./data/teaching_case_context.json",{cache:"no-store"})
      .then(r=>{if(!r.ok)throw new Error("교육용 시나리오 자료를 불러오지 못했습니다.");return r.json();})
      .then(rows=>{const context=window.PRNComposerHost?.context();if(!context?.ready)throw new Error("환자 데이터가 준비되지 않았습니다.");
        window.PRNSheetModel.validateTeachingContexts(context.patients,rows);scenarios=rows;return scenarios;})
      .finally(()=>{loading=null;});
    return loading;
  }
  function lines(parent,title,contents){
    parent.appendChild(node("h4",title));
    const list=node("ul");
    for(const text of contents)list.appendChild(node("li",text));
    parent.appendChild(list);
  }
  function buildCase(ctx,scenario){
    caseBox.replaceChildren();
    const p=ctx.patients.find(x=>x.patient_id===ctx.patientId);
    caseBox.appendChild(node("h3",(scenario?.scenario_title||"시나리오 미확인")+" · "+(p?.display_name||ctx.patientId)));
    caseBox.appendChild(node("p","가상 병상 "+(p?.bed||"미기재")+" | 현재 상태 "+(p?.current_condition||"미기재")));
    lines(caseBox,"Kardex 형식 인계 참고",scenario?.kardex_notes||[]);
    lines(caseBox,"워크리스트 실습 영역",scenario?.skill_topics||[]);
    lines(caseBox,"사정·관찰 초점",scenario?.watch_points||[]);
    caseBox.appendChild(node("p","아래 인계 참고는 가상 학습 메모이며 실제 의사 처방·간호수행·투약 지시가 아닙니다.","sheet-warning"));
  }
  function buildTable(ctx){
    table.replaceChildren();
    const groups=window.PRNSheetModel.groupOrders(ctx.existing,ctx.patientId);
    const all=groups.reduce((n,g)=>n+g.orderRows.length,0);
    status.textContent="가상 처방 "+all+"건 · "+groups.length+"개 시간·작성자 묶음 · 누락 항목은 '미기재'로 표시";
    if(!all){table.appendChild(node("p","조회 환자에 등록된 약물 처방이 없습니다."));return;}
    const headLabels=["구분","가상 처방코드","처방명","1일 용량","1일 수량","1일 횟수","경로","용법·간격","1회 용량","1회 수량","예정시각","처방 의사","현재 상태"];
    for(const group of groups){
      const wrap=node("div",null,"sheet-group");
      wrap.appendChild(node("h4","["+(group.batch==="추가"?"추가":"기존")+"] "+group.stamp+" · "+group.doctor));
      const scroller=node("div",null,"sheet-scroll");
      const tab=node("table",null,"sheet-data-table");
      const thead=node("thead"),tr=node("tr");
      headLabels.forEach(h=>tr.appendChild(node("th",h)));
      thead.appendChild(tr);tab.appendChild(thead);
      const body=node("tbody");
      for(const row of group.orderRows){
        const el=node("tr");
        for(const v of [row.classification,row.code,row.drug,row.dailyDose,row.dailyQuantity,row.dailyFrequency,row.route,row.instruction,row.perDose,row.perQuantity,row.schedule,row.prescriber,row.status]){
          el.appendChild(node("td",v));
        }
        body.appendChild(el);
      }
      tab.appendChild(body);scroller.appendChild(tab);wrap.appendChild(scroller);table.appendChild(wrap);
    }
  }
  async function refresh(){
    if(panel.hidden)return;
    const host=window.PRNComposerHost,model=window.PRNSheetModel;
    if(!host||!model){intro.textContent="조회 기능 초기화를 기다리고 있습니다.";return;}
    const ctx=host.context();
    if(!ctx.ready){intro.textContent="환자·처방 데이터를 불러오는 중입니다.";return;}
    try{
      const result=await ensureCases();
      if(panel.hidden)return;
      const latest=host.context(); // patient could change during file retrieval
      const scenario=result.find(s=>s.patient_id===latest.patientId);
      if(!scenario){intro.textContent="선택 환자의 시나리오를 찾을 수 없습니다.";return;}
      intro.textContent="교내 실습자료의 구조를 참고한 가상 사례입니다. 실제 nU 화면이나 원본 처방지를 복제한 것이 아닙니다.";
      buildCase(latest,scenario);
      buildTable(latest);
    }catch(error){intro.textContent="사례 구성 표시 오류: "+(error?.message||"자료 확인 필요");}
  }
  button.addEventListener("click",()=>{
    panel.hidden=!panel.hidden;
    button.setAttribute("aria-expanded",String(!panel.hidden));
    if(!panel.hidden)void refresh();
  });
  document.addEventListener("prn-data-ready",()=>{if(!panel.hidden)void refresh();});
  by("patientSelect")?.addEventListener("change",()=>{if(!panel.hidden)void refresh();});
  by("composerForm")?.addEventListener("submit",()=>{if(!panel.hidden)void refresh();});
})();
