"use strict";

/* Read-only synthetic medication orders. No dosing or administration decision logic. */
const PRNCore = (() => {
  const STATUS = Object.freeze({
    active: { label: "유효", className: "active" },
    "on-hold": { label: "보류", className: "on-hold" },
    stopped: { label: "중지", className: "stopped" },
    completed: { label: "완료", className: "completed" },
    cancelled: { label: "취소", className: "cancelled" },
    draft: { label: "작성 중", className: "other" },
    "entered-in-error": { label: "오류 입력", className: "other" },
    unknown: { label: "상태 미확인", className: "other" }
  });

  function validate(catalog, orders, patients = null, shifts = null, reviews = null) {
    if (!Array.isArray(catalog) || !Array.isArray(orders)) throw new Error("약물 및 처방 자료 형식이 잘못되었습니다.");
    const medIDs = new Set();
    for (const med of catalog) {
      if (!med || typeof med.medication_catalog_id !== "string" || !med.medication_catalog_id || !med.ingredient_name_ko || medIDs.has(med.medication_catalog_id)) {
        throw new Error("약물 후보 데이터에 누락되거나 중복된 식별자가 있습니다.");
      }
      medIDs.add(med.medication_catalog_id);
    }
    const orderIDs = new Set();
    for (const order of orders) {
      if (!order || typeof order.order_id !== "string" || !order.order_id || orderIDs.has(order.order_id) ||
          typeof order.patient_id !== "string" || !order.patient_id || !medIDs.has(order.medication_catalog_id) ||
          !["regular", "prn"].includes(order.order_type) || !order.order_status || !Object.hasOwn(STATUS, order.order_status) ||
          (patients !== null && (!order.prescriber_id || !order.prescriber_name || !Number.isFinite(Date.parse(order.ordered_at))))) {
        throw new Error("가상 처방에 잘못된 구분, 상태, 연결 또는 중복 ID가 있습니다.");
      }
      orderIDs.add(order.order_id);
    }
    if (patients !== null) {
      if (!Array.isArray(patients)) throw new Error("가상 환자 목록 형식 오류");
      const ids = new Set();
      for (const patient of patients) {
        if (!patient?.patient_id || ids.has(patient.patient_id) || !patient.display_name) throw new Error("가상 환자 ID 또는 표시명 오류");
        ids.add(patient.patient_id);
      }
      if (orders.some(order => !ids.has(order.patient_id))) throw new Error("처방에서 존재하지 않는 환자를 참조합니다.");
    }
    if (shifts !== null) {
      if (!Array.isArray(shifts)) throw new Error("가상 근무정보 형식 오류");
      const ids = new Set();
      for (const sh of shifts) {
        if (!sh?.shift_id || ids.has(sh.shift_id) || !sh.nurse_id || !sh.login_id || !sh.simulated_now ||
            !(Date.parse(sh.starts_at) <= Date.parse(sh.simulated_now) && Date.parse(sh.simulated_now) < Date.parse(sh.ends_at))) {
          throw new Error("간호사 로그인/근무시간 데이터 오류");
        }
        ids.add(sh.shift_id);
      }
    }
    if (reviews !== null) {
      if (!Array.isArray(reviews) || !Array.isArray(shifts)) throw new Error("처방 확인 이력 형식 오류");
      const ids = new Set();
      for (const event of reviews) {
        const sh = shifts.find(x => x.shift_id === event.shift_id);
        if (!event?.event_id || ids.has(event.event_id) || !orderIDs.has(event.order_id) ||
            !sh || event.nurse_id !== sh.nurse_id || event.action !== "read_acknowledgement" ||
            !(Date.parse(sh.starts_at) <= Date.parse(event.confirmed_at) && Date.parse(event.confirmed_at) < Date.parse(sh.ends_at))) {
          throw new Error("처방 확인 이력의 간호사/근무시간/처방 연결 오류");
        }
        ids.add(event.event_id);
      }
    }
    return true;
  }

  function canAcknowledge(order, shift) {
    return Boolean(order && shift?.nurse_id && shift?.login_id &&
      Date.parse(shift.starts_at) <= Date.parse(shift.simulated_now) &&
      Date.parse(shift.simulated_now) < Date.parse(shift.ends_at) &&
      (!order.ordered_at || Date.parse(order.ordered_at) <= Date.parse(shift.simulated_now)) &&
      (!order.last_modified_at || Date.parse(order.last_modified_at) <= Date.parse(shift.simulated_now)));
  }

  function appendAcknowledge(events, order, shift) {
    if (!Array.isArray(events) || !canAcknowledge(order, shift)) throw new Error("현재 로그인/근무 시간에는 확인을 기록할 수 없습니다.");
    if (events.some(x => x.order_id === order.order_id && x.shift_id === shift.shift_id && x.nurse_id === shift.nurse_id && x.confirmed_at === shift.simulated_now && (x.order_revision ?? 0) === (order.order_revision ?? 0))) {
      throw new Error("현재 가상 근무 세션에서 이미 확인한 처방입니다.");
    }
    return [...events, {event_id:`SIM-ACK-LIVE-${events.length + 1}`,order_id:order.order_id,nurse_id:shift.nurse_id,
      shift_id:shift.shift_id,confirmed_at:shift.simulated_now,order_revision:order.order_revision??0,action:"read_acknowledgement",session_only:true}];
  }

  function getOrderReviews(reviews, orderId) {
    return (reviews || []).filter(x => x.order_id === orderId).slice().sort((a,b) => Date.parse(b.confirmed_at)-Date.parse(a.confirmed_at));
  }

  function getVisibleOrders(orders, { patientId, tab = "all", query = "", status = "all" } = {}) {
    if (!Array.isArray(orders)) return [];
    const needle = String(query ?? "").trim().toLocaleLowerCase("ko");
    const matched = orders.filter(order => {
      if (!order || order.patient_id !== patientId) return false;
      if (tab === "prn" && order.order_type !== "prn") return false;
      if (status !== "all" && order.order_status !== status) return false;
      if (!needle) return true;
      return [order.order_display_name, order.order_id, order.indication, order.administration_condition, order.ingredient_name_ko, order.ingredient_name_en, order.medication_catalog_id]
        .some(x => String(x ?? "").toLocaleLowerCase("ko").includes(needle));
    });
    // Stable active-first ordering applies only to the PRN tab's all-status view.
    if (tab === "prn" && status === "all") {
      return matched.slice().sort((a, b) => Number(b.order_status === "active") - Number(a.order_status === "active"));
    }
    return matched;
  }

  function enrichOrders(catalog, orders) {
    const byId = new Map(catalog.map(med => [med.medication_catalog_id, med]));
    return orders.map(order => {
      const med = byId.get(order.medication_catalog_id);
      return { ...order, ingredient_name_ko: med?.ingredient_name_ko ?? "미기재", ingredient_name_en: med?.ingredient_name_en ?? "", category_name_ko: med?.category_name_ko ?? "분류 미확인", review_status: med?.review_status ?? "unverified" };
    });
  }

  function distinctPatientIds(orders) { return [...new Set(orders.map(o => o.patient_id))]; }
  function getStatusKeys(orders, patientId, tab) {
    return [...new Set(orders.filter(o => o.patient_id === patientId && (tab !== "prn" || o.order_type === "prn")).map(o => o.order_status))];
  }
  function getPrnConfirmation(order) {
    if (!order || order.order_type !== "prn") return null;
    // Only the current free-text instructions are displayed. Structured data may be stale after a revision.
    const current = value => value === null || value === undefined || !String(value).trim() ? null : String(value);
    return {
      indication: current(order.indication),
      condition: current(order.administration_condition),
      dose: current(order.dose_instruction),
      route: current(order.route_instruction),
      frequency: current(order.frequency_instruction),
      maximum: current(order.maximum_limit_instruction)
    };
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  return { STATUS, validate, canAcknowledge, appendAcknowledge, getOrderReviews,
    getVisibleOrders, enrichOrders, distinctPatientIds, getStatusKeys, getPrnConfirmation, escapeHTML };
})();

if (typeof module !== "undefined" && module.exports) module.exports = PRNCore;

if (typeof document !== "undefined") {
  const { STATUS, validate, canAcknowledge, appendAcknowledge, getOrderReviews,
    getVisibleOrders, enrichOrders, getStatusKeys, getPrnConfirmation, escapeHTML: e } = PRNCore;
  const byId = id => document.getElementById(id);
  const state = { patientId: null, tab: "all", query: "", status: "all", selectedOrderId: null,
    orders: [], patients: [], shifts: [], reviews: [], medCatalog: [], orderEvents: [], sessionShiftId: null, loading: true };
  const currentShift = () => state.shifts.find(s => s.shift_id === state.sessionShiftId);
  const formatTime = time => time ? String(time).replace("T", " ").replace(/\+09:00$/, " KST") : "미기재";
  const getNurseName = nurseId => state.shifts.find(s => s.nurse_id === nurseId)?.nurse_name ?? "가상 간호사 정보 없음";
  const lastReview = orderId => {
    const order=state.orders.find(x=>x.order_id===orderId);
    return getOrderReviews(state.reviews,orderId).find(x=>(x.order_revision??0)===(order?.order_revision??0));
  };
  const miss = val => val === null || val === undefined || String(val).trim() === "";
  const showVal = val => miss(val) ? '<span class="missing">미기재 · 미검증</span>' : e(val);
  const badge = status => { const s = STATUS[status] || STATUS.unknown; return `<span class="status-chip ${s.className}">${e(s.label)}</span>`; };
  const htmlStatus = status => STATUS[status]?.label ?? "상태 미확인";
  const modeText = order => order.order_priority === "stat" ? "응급(STAT)" : order.order_type === "prn" ? "PRN" : "정규";

  function setTab(tab) {
    state.tab = tab;
    state.status = "all";
    state.selectedOrderId = null;
    byId("tabAll").classList.toggle("active", tab === "all");
    byId("tabPrn").classList.toggle("active", tab === "prn");
    byId("tabAll").setAttribute("aria-selected", String(tab === "all"));
    byId("tabPrn").setAttribute("aria-selected", String(tab === "prn"));
    render();
  }

  function fillStatusChoices() {
    const select = byId("statusFilter");
    const available = getStatusKeys(state.orders, state.patientId, state.tab);
    if (state.status !== "all" && !available.includes(state.status)) state.status = "all";
    select.replaceChildren(new Option("모든 상태", "all"));
    for (const key of Object.keys(STATUS)) {
      if (available.includes(key)) select.add(new Option(htmlStatus(key), key));
    }
    select.value = state.status;
  }

  function renderDetail() {
    const content = byId("detailContent");
    const order = state.orders.find(o => o.order_id === state.selectedOrderId);
    if (!order) {
      byId("detailPanel").classList.remove("mobile-open");
      content.innerHTML = '<div class="detail-placeholder"><div class="placeholder-icon" aria-hidden="true">▤</div><strong>처방을 선택해 주세요</strong><p>목록에서 한 건을 선택하면 가상 처방의 상세정보와 원문을 확인할 수 있습니다.</p></div>';
      return;
    }
    const reviews = getOrderReviews(state.reviews, order.order_id);
    const shift = currentShift();
    const currentRevisionAcknowledged=reviews.some(x=>(x.order_revision??0)===(order.order_revision??0));
    const allowAck = canAcknowledge(order, shift) && !reviews.some(r => r.shift_id === shift.shift_id && r.confirmed_at === shift.simulated_now && (r.order_revision??0)===(order.order_revision??0));
    const reviewHistory = reviews.length
      ? reviews.map(r => `<div class="review-row"><strong>${e(getNurseName(r.nurse_id))}</strong><span>${e(formatTime(r.confirmed_at))}</span><small>열람 확인 · ${e(r.shift_id)} · 처방 버전 ${e(r.order_revision??0)}${(r.order_revision??0)!==(order.order_revision??0)?" · 이전 버전 확인":""}${r.session_only ? " · 현재 탭에서만 유지" : " · 예시 기록"}</small></div>`).join("")
      : '<p class="review-empty">열람 확인 기록 없음</p>';

    const structured=order.instruction_structure;
    const stale=structured?.stale_sections||[];
    const currentField=(name,value)=>stale.includes(name)?"이전 버전 값 · 구조화 재입력 필요":value;
    const productSummary=structured?[structured.product?.name,structured.product?.form,structured.product?.strength].filter(Boolean).join(" / "):null;
    const doseSummary=structured?.dose?structured.dose.value+" "+structured.dose.unit:null;
    const scheduleSummary=structured?.schedule?[
      structured.schedule.frequency?structured.schedule.frequency.period+"당 "+structured.schedule.frequency.count+"회":null,
      structured.schedule.interval?structured.schedule.interval.value+" "+structured.schedule.interval.unit:null,
      structured.schedule.times?.length?"시각 "+structured.schedule.times.join(", "):null
    ].filter(Boolean).join(" / "):null;
    const maxSummary=structured?.maximum?[
      structured.maximum.dose?structured.maximum.dose.value+" "+structured.maximum.dose.unit:null,
      structured.maximum.administrations?structured.maximum.administrations.period+"당 "+structured.maximum.administrations.count+"회":null
    ].filter(Boolean).join(" / "):null;
    const field = (label, val, full = false) => `<div class="detail-field${full ? " full" : ""}"><span class="detail-label">${e(label)}</span><span class="detail-value">${showVal(val)}</span></div>`;
    const prn = getPrnConfirmation(order);
    // No inferred timing, dose, eligibility or safety judgement. Summary uses the current textual version only.
    const prnBrief = prn ? `<section class="prn-confirmation" aria-label="현재 PRN 처방 핵심 확인">
      <h3>현재 PRN 처방 핵심 확인 <span class="prn-confirmation-version">버전 ${e(order.order_revision ?? 0)} · ${e(htmlStatus(order.order_status))}</span></h3>
      <p class="prn-confirmation-note">현재 버전의 가상 처방 지시를 모아 보여줍니다. 이전 버전·구조화 값은 자동으로 채우지 않으며 실제 투약 가능 여부를 판단하지 않습니다.</p>
      <div class="prn-confirmation-grid">
        ${field("적응증", prn.indication)}
        ${field("PRN 투여 조건", prn.condition)}
        ${field("1회 용량", prn.dose)}
        ${field("투여 경로", prn.route)}
        ${field("투여 빈도·간격", prn.frequency, true)}
        ${field("최대량·횟수 지시", prn.maximum, true)}
      </div>
    </section>` : "";
    content.innerHTML = `
      <div class="detail-title">${e(order.ingredient_name_ko)}</div>
      <div class="detail-code">${e(order.order_id)} · ${e(order.medication_catalog_id)}</div>
      <div class="detail-badges">${badge(order.order_status)}<span class="type-chip">${modeText(order)} 처방</span></div>
      ${order.order_revision ? '<div class="detail-alert">처방이 변경된 시뮬레이션 기록입니다. 아래 용량·경로·상태는 현재 버전이며, 하단 최초 입력 원문은 변경 전 내용일 수 있습니다.</div>' : ""}
      ${order.order_revision && !currentRevisionAcknowledged ? '<div class="detail-alert">현재 변경 버전에 대한 간호사 열람 확인 기록이 없습니다. 과거 버전의 열람 이력과 구별해 주세요.</div>' : ""}
      ${stale.length?'<div class="detail-alert">일부 구조화 항목은 이전 버전 자료입니다. 현재 버전의 구조화 지시로 사용하지 마세요: '+e(stale.join(", "))+'</div>':""}
      <div class="detail-alert">용량·경로·간격은 화면 동작을 확인하기 위한 가상 예시이며 임상 검증을 받지 않았습니다. 빈 값은 미기재로 표시합니다. 실제 투약에 사용하지 마세요.</div>
      ${prnBrief}
      <div class="details-grid">
        ${field("가상 처방명", order.order_display_name, true)}
        ${field("처방자", `${order.prescriber_name || "미기재"} (${order.prescriber_id || "ID 없음"})`,true)}
        ${field("처방 작성", formatTime(order.ordered_at), true)}
        ${field("모의 처방 우선순위", order.order_priority === "stat" ? "응급(STAT)" : "일반")}
        ${field("모의 예정 시각", order.scheduled_at)}
        ${field("PRN 투여 조건", order.administration_condition, true)}
        ${field("처방 상태", htmlStatus(order.order_status))}
        ${field("변경 버전", order.order_revision ? "수정 "+order.order_revision+"회" : "최초 처방")}
        ${field("최종 변경자", order.last_modifier_name)}
        ${field("최종 변경 시각", order.last_modified_at)}
        ${field("약물 분류", order.category_name_ko)}
        ${field("구조화 자료 여부",structured?"명시적으로 입력 · 임상 미검증":"기존 자유문장 / 자동변환 없음",true)}
        ${structured?field("제품 / 제형 / 함량(명시 입력)",productSummary,true):""}
        ${structured?field("구조화 용량",currentField("dose",doseSummary)):""}
        ${structured?field("구조화 경로 코드",currentField("route",structured.route?.code)):""}
        ${structured?field("구조화 빈도 / 간격 / 시각",currentField("schedule",scheduleSummary),true):""}
        ${structured?field("구조화 최대 지시",currentField("maximum",maxSummary),true):""}
        ${structured?field("구조화 PRN 조건",currentField("prn",structured.prn?[structured.prn.indication,structured.prn.condition].filter(Boolean).join(" / "):null),true):""}
        ${field("1회 용량", order.dose_instruction)}
        ${field("투여 경로", order.route_instruction)}
        ${field("적응증", order.indication, true)}
        ${field("투여 빈도·간격", order.frequency_instruction, true)}
        ${field("최대량·횟수 지시", order.maximum_limit_instruction, true)}
        ${field("특이사항", order.special_instruction, true)}
      </div>
      <div class="detail-section"><h3>처방 열람 확인 · 시뮬레이션</h3>
        <p class="review-description">열람 확인은 실제 처방 승인·투약 허용을 뜻하지 않습니다. 확인자 ID는 선택한 가상 로그인 간호사 계정에서 자동 지정됩니다.</p>
        <div class="review-history">${reviewHistory}</div>
        <button type="button" class="ack-button" id="ackButton" ${allowAck ? "" : "disabled"}>${allowAck ? "현재 로그인 간호사로 열람 확인" : "이 계정·시각에는 기록 불가 또는 이미 확인"}</button>
        <p class="review-description">새 확인 기록은 브라우저 탭에서만 유지되며 새로고침 시 초기화됩니다.</p>
      </div>
      <div class="detail-section"><h3>최초 입력 처방 원문 · 버전 0</h3><p class="review-description">이 원문은 최초 입력 당시의 자료입니다. 처방 변경 이후에는 상단의 최신 처방정보와 다를 수 있으며 과거 원문을 최신 투약 지시로 사용해서는 안 됩니다.</p><div class="order-original">${e(order.original_order_text ?? "원문 미기재")}</div></div>
      <div class="detail-section"><h3>데이터 출처 및 검증 상태</h3>
        <div class="details-grid">${field("환자 ID", order.patient_id)}${field("자료 성격", "교육·시연용 가상 처방")}${field("성분 검증", order.review_status, true)}${field("테스트 시나리오", order.scenario_note, true)}</div>
      </div>
      <p class="detail-footnote">가상 약물 용량·투여 경로·간격은 교육용 화면 예시로, 개별 환자·제품에 대한 처방 적정성 검증을 거치지 않았습니다. 처방의 '유효' 표시는 지금 투약해도 된다는 의미가 아닙니다.</p>`;
    const button = byId("ackButton");
    if (button && allowAck) button.addEventListener("click", () => {
      try { state.reviews = appendAcknowledge(state.reviews, order, currentShift()); render(); }
      catch (error) { window.alert(error.message); }
    });
  }

  function render() {
    if (state.loading) return;
    fillStatusChoices();
    const total = state.orders.filter(o => o.patient_id === state.patientId);
    const prnTotal = total.filter(o => o.order_type === "prn");
    const visible = getVisibleOrders(state.orders, state);
    if (state.selectedOrderId && !visible.some(o => o.order_id === state.selectedOrderId)) state.selectedOrderId = null;
    byId("allCount").textContent = String(total.length);
    byId("prnCount").textContent = String(prnTotal.length);
    byId("visibleCount").textContent = `${visible.length}건`;
    const patient = state.patients.find(p => p.patient_id === state.patientId);
    byId("patientContext").textContent = `${patient ? patient.display_name : state.patientId} · 전체 ${total.length}건 / PRN ${prnTotal.length}건`;
    byId("patientSummary").innerHTML = patient ?
      `<div><strong>${e(patient.display_name)} (${e(patient.patient_id)})</strong> · ${e(patient.age)}세 / ${e(patient.sex)} · ${e(patient.bed)} · 입원 ${e(patient.admission_date)}</div>
       <div><strong>현재 병력:</strong> ${e(patient.primary_problem)} — ${e(patient.current_condition)}</div>
       <div><strong>과거력:</strong> ${e(patient.medical_history.join(", "))} · <strong>관찰 초점:</strong> ${e(patient.care_note)}</div>` : "가상 환자 정보가 없습니다.";
    const shift = currentShift();
    byId("sessionContext").textContent = shift ? `로그인 ${shift.login_id} · ${shift.nurse_name} · 모의 현재 시각 ${formatTime(shift.simulated_now)}` : "로그인 세션을 선택해 주세요";
    byId("viewNote").textContent = state.tab === "prn" ? "PRN 처방은 모든 상태를 표시하고 유효 처방을 먼저 배치합니다. 상태는 투약 가능 여부가 아닙니다." : "정규·PRN 약물 처방을 함께 표시합니다. PRN 탭을 눌러 필요한 처방만 모아 볼 수 있습니다.";
    byId("listFooter").textContent = `표시 ${visible.length}건 / 현재 탭 ${state.tab === "prn" ? prnTotal.length : total.length}건 · 상태 필터: ${state.status === "all" ? "전체" : htmlStatus(state.status)} · 모든 데이터는 임상 미검증 시연용 처방입니다.`;
    const body = byId("ordersBody");
    if (!visible.length) {
      const msg = total.length === 0 ? "이 환자에 대한 가상 처방이 없습니다." :
        (state.tab === "prn" && prnTotal.length === 0) ? "이 환자에게 등록된 PRN 약물 처방이 없습니다." :
        "검색어나 상태 필터에 맞는 처방이 없습니다.";
      body.innerHTML = `<tr><td colspan="7" class="table-message">${e(msg)}</td></tr>`;
    } else {
      body.innerHTML = visible.map(o => `<tr tabindex="0" role="button" aria-label="${e(o.ingredient_name_ko)} 가상 처방 상세 보기" data-order-id="${e(o.order_id)}" class="${o.order_id === state.selectedOrderId ? "is-selected" : ""}">
        <td>${badge(o.order_status)}</td><td><span class="drug-name">${e(o.ingredient_name_ko)}</span><span class="drug-sub">${e(o.order_id)} · ${modeText(o)}</span><span class="drug-sub">처방 ${e(o.prescriber_name || "미기재")} · 열람 확인 ${e(lastReview(o.order_id) ? getNurseName(lastReview(o.order_id).nurse_id) : "없음")}</span>${o.order_type==="prn"?`<span class="drug-sub prn-list-condition${miss(o.administration_condition)?" is-missing":""}">PRN 조건: ${miss(o.administration_condition)?"미기재":e(o.administration_condition)}</span>`:""}${o.order_revision>0?`<span class="drug-sub prn-list-revision">변경 버전 ${e(o.order_revision)} · 현재 지시 확인</span>`:""}</td>
        <td>${showVal(o.dose_instruction)}</td><td>${showVal(o.route_instruction)}</td><td>${showVal(o.indication)}</td><td>${showVal(o.frequency_instruction)}</td>
        <td><button type="button" class="detail-link" data-detail-id="${e(o.order_id)}" aria-label="${e(o.ingredient_name_ko)} 상세 보기">보기</button></td></tr>`).join("");
    }
    renderDetail();
  }

  function selectOrder(id) {
    if (!state.orders.some(o => o.order_id === id && o.patient_id === state.patientId)) return;
    state.selectedOrderId = id;
    render();
    if (window.matchMedia("(max-width: 850px)").matches) {
      byId("detailPanel").classList.add("mobile-open");
      byId("detailPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function loadData() {
    byId("ordersBody").innerHTML = '<tr><td colspan="7" class="table-message">가상 데이터를 불러오는 중…</td></tr>';
    try {
      const urls = ["./data/medication_catalog_candidates.json", "./data/simulated_orders_SCHEMA_ONLY.json",
        "./data/patients.json", "./data/staff_shifts.json", "./data/verification_events.json"];
      const response = await Promise.all(urls.map(url => fetch(url, { cache: "no-store" })));
      if (response.some(r => !r.ok)) throw new Error("가상 데이터 파일을 찾을 수 없습니다.");
      const [catalog, orders, patients, shifts, reviews] = await Promise.all(response.map(r => r.json()));
      validate(catalog, orders, patients, shifts, reviews);
      state.medCatalog = catalog;
      state.orderEvents = [];
      state.orders = enrichOrders(catalog, orders);
      state.patients = patients; state.shifts = shifts; state.reviews = reviews;
      state.sessionShiftId = shifts[0]?.shift_id ?? null;
      const patientIds = patients.map(p => p.patient_id);
      state.patientId = patientIds[0] ?? null;
      state.tab = "all"; state.status = "all"; state.query = ""; state.selectedOrderId = null;
      byId("searchInput").value = "";
      const picker = byId("patientSelect");
      picker.replaceChildren();
      for (const patient of patients) picker.add(new Option(`${patient.display_name} · ${patient.bed} (${patient.patient_id})`, patient.patient_id));
      const sessionPicker = byId("sessionSelect");
      sessionPicker.replaceChildren();
      for (const shift of shifts) sessionPicker.add(new Option(`${shift.shift_label} · ${shift.nurse_name}`, shift.shift_id));
      sessionPicker.value = state.sessionShiftId;
      picker.value = state.patientId;
      picker.disabled = patients.length === 0;
      sessionPicker.disabled = shifts.length === 0;
      byId("searchInput").disabled = false;
      byId("statusFilter").disabled = false;
      byId("tabAll").disabled = false;
      byId("tabPrn").disabled = false;
      state.loading = false;
      setTab("all");
      document.dispatchEvent(new Event("prn-data-ready"));
    } catch (error) {
      state.loading = true;
      byId("ordersBody").innerHTML = `<tr><td colspan="7" class="table-message"><strong>가상 데이터 로드 실패</strong><p style="margin-top:9px">${e(error.message)}</p><p style="margin-top:9px">HTML을 직접 열지 말고 프로젝트 폴더에서 <code>python -m http.server 8000</code>을 실행한 뒤 http://localhost:8000 으로 접속하세요.</p><button type="button" class="detail-link" id="retryLoad" style="margin-top:12px">다시 시도</button></td></tr>`;
      byId("retryLoad").addEventListener("click", loadData);
      byId("patientContext").textContent = "데이터 확인 필요";
      byId("visibleCount").textContent = "오류";
    }
  }

  // Narrow controlled interface for the simulation-only prescriber screen.
  // No backend persistence; no access to or mutation of nurse login/review state.
  window.PRNComposerHost = Object.freeze({
    context: () => ({
      patientId:state.patientId,
      patients:state.patients.slice(),
      catalog:state.medCatalog.slice(),
      existing:state.orders.slice(),
      doctors:[...new Map(state.orders.filter(o => o.prescriber_id && o.prescriber_name)
        .map(o => [o.prescriber_id,{prescriber_id:o.prescriber_id,prescriber_name:o.prescriber_name}])).values()],
      simulatedNow:currentShift()?.simulated_now ?? null,
      ready:!state.loading
    }),
    addOrder: (order) => {
      if(state.loading) throw new Error("가상 처방 정보를 불러오는 중입니다.");
      if(!order?.simulated_input || order.order_domain!=="medication" || !["regular","prn"].includes(order.order_type)
        || !["routine","stat"].includes(order.order_priority) ||
        order.patient_id!==state.patientId || state.orders.some(o=>o.order_id===order.order_id)) {
        throw new Error("현재 환자와 연관되지 않거나 중복된 가상 처방입니다.");
      }
      validate(state.medCatalog,[order],state.patients);
      const newOrder=enrichOrders(state.medCatalog,[order])[0];
      const nextEvents=window.PRNHistoryModel.createAddEvent([...state.orders,newOrder],state.orderEvents,newOrder);
      state.orders=[...state.orders,newOrder];
      state.orderEvents=nextEvents;
      setTab(order.order_type==="prn" ? "prn" : "all");
      state.selectedOrderId=order.order_id;
      render();
      document.dispatchEvent(new Event("prn-orders-changed"));
      return order.order_id;
    },
    getHistory: () => state.orderEvents.filter(x=>x.patient_id===state.patientId).map(x=>JSON.parse(JSON.stringify(x))),
    updateOrder: input => {
      if(state.loading)throw new Error("환자 데이터가 준비되지 않았습니다.");
      if(!window.PRNHistoryModel)throw new Error("처방 변경 모듈을 불러오지 못했습니다.");
      if(input.patient_id!==state.patientId)throw new Error("다른 환자에 대한 변경은 거부됩니다.");
      const doctors=[...new Map(state.orders.filter(o=>o.prescriber_id&&o.prescriber_name)
        .map(o=>[o.prescriber_id,{id:o.prescriber_id,name:o.prescriber_name}])).values()];
      if(!doctors.some(d=>d.id===input.actor_id&&d.name===input.actor_name))throw new Error("유효하지 않은 가상 처방자입니다.");
      const change=window.PRNHistoryModel.transition(state.orders,state.orderEvents,input);
      validate(state.medCatalog,change.orders,state.patients,state.shifts,state.reviews);
      state.orders=change.orders;
      state.orderEvents=change.events;
      state.selectedOrderId=input.order_id;
      render();
      document.dispatchEvent(new Event("prn-orders-changed"));
      return change.event.event_id;
    }
  });
  byId("tabAll").addEventListener("click", () => setTab("all"));
  byId("tabPrn").addEventListener("click", () => setTab("prn"));
  byId("sessionSelect").addEventListener("change", ev => { state.sessionShiftId = ev.target.value; render(); });
  byId("patientSelect").addEventListener("change", ev => {
    state.patientId = ev.target.value;
    state.tab = "all";
    state.status = "all";
    state.query = "";
    state.selectedOrderId = null;
    byId("searchInput").value = "";
    setTab("all");
  });
  byId("searchInput").addEventListener("input", ev => { state.query = ev.target.value; render(); });
  byId("statusFilter").addEventListener("change", ev => { state.status = ev.target.value; state.selectedOrderId = null; render(); });
  byId("ordersBody").addEventListener("click", ev => { const el = ev.target.closest("[data-detail-id], [data-order-id]"); if (el) selectOrder(el.dataset.detailId || el.dataset.orderId); });
  byId("ordersBody").addEventListener("keydown", ev => { if (ev.target.matches("tr[data-order-id]") && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); selectOrder(ev.target.dataset.orderId); } });
  byId("closeDetail").addEventListener("click", () => { byId("detailPanel").classList.remove("mobile-open"); state.selectedOrderId = null; render(); });
  loadData();
}
