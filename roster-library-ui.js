"use strict";
/* Education-only Excel import, separate roster library. No login or medication changes. */
(function(){
 if(typeof document==="undefined")return;
 const $=id=>document.getElementById(id);
 const required=["teachingRosterFile","teachingRosterSheet","teachingRosterYear","teachingRosterMonth",
 "teachingRosterHeader","teachingRosterName","teachingRosterAnalyze","teachingRosterPreview",
 "teachingRosterVerify","teachingRosterSave","teachingRosterList","teachingRosterMessage",
 "teachingRosterOnDuty","teachingRosterRefresh"];
 if(required.some(id=>!$(id)))return;
 const M=globalThis.PRNRosterLibraryModel,S=globalThis.PRNRosterLibraryStore;
 let workbook=null,candidate=null,filename="",generation=0,busy=false;
 const message=t=>{$("teachingRosterMessage").textContent=t};
 const option=(label,value)=>new Option(String(label),String(value));
 const by=(id)=>$(id).value;
 const protect=()=>{if(busy)throw Error("이전 근무표 저장 작업을 기다려 주세요.");};
 function clearDraft(){
   generation++;workbook=null;candidate=null;filename="";
   $("teachingRosterFile").value="";$("teachingRosterSheet").replaceChildren();
   $("teachingRosterVerify").checked=false;$("teachingRosterSave").disabled=true;
   $("teachingRosterPreview").replaceChildren();
 }
 function parse(){
   if(!workbook)throw Error("Excel 파일을 선택해 주세요.");
   const selected=by("teachingRosterSheet"),sheet=workbook.Sheets[selected];
   if(!sheet)throw Error("선택한 시트를 찾을 수 없습니다.");
   const head=by("teachingRosterHeader").trim(),name=by("teachingRosterName").trim();
   if(head&&(!/^\d+$/.test(head)||Number(head)<1))throw Error("날짜 행은 1 이상의 숫자로 지정해 주세요.");
   if(name&&!/^[A-Za-z]+$/.test(name))throw Error("이름 열은 A, B처럼 지정해 주세요.");
   const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",range:0});
   const profile=MicuConfig.parserProfiles[MicuConfig.activeParserId];
   const parsed=RosterParser.parseRows(rows,{profile,headerRow:head?Number(head)-1:null,
     nameColumn:name?XLSX.utils.decode_col(name.toUpperCase()):null});
   const year=Number(by("teachingRosterYear")),month=Number(by("teachingRosterMonth"));
   const check=RosterParser.validateMonth(parsed,year,month);
   parsed.inspection.warnings.push(...check.warnings);
   if(parsed.inspection.warnings.some(w=>w.code==="unknown-code"))
     throw Error("인식할 수 없는 근무코드가 있습니다. 원본 Excel과 해석 규칙을 확인해 주세요.");
   return M.make(parsed,year,month,filename,selected);
 }
 function preview(record){
   const area=$("teachingRosterPreview");area.replaceChildren();
   const label=document.createElement("p");
   label.textContent=record.year+"년 "+record.month+"월 · "+record.all.length+"명 · "+Object.keys(record.shifts).length+"개 날짜 · 시트 "+record.sheetName;
   area.appendChild(label);
   const warnings=document.createElement("ul");
   for(const w of record.warnings){const li=document.createElement("li");li.textContent=w.message;warnings.appendChild(li);}
   if(warnings.children.length)area.appendChild(warnings);
   const date=by("micuRosterDate"),duty=by("micuRosterDuty");
   const people=M.onDuty(record,date.value,duty.value);
   const detail=document.createElement("p");
   detail.textContent="현재 선택 날짜 "+date.value+" / "+duty.value+" · 근무 인원 "+people.length+"명";
   area.appendChild(detail);
   const list=document.createElement("ul");
   for(const p of people){const li=document.createElement("li");li.textContent=p.name+" · "+p.group;list.appendChild(li);}
   if(!people.length){const li=document.createElement("li");li.textContent="해당 날짜/듀티 자료 없음 · 다른 날짜를 선택해 확인";list.appendChild(li);}
   area.appendChild(list);
 }
 function markDirty(){
   candidate=null;$("teachingRosterSave").disabled=true;
   $("teachingRosterVerify").checked=false;
 }
 async function openFile(){
   protect();markDirty();
   const file=$("teachingRosterFile").files?.[0];if(!file)return;
   if(!/\.xlsx?$/i.test(file.name)||file.size>M.MAX_BYTES||file.size===0)throw Error("20MB 이하의 .xlsx/.xls Excel 파일만 선택해 주세요.");
   const token=++generation;
   const buf=await file.arrayBuffer();
   if(token!==generation)return;
   workbook=XLSX.read(buf,{type:"array"});
   if(!workbook.SheetNames.length)throw Error("Excel 시트가 없습니다.");
   filename=file.name;
   $("teachingRosterSheet").replaceChildren(...workbook.SheetNames.map(n=>option(n,n)));
   const found=RosterParser.extractMonthYear(file.name);
   if(found){$("teachingRosterYear").value=found.year;$("teachingRosterMonth").value=found.month;}
   message("Excel을 읽었습니다. 시트·연월·행/열을 확인하고 [해석·미리보기]를 눌러 주세요. 저장 전 상태입니다.");
 }
 async function analyze(){
   protect();markDirty();
   const record=parse();candidate=record;preview(record);
   message("해석을 완료했습니다. 미리보기를 확인하고 가상·사용허가 파일임을 확인하면 저장할 수 있습니다.");
   $("teachingRosterSave").disabled=!$("teachingRosterVerify").checked;
 }
 async function savedList(){
   const [rows,id]=await Promise.all([S.list(),S.activeId()]);
   const parent=$("teachingRosterList");parent.replaceChildren();
   if(!rows.length){parent.textContent="저장된 교육용 근무표가 없습니다.";return;}
   for(const record of rows){
     const row=document.createElement("div");row.className="teaching-roster-entry";row.dataset.rosterId=record.id;
     const summary=document.createElement("div");summary.className="teaching-roster-entry-title";
     summary.textContent=record.year+"년 "+record.month+"월 · "+record.fileName+(id===record.id?" · 사용 중":"");
     row.appendChild(summary);
     const actions=document.createElement("div");actions.className="teaching-roster-entry-actions";
     const use=document.createElement("button");use.type="button";use.textContent=id===record.id?"사용 중":"사용";use.disabled=id===record.id;
     use.onclick=async()=>{
       if(busy)return;busy=true;
       try{await S.use(record.id);message(record.year+"년 "+record.month+"월 근무표를 사용하도록 지정했습니다. 모의 로그인은 바뀌지 않습니다.");await savedList();await showActive();}
       catch(e){message("사용 실패: "+e.message)}finally{busy=false}
     };
     const del=document.createElement("button");del.type="button";del.textContent="삭제";
     del.onclick=async()=>{
       if(busy)return;
       if(!window.confirm(record.year+"년 "+record.month+"월 근무표를 삭제할까요? 사용 중인 경우 활성 상태가 해제됩니다."))return;
       busy=true;
       try{await S.remove(record.id,record.revision);message("교육용 근무표가 삭제됐습니다.");await savedList();await showActive();}
       catch(e){message("삭제 중단: "+e.message)}finally{busy=false}
     };
     actions.append(use,del);row.appendChild(actions);parent.appendChild(row);
   }
 }
 async function save(){
   protect();
   if(!candidate||!$("teachingRosterVerify").checked)throw Error("해석 미리보기와 가상 파일 확인이 필요합니다.");
   // Re-parse current input controls before saving: stale preview cannot be committed.
   const newest=parse();
   if(JSON.stringify(newest.all)!==JSON.stringify(candidate.all)||JSON.stringify(newest.shifts)!==JSON.stringify(candidate.shifts)
     ||newest.id!==candidate.id||newest.sheetName!==candidate.sheetName)
      throw Error("근무표 해석 조건이 달라졌습니다. 다시 미리보기를 확인하세요.");
   const old=(await S.list()).find(r=>r.id===newest.id),expected=old?.revision??null;
   if(old&&!window.confirm(newest.year+"년 "+newest.month+"월 근무표를 교체할까요? 기존 근무표 내용이 바뀝니다."))return;
   busy=true;
   try{
     await S.save(newest,expected);
     const current=(await S.list()).find(r=>r.id===newest.id);
     if(!current||current.fileName!==newest.fileName)throw Error("저장 후 확인에 실패했습니다.");
     clearDraft();message("근무표 저장을 확인했습니다. 아직 사용 상태로 자동 전환되지 않습니다. 보관함에서 [사용]을 선택하세요.");
     await savedList();await showActive();
   }finally{busy=false}
 }
 async function showActive(){
   const id=await S.activeId(),rows=await S.list();
   const row=rows.find(r=>r.id===id);
   const container=$("teachingRosterOnDuty");container.replaceChildren();
   if(!row){container.textContent="사용 중인 PRN 교육용 근무표가 없습니다.";return;}
   const date=by("micuRosterDate"),duty=by("micuRosterDuty");
   const people=M.onDuty(row,date.value,duty.value);
   const head=document.createElement("p");
   head.textContent="활성 "+row.year+"년 "+row.month+"월 · "+date.value+" "+duty.value+" · "+people.length+"명 · 모의 로그인과 무관";
   container.appendChild(head);
   const ul=document.createElement("ul");
   for(const p of people){const li=document.createElement("li");li.textContent=p.name+" · "+p.group;ul.appendChild(li);}
   if(!people.length){const li=document.createElement("li");li.textContent="이 날짜·근무조의 인원 정보가 없습니다.";ul.appendChild(li);}
   container.appendChild(ul);
 }
 const guarded=fn=>async()=>{try{await fn()}catch(e){message("근무표 처리 오류: "+e.message)}};
 $("teachingRosterFile").addEventListener("change",guarded(openFile));
 $("teachingRosterAnalyze").addEventListener("click",guarded(analyze));
 $("teachingRosterSave").addEventListener("click",guarded(save));
 $("teachingRosterRefresh").addEventListener("click",guarded(async()=>{await savedList();await showActive();message("보관함을 새로 확인했습니다.")}));
 for(const id of ["teachingRosterYear","teachingRosterMonth","teachingRosterHeader","teachingRosterName","teachingRosterSheet"]){
   $(id).addEventListener("input",markDirty);$(id).addEventListener("change",markDirty);
 }
 $("teachingRosterVerify").addEventListener("change",()=>{$("teachingRosterSave").disabled=!candidate||!$("teachingRosterVerify").checked});
 $("micuRosterDate").addEventListener("change",guarded(showActive));
 $("micuRosterDuty").addEventListener("change",guarded(showActive));
 void guarded(async()=>{await S.open();await savedList();await showActive()})();
})();
