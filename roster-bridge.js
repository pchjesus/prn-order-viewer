"use strict";
/* MICU v0.7.4 backup -> PRN on-duty preview. Read only; never authentication. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MicuRosterBridge = api;
})(globalThis, function () {
  const MAX_BYTES = 20 * 1024 * 1024;
  const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
  function fail(message) { throw new Error(message); }
  function canonical(value, depth = 0) {
    if (depth > 30) fail("백업 JSON 구조가 너무 깊습니다.");
    if (Array.isArray(value)) return value.map(v => canonical(v, depth + 1));
    if (isObject(value)) {
      const out = {};
      for (const key of Object.keys(value).sort()) {
        if (["__proto__", "constructor", "prototype"].includes(key)) fail("허용되지 않는 JSON 키입니다.");
        Object.defineProperty(out, key, {value: canonical(value[key], depth + 1), enumerable:true, writable:true});
      }
      return out;
    }
    return value;
  }
  async function verifyBackup(source, cryptoImpl = globalThis.crypto) {
    if (!isObject(source) || source.format !== "micu-full-backup" || source.formatVersion !== 1 ||
        !/^0\.7\.\d+$/.test(source.appVersion || "") || !isObject(source.data) ||
        !isObject(source.checksum) || source.checksum.algorithm !== "SHA-256") {
      fail("지원하지 않는 MICU 전체 백업 형식입니다(v0.7.x 백업 필요).");
    }
    if (!cryptoImpl || !cryptoImpl.subtle || typeof cryptoImpl.subtle.digest !== "function") {
      fail("이 브라우저에서는 백업 무결성을 검증할 수 없습니다. HTTPS 또는 localhost에서 실행하세요.");
    }
    const body = {format:source.format,formatVersion:source.formatVersion,appVersion:source.appVersion,createdAt:source.createdAt,data:source.data};
    const bytes = new TextEncoder().encode(JSON.stringify(canonical(body)));
    if (bytes.byteLength > MAX_BYTES) fail("백업 파일이 20MB보다 큽니다.");
    const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
    const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    if (actual !== source.checksum.value) fail("MICU 백업 검증값이 일치하지 않습니다.");
    for (const name of ["rosters", "personnel", "meta"]) {
      if (!Array.isArray(source.data[name])) fail("근무표 백업에 필수 자료가 없습니다.");
    }
    return source.data;
  }
  function validDate(dateText) {
    if (typeof dateText !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) fail("날짜를 선택해 주세요.");
    const [y, m, d] = dateText.split("-").map(Number);
    const parsed = new Date(Date.UTC(y, m-1, d));
    if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth()+1 !== m || parsed.getUTCDate() !== d) fail("유효하지 않은 날짜입니다.");
    return {y,m,d};
  }
  function getOnDuty(data, dateText, duty) {
    const date = validDate(dateText);
    if (!["D","E","N"].includes(duty)) fail("D/E/N 근무조만 지원합니다.");
    if (!isObject(data) || !Array.isArray(data.rosters) || !Array.isArray(data.meta) || !Array.isArray(data.personnel)) {
      fail("근무표 구조를 확인할 수 없습니다.");
    }
    const activeId = data.meta.find(row => row?.id === "activeRosterId")?.value;
    if (!activeId || typeof activeId !== "string") fail("MICU에서 '사용'으로 지정된 근무표가 없습니다.");
    const roster = data.rosters.find(row => row?.id === activeId);
    if (!roster || roster.year !== date.y || roster.month !== date.m) fail("선택한 날짜에 해당하는 활성 근무표가 없습니다.");
    const shifts = roster.shifts?.[String(date.d)];
    if (!Array.isArray(roster.all) || !Array.isArray(shifts) || shifts.length !== roster.all.length ||
        roster.all.length > 2000) fail("이 날짜의 근무표가 없거나 인원-근무코드 자료가 일치하지 않습니다.");
    const dutyCodes = roster.ruleSnapshot?.dutyCodes || { D:"D", E:"E", N:"N", NC:"N" };
    if (!isObject(dutyCodes)) fail("지원하지 않는 근무 코드 규칙입니다.");
    const personnel = data.personnel.find(x => x?.id === roster.id) || {profiles:{},contexts:{}};
    if (!isObject(personnel.profiles) || !isObject(personnel.contexts)) fail("근무자 변경 데이터 형식이 잘못되었습니다.");
    const ctx = String(date.y)+"-"+String(date.m)+"-"+String(date.d)+"-"+duty;
    const scope = personnel.contexts[ctx] || {added:[],excluded:[]};
    if (!Array.isArray(scope.added) || !Array.isArray(scope.excluded)) fail("추가·제외 근무자 정보가 잘못되었습니다.");
    const result = [], seen = new Set();
    const add = (person, id) => {
      if (!person || typeof id !== "string" || !id || seen.has(id) ||
          typeof person.name !== "string" || !person.name.trim() || person.name.length > 120) fail("근무자 식별정보가 올바르지 않습니다.");
      seen.add(id);
      const kind = person.kind || "nurse";
      if (kind === "nurse") result.push({id, name:person.name.trim(), group:String(person.group || "")});
    };
    roster.all.forEach((base, index) => {
      const mapped = Object.hasOwn(dutyCodes, String(shifts[index]).trim().toUpperCase()) ?
        dutyCodes[String(shifts[index]).trim().toUpperCase()] : null;
      if (mapped !== duty) return;
      const id = "source:"+roster.id+":"+index;
      if (scope.excluded.includes(id)) return;
      add({...base, kind:"nurse", ...(personnel.profiles[id] || {})},id);
    });
    for (const person of scope.added) {
      if (typeof person.id !== "string" || !person.id.startsWith("added:")) fail("추가 인원 ID 형식이 올바르지 않습니다.");
      if (!scope.excluded.includes(person.id)) add({...person,...(personnel.profiles[person.id] || {})},person.id);
    }
    return {date:dateText,duty,rosterId:roster.id,people:result,source:"MICU backup v0.7.x",loginVerified:false};
  }
  async function importBackupText(text, dateText, duty, cryptoImpl = globalThis.crypto) {
    if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_BYTES) fail("백업은 JSON이며 20MB 이하여야 합니다.");
    let file;
    try {file = JSON.parse(text);} catch (_) {fail("JSON 파일을 읽을 수 없습니다.");}
    const data = await verifyBackup(file, cryptoImpl);
    return getOnDuty(data,dateText,duty);
  }
  return {MAX_BYTES, canonical, validDate, verifyBackup, getOnDuty, importBackupText};
});
