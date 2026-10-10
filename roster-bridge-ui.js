"use strict";
/* Isolated presentation adapter: MICU data never enters PRN order, user or acknowledgement state. */
(function () {
  if (typeof document === "undefined") return;
  const el = id => document.getElementById(id);
  const file = el("micuRosterFile");
  const date = el("micuRosterDate");
  const duty = el("micuRosterDuty");
  const consent = el("micuRosterConsent");
  const apply = el("micuRosterImport");
  const clear = el("micuRosterClear");
  const output = el("micuRosterResult");
  const people = el("micuRosterPeople");
  if (![file,date,duty,consent,apply,clear,output,people].every(Boolean)) return;
  const today = new Date();
  date.value = [today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
  let generation = 0;
  const setMessage = message => { output.textContent = message; };
  const clearPeople = () => people.replaceChildren();
  const invalidate = () => { generation++; clearPeople(); setMessage("조회 조건이 변경됐습니다. 선택 날짜 근무자 조회를 다시 눌러 주세요."); };
  date.addEventListener("change", invalidate);
  duty.addEventListener("change", invalidate);
  file.addEventListener("change", invalidate);
  consent.addEventListener("change", invalidate);
  clear.addEventListener("click", () => {
    generation++;
    file.value = "";
    consent.checked = false;
    clearPeople();
    setMessage("연결되지 않음. 기존 PRN 가상 로그인은 별도로 유지됩니다.");
  });
  apply.addEventListener("click", async () => {
    const requestId = ++generation;
    clearPeople();
    if (!globalThis.MicuRosterBridge) {setMessage("연동 모듈을 불러오지 못했습니다. 브라우저를 새로고침하세요.");return;}
    if (!consent.checked) {setMessage("비식별·교육용 파일 사용 확인란을 선택해야 합니다.");return;}
    const selected = file.files?.[0];
    if (!selected) {setMessage("MICU 화재대피 앱에서 내보낸 전체 백업 JSON 파일을 선택하세요.");return;}
    if (selected.size > MicuRosterBridge.MAX_BYTES) {setMessage("파일 크기는 20MB 이하여야 합니다.");return;}
    apply.disabled = true;
    setMessage("근무표를 현재 브라우저에서 확인 중입니다…");
    try {
      const text = await selected.text();
      const result = await MicuRosterBridge.importBackupText(text, date.value, duty.value);
      if (requestId !== generation) return;
      const head = document.createElement("div");
      head.className = "roster-people-head";
      head.textContent = result.date+" · "+result.duty+" 근무 · 간호사 "+result.people.length+"명 · 읽기 전용 / 실제 로그인 미확인";
      people.appendChild(head);
      if (!result.people.length) {
        const empty = document.createElement("span");
        empty.className = "roster-people-empty";
        empty.textContent = "이 날짜·근무조에 확인된 간호사가 없습니다.";
        people.appendChild(empty);
      }
      for (const person of result.people) {
        const tag = document.createElement("span");
        tag.className = "roster-person";
        tag.textContent = person.name+" · "+person.group;
        people.appendChild(tag);
      }
      setMessage("MICU 백업 검증과 근무자 목록 추출이 완료됐습니다. 임시 조회 결과이며 PRN 로그인·확인 기록에는 반영되지 않습니다.");
    } catch (error) {
      if (requestId !== generation) return;
      clearPeople();
      setMessage("근무표 연결 실패: "+(error?.message || "지원하지 않는 파일입니다."));
    } finally {
      apply.disabled = false;
    }
  });
})();
