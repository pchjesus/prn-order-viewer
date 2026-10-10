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

  function validate(catalog, orders) {
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
          !["regular", "prn"].includes(order.order_type) || !order.order_status || !Object.hasOwn(STATUS, order.order_status)) {
        throw new Error("가상 처방에 잘못된 구분, 상태, 연결 또는 중복 ID가 있습니다.");
      }
      orderIDs.add(order.order_id);
    }
    return true;
  }

  function getVisibleOrders(orders, { patientId, tab = "all", query = "", status = "all" } = {}) {
    if (!Array.isArray(orders)) return [];
    const needle = String(query ?? "").trim().toLocaleLowerCase("ko");
    const matched = orders.filter(order => {
      if (!order || order.patient_id !== patientId) return false;
      if (tab === "prn" && order.order_type !== "prn") return false;
      if (status !== "all" && order.order_status !== status) return false;
      if (!needle) return true;
      return [order.order_display_name, order.order_id, order.indication, order.ingredient_name_ko, order.ingredient_name_en, order.medication_catalog_id]
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
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  return { STATUS, validate, getVisibleOrders, enrichOrders, distinctPatientIds, getStatusKeys, escapeHTML };
})();

if (typeof module !== "undefined" && module.exports) module.exports = PRNCore;

if (typeof document !== "undefined") {
  const { STATUS, validate, getVisibleOrders, enrichOrders, distinctPatientIds, getStatusKeys, escapeHTML: e } = PRNCore;
  const byId = id => document.getElementById(id);
  const state = { patientId: null, tab: "all", query: "", status: "all", selectedOrderId: null, orders: [], loading: true };
  const PATIENT_LABELS = {
    "DEMO-P001": "가상 환자 A · 혼합 처방",
    "DEMO-P002": "가상 환자 B · PRN 없음",
    "DEMO-P003": "가상 환자 C · 상태/중복 검증"
  };
  const miss = val => val === null || val === undefined || String(val).trim() === "";
  const showVal = val => miss(val) ? '<span class="missing">미기재 · 미검증</span>' : e(val);
  const badge = status => { const s = STATUS[status] || STATUS.unknown; return `<span class="status-chip ${s.className}">${e(s.label)}</span>`; };
  const htmlStatus = status => STATUS[status]?.label ?? "상태 미확인";

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
    const field = (label, val, full = false) => `<div class="detail-field${full ? " full" : ""}"><span class="detail-label">${e(label)}</span><span class="detail-value">${showVal(val)}</span></div>`;
    content.innerHTML = `
      <div class="detail-title">${e(order.ingredient_name_ko)}</div>
      <div class="detail-code">${e(order.order_id)} · ${e(order.medication_catalog_id)}</div>
      <div class="detail-badges">${badge(order.order_status)}<span class="type-chip">${order.order_type === "prn" ? "PRN" : "정규"} 처방</span></div>
      <div class="detail-alert">${order.is_clinically_complete === false ? "용량·경로·간격 등 핵심 투약정보가 미입력된 스키마 테스트 자료입니다. 투약에 사용하지 마세요." : "교육용 가상 데이터입니다. 실제 투약 판단에 사용하지 마세요."}</div>
      <div class="details-grid">
        ${field("가상 처방명", order.order_display_name, true)}
        ${field("처방 상태", htmlStatus(order.order_status))}
        ${field("약물 분류", order.category_name_ko)}
        ${field("1회 용량", order.dose_instruction)}
        ${field("투여 경로", order.route_instruction)}
        ${field("적응증", order.indication, true)}
        ${field("투여 빈도·간격", order.frequency_instruction, true)}
        ${field("최대량·횟수 지시", order.maximum_limit_instruction, true)}
        ${field("특이사항", order.special_instruction, true)}
      </div>
      <div class="detail-section"><h3>가상 처방 원문</h3><div class="order-original">${e(order.original_order_text ?? "원문 미기재")}</div></div>
      <div class="detail-section"><h3>데이터 출처 및 검증 상태</h3>
        <div class="details-grid">${field("환자 ID", order.patient_id)}${field("자료 성격", "교육·시연용 가상 처방")}${field("성분 검증", order.review_status, true)}${field("테스트 시나리오", order.scenario_note, true)}</div>
      </div>
      <p class="detail-footnote">처방의 '유효' 표시는 지금 투약해도 된다는 의미가 아닙니다. 실제 약물정보·처방 조건과 투여 적합성은 검증되지 않았습니다.</p>`;
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
    byId("patientContext").textContent = `${state.patientId} · 전체 ${total.length}건 / PRN ${prnTotal.length}건`;
    byId("viewNote").textContent = state.tab === "prn" ? "PRN 처방은 모든 상태를 표시하고 유효 처방을 먼저 배치합니다. 상태는 투약 가능 여부가 아닙니다." : "정규·PRN 약물 처방을 함께 표시합니다. PRN 탭을 눌러 필요한 처방만 모아 볼 수 있습니다.";
    byId("listFooter").textContent = `표시 ${visible.length}건 / 현재 탭 ${state.tab === "prn" ? prnTotal.length : total.length}건 · 상태 필터: ${state.status === "all" ? "전체" : htmlStatus(state.status)} · 모든 데이터는 미완성 교육용 처방입니다.`;
    const body = byId("ordersBody");
    if (!visible.length) {
      const msg = total.length === 0 ? "이 환자에 대한 가상 처방이 없습니다." :
        (state.tab === "prn" && prnTotal.length === 0) ? "이 환자에게 등록된 PRN 약물 처방이 없습니다." :
        "검색어나 상태 필터에 맞는 처방이 없습니다.";
      body.innerHTML = `<tr><td colspan="7" class="table-message">${e(msg)}</td></tr>`;
    } else {
      body.innerHTML = visible.map(o => `<tr tabindex="0" role="button" aria-label="${e(o.ingredient_name_ko)} 가상 처방 상세 보기" data-order-id="${e(o.order_id)}" class="${o.order_id === state.selectedOrderId ? "is-selected" : ""}">
        <td>${badge(o.order_status)}</td><td><span class="drug-name">${e(o.ingredient_name_ko)}</span><span class="drug-sub">${e(o.order_id)} · ${o.order_type === "prn" ? "PRN" : "정규"}</span></td>
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
      const urls = ["./data/medication_catalog_candidates.json", "./data/simulated_orders_SCHEMA_ONLY.json"];
      const response = await Promise.all(urls.map(url => fetch(url, { cache: "no-store" })));
      if (response.some(r => !r.ok)) throw new Error("가상 데이터 파일을 찾을 수 없습니다.");
      const [catalog, orders] = await Promise.all(response.map(r => r.json()));
      validate(catalog, orders);
      state.orders = enrichOrders(catalog, orders);
      const patients = distinctPatientIds(state.orders);
      state.patientId = patients[0] ?? null;
      state.tab = "all"; state.status = "all"; state.query = ""; state.selectedOrderId = null;
      byId("searchInput").value = "";
      const picker = byId("patientSelect");
      picker.replaceChildren();
      for (const id of patients) picker.add(new Option(`${PATIENT_LABELS[id] ?? "가상 환자"} (${id})`, id));
      picker.value = state.patientId;
      picker.disabled = patients.length === 0;
      byId("searchInput").disabled = false;
      byId("statusFilter").disabled = false;
      byId("tabAll").disabled = false;
      byId("tabPrn").disabled = false;
      state.loading = false;
      setTab("all");
    } catch (error) {
      state.loading = true;
      byId("ordersBody").innerHTML = `<tr><td colspan="7" class="table-message"><strong>가상 데이터 로드 실패</strong><p style="margin-top:9px">${e(error.message)}</p><p style="margin-top:9px">HTML을 직접 열지 말고 프로젝트 폴더에서 <code>python -m http.server 8000</code>을 실행한 뒤 http://localhost:8000 으로 접속하세요.</p><button type="button" class="detail-link" id="retryLoad" style="margin-top:12px">다시 시도</button></td></tr>`;
      byId("retryLoad").addEventListener("click", loadData);
      byId("patientContext").textContent = "데이터 확인 필요";
      byId("visibleCount").textContent = "오류";
    }
  }

  byId("tabAll").addEventListener("click", () => setTab("all"));
  byId("tabPrn").addEventListener("click", () => setTab("prn"));
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
