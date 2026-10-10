# DEVLOG

## 2026-10-10 / Planning baseline v0.1

### Confirmed intent
- 서울성모병원 EMR 실습 중 처방량으로 PRN 탐색이 어렵다고 느낀 경험에서 시작.
- 실제 병원 nU 화면·데이터가 없는 독립형 모형. nU 기능 부족을 단정하지 않음.
- 대상: PRN **약물** 처방만. 일반 약물은 비교 화면에만 포함.
- 광범위한 약물 후보 목록 수집. 실제 상품/병원 처방 승인 정보와 구분.
- 가상 처방명·처방코드 활용. 실제 nU/국가 코드와 혼동하지 않게 분리.
- GitHub **Private** 저장소를 이용하여 이후 변경사항 커밋·푸시 관리.

### Completed
- 카탈로그/가상 처방 분리 설계
- 증상별 18개 카테고리와 약물 후보 107개 초기 목록 작성
- 가상 처방 코드·표시명 설계 및 스키마용 미완성 처방 14건
- 요구사항·데이터사전·검증 절차 문서화
- GitHub `pchjesus/prn-order-viewer` Private/main 생성 확인
- 계획 문서와 가상 데이터를 `main`에 초기 커밋·푸시

### Incomplete
- 개별 약물/제품의 국내 허가 및 PRN 관행 검증 미완료
- 앱 구현 미착수. 동작·시각·회귀 검증 미진행

### Next
1. 확정한 UX를 기준으로 v0.1 구현 전 최종 점검
2. 후속 요청 시 최소 웹앱 구현(현재는 구현 금지)
3. 기능·상태·데이터 흐름 및 회귀검증
4. 추후 단계에서 의료정보 출처별 검증

## 2026-10-10 / UX decisions finalized (documentation only)

### Approved by user
1. 최초 진입 화면은 `전체 약물` 처방 탭.
2. PRN 조회 기본값은 `전체 상태`이며 `active` 처방을 위에 배치. 보류·중지 등의 다른 상태는 기본 목록에서 누락하지 않음.

### Documentation change
- `docs/SPEC-v0.1.md`: 선택값·안정 정렬·원본 불변 및 추가 테스트 조건 명문화.
- `README.md`: 확정된 UX와 기획 상태 기록.
- `docs/GITHUB-SETUP.md`: UX 보류 항목을 확정 항목으로 변경.
- **웹앱 코드, 의약품 후보 목록, 가상 처방 JSON은 변경하지 않음.**

### Verification boundary
- 이번 변경은 기획 문서 업데이트이며 실행·브라우저·임상 검증을 수행한 것은 아님.

## 2026-10-10 / v0.1 viewer implementation

### Implemented
- HTML/CSS/JavaScript 기반 읽기 전용 EMR형 UI: 환자 선택, 전체/PRN 탭, 검색/상태 필터, 상세정보/원문, 모바일 상세 보기.
- 최초 진입 `전체 약물`; PRN `전체 상태` 및 `active` 유효 처방 상단 안정 정렬.
- 107개 약물 후보·14개 가상 처방 JSON을 외부 변경 없이 사용, 누락된 투여정보는 `미기재 · 미검증`으로 표시.
- 필터·정렬이 원본 처방을 변경하지 않고 환자 변경 시 화면 상태를 초기화하는 처리.
- 명확한 DEMO 안내 및 실제 투약 판단 금지 고지.

### Tests and verification
- `node --test tests/core.test.cjs`: 8/8 통과(데이터 무결성·필터·정렬·환자격리·누락값·HTML 이스케이프·오류 입력 등).
- Chromium HTML/CSS/JS 브라우저 상호작용 확인: 기본 탭·PRN 정렬·검색·상태·상세·환자 전환·PRN 없는 환자·모바일 패널 정상.
- 검증 환경 정책 때문에 localhost 및 file:// 접근이 차단됨. 동일한 JSON을 브라우저에 주입해 인터랙션을 확인했으며, 실제 HTTP 배포 테스트를 대체한 것은 아님.
- 실제 사용자 PC/Codespaces 브라우저 시각·서버 검증은 별도 확인 필요.

### Known limitations / next
- 코드로 계산된 투여 가능 시간·용량은 없음. 기존 처방 데이터도 임상적으로 불완전.
- 실제 nU 연결·병원 내 처방 코드·환자정보 없음.
- 가상 환자 이름은 로컬 UI의 고정 예시명.
- 다음 단계는 사용자 화면 피드백 후 검색·표시 밀도·카테고리 기능 우선순위를 검토.


## 2026-10-10 / v0.2 synthetic patient, prescriber and review simulation

### User decisions
- 기존 UI에 만족하나 UI 배치는 언제든 변경 가능. 데이터/도메인 로직은 화면과 독립적으로 유지.
- 실제 병원과 연결하지 않는 3~5명 가상 환자, 과거력·현재병력 기반 처방 예시 구성.
- 기능 구현 우선, 수치는 교육·시연용 예시로 표시하며 실제 임상 지시로 오인 금지.
- 처방자와 확인자 표시. 확인자는 **가상 시각에 근무 중이며 선택되어 로그인된 간호사 계정**으로 자동 연결.

### Implemented
- `data/patients.json`: 가상 환자 4명(수술 후 회복, 검사 후 관찰, 기도질환 악화, 알레르기/가려움).
- `data/simulated_orders_SCHEMA_ONLY.json`: 14건 → 18건, 처방자·작성시각·예시 용량·경로·간격·원문 보완. 고위험 또는 미검증 일부 항목은 의도적으로 미기재.
- `data/staff_shifts.json`: D/E/N 3개 모의 계정 및 근무시각. 야간 근무는 날짜 경계 포함.
- `data/verification_events.json`: 근무조-간호사-시각 검증 가능한 이력 3건.
- `app.js`: 가상 환자·근무조·이력 참조 검증, 모의 로그인 간호사 기반 열람 확인 이벤트 생성, 중복 방지, 기존 PRN 탐색/정렬 유지.
- `index.html`, `styles.css`: 기존 목록·상세 UI는 유지하면서 환자 정보 및 로그인 선택·확인 이력 영역 추가.
- **확인은 실제 처방 승인 또는 투약 가능 판단이 아니라 열람 확인 시뮬레이션**.
- **새 확인 이벤트는 메모리에만 저장**, 페이지 새로고침 시 사라짐(데이터 보존 정책 사용자 최종 결정 전 영구 저장 안 함).

### Verified
- Node.js `node --test tests/core.test.cjs`: **14/14 통과**.
- Playwright/Chromium 가상 데이터 주입 UI 스모크: PC/모바일, 환자 A/B/C/D, 검색·필터·기본 상태, 처방자·확인자, 로그인 근무조 변경/이력 등록 및 중복 방지 검증 통과.
- Python HTTP 서버: 정적 루트와 JSON 파일을 HTTP 200 응답으로 로컬 확인.
- Chromium이 localhost 탐색을 관리자 정책으로 차단하므로, 실서버 URL을 Chromium으로 탐색하는 통합 검증은 미완료. 사용자 GitHub Codespaces 브라우저에서 수동 검수 필요.

### Known gaps
- 시연용 용량·경로·빈도는 환자별 개별 의약품 제품 정보/기관 지침 검증을 수행하지 않았으므로 **실투약에 사용 불가**.
- 모든 환자/직원/처방자 이름과 계정은 가상; 인증·권한/감사 이력 저장은 실제 병원 요건 충족하지 않음.
- UX는 교체 가능. 데이터 모델과 표시 레이어를 분리해 향후 재구성하도록 권고.

## 2026-10-10 / v0.2.1 MICU roster bridge (read-only)

### Repository comparison
- MICU v0.7.4 RC: active Excel roster & IndexedDB personnel state; full backup `micu-full-backup` v1 SHA-256.
- PRN v0.2: synthetic patient/order data, simulated nurse sessions and order read acknowledgements.
- Patient information does not belong in the MICU fire-evacuation staff assignment model; no patient dataset sync in this patch.

### Patch
- Added independent read-only MICU backup adapter (`roster-bridge.js`) and optional UI (`roster-bridge-ui.js`).
- No changes to PRN `app.js`, `data/`, MICU source or IndexedDB.
- Backup is explicitly selected and integrity-checked; uses active roster and selected date/duty; only nurses displayed.
- Staff list is not used to impersonate or authenticate an RN and does not change PRN verification events.
- Files ephemeral; no upload and no persistent storage. Private repo and local/Codespaces usage preserved.
- Added integration risk review document, independent test fixtures and race protection on reset/selection changes.

### Verification
- Independent V8 pure-module fixture verified canonical MICU SHA-256 compatibility, D/E/N & NC mapping, modified/added/excluded staff, tampered backup rejection and wrong-month rejection.
- `tests/roster-bridge.test.cjs` committed but full Node.js runner and real browser file picker are not confirmed in this environment.
- Browser acceptance deferred per user request until integrated MVP maturity.

### Follow-up proposals
1. Replace full-backup import with privacy-minimizing date/duty staff-only export contract after separate impact assessment of MICU repository.
2. Consider common pseudonymous staff identifiers, but do not equate roster presence with authentication.
3. Do not duplicate patient data across apps until MICU genuinely requires patient-level evacuation workflow.
4. Evaluate combined UI/modules only after isolated components and regression checks stabilize.
