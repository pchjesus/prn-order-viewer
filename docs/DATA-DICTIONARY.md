# 데이터 사전 및 가상 코드 체계 (설계 전용)

## 엔터티

### MedicationCatalog

성분 및 약물 분류 중심의 **후보 마스터**. 실제 의료기관 처방이 아님.

- `medication_catalog_id`: 문자열, `SIM-MED-0001` 등, 프로젝트 내 고유 ID.
- `category_id`, `category_name_ko`: 사용 목적 중심 탐색 분류.
- `ingredient_name_ko`, `ingredient_name_en`: 성분/제제 명칭. 실물 제품·제형까지 검증되지 않음.
- `subgroup`: 세부 약리/치료적 분류(초안).
- `potential_prn_context`: PRN 시나리오를 검토할 수 있는 증상 맥락. **확정 적응증·개별 처방 내용 아님**.
- `candidate_level`: `basic`, `conditional`, `highrisk` (개발 검토용 분류).
- `review_status`: 모두 `individual_review_pending` (개별 허가/품목/용도 검증 미완료).
- `korea_authorization_check`: 모두 `not_checked`.
- `institutional_prn_use_verified`: 모두 `no`.
- `safety_review_note`: 개발 전 검토 고려사항으로서 의료 지시 아님.
- `source_scope`: 대분류·설계 원칙 수준의 출처 사용 범위 표시.

### Patient (추후 정의할 가상 환자)

- `patient_id`: `DEMO-P001` 처럼 실제 환자를 연상시키지 않는 내부 가상 ID.
- `display_name`: 가명.
- `patient_label`: 선택적 가상 병동 등.

### MedicationOrder

- `order_id`: `SIM-ORD-000001`, 개별 **가상 처방 고유 ID**. 실제 병원 처방코드가 아님.
- `order_display_name`: `[DEMO] 아세트아미노펜 / PRN` 같은 사용자용 **가상 처방명**.
- `patient_id`: Patient 참조.
- `medication_catalog_id`: MedicationCatalog 참조.
- `order_type`: `regular` 또는 `prn`, PRN 여부의 유일한 판별 근거.
- `order_status`: `active`, `on-hold`, `stopped`, `completed`, `cancelled`, `draft`, `entered-in-error`, `unknown` (FHIR 참조한 내부 모형, nU 실제 상태 체계 아님).
- `indication`: 해당 가상 처방에서 선택한 사용 목적. 누락은 `null`로 표시.
- `dose_instruction`, `route_instruction`, `frequency_instruction`, `maximum_limit_instruction`, `special_instruction`: 모두 초기 스키마 예시에서 `null`; 실제 복용/투여 지시 아님.
- `original_order_text`: **가상 스키마 표시 문자열**, 실제 병원 원문이 아님.
- `is_clinically_complete`: 현재 예시는 전부 `false`.
- `scenario_note`: 시연 목적 및 테스트 메모.

## 규칙 및 불변조건

1. `medication_catalog_id`와 `order_id`는 독립된 식별자이며 실제 HIRA/ATC/nU 코드와 무관하다.
2. 같은 약물 마스터를 참조하는 여러 처방이라도 합치지 않는다.
3. PRN 탭 = 선택 환자의 처방 중 `order_type === 'prn'`.
4. 처방 상태는 정렬/조회 상태일 뿐 투약 가능 판단이 아니다.
5. 필수 약물 지시가 없는 테스트 처방은 반드시 미완성으로 표시하며, 투여 근거로 보여주지 않는다.
6. 필터 적용 전후 원본 처방은 변경되지 않는다.
7. 환자 변경 시 검색·선택 처방·상태 필터 초기화 권고.

## 향후 검토를 위해 남겨둔 것

- 복합제의 성분별 식별과 다중 성분 테이블 분리 필요성
- 동일 성분 내 다른 제형·함량의 관리 방식
- 복잡한 처방 재발행/중지 이력 시뮬레이션
- 기관별 실제 처방 코드 매핑 기능 (v0.1 제외)


## v0.2 가상 환자·근무·확인 이력 확장 (2026-10-10)

### Patient (`data/patients.json`)

- `patient_id`, `display_name`, `age`, `sex`, `bed`, `admission_date`.
- `primary_problem`, `medical_history[]`, `current_condition`, `care_note`.
- **모든 필드가 가상**, 다른 시스템의 환자 식별자로 사용하지 않는다.

### MedicationOrder (기존 JSON에 추가)

- `prescriber_id`, `prescriber_name`, `ordered_at`: 개별 주문 시점의 가상 처방자 및 작성시각.
- `dose_instruction`, `route_instruction`, `frequency_instruction`: v0.2 예시값 일부 입력. 과학적·임상적 개별 검증을 의미하지 않으며 미입력은 `null`.
- `dose_review_status`: 모든 항목 `simulation_unverified`. **`is_clinically_complete=false` 유지**.

### NurseShift (`data/staff_shifts.json`)

- `shift_id`, `shift_label`, `nurse_id`, `nurse_name`, `login_id`.
- `starts_at`, `ends_at`, `simulated_now`: 오프셋 포함 ISO 8601 문자열. `starts_at <= simulated_now < ends_at` 검사.
- 로그인 선택은 UI 내 가상 계정 전환이므로 사용자 인증 기능이 **아님**.

### ReadAcknowledgement (`data/verification_events.json`)

- `event_id`, `order_id`, `nurse_id`, `shift_id`, `confirmed_at`, `action='read_acknowledgement'`.
- `nurse_id`는 `shift_id`의 로그인 간호사와 반드시 일치, `confirmed_at`은 근무시간 안에 있어야 함.
- 앱에서 새로 만드는 이벤트는 `session_only=true`; 입력 파일을 수정하지 않고 메모리에만 저장.
- 처방정보 확인 ≠ 처방 승인 ≠ 투약 수행 기록. 모든 의사는 가상 이름/코드.

## v0.3 가상 의사 입력 시 추가 필드 (현재 탭 메모리 한정)

- `order_domain`: `medication`; 미래 `service`/`procedure`는 별도 검증 객체가 필요함.
- `order_mode`: `regular` / `prn` / `emergency` (UI 입력 선택값).
- `order_type`: 기존 PRN 필터 호환을 위해 `regular` / `prn`만 사용. `emergency` 선택은 `regular`로 표시하고 `order_priority=stat`를 부여.
- `order_priority`: `routine` / `stat` (긴급도 축). 실제 임상 우선순위 결정에 사용하지 않음.
- `administration_condition`: PRN 세부 투여조건 문자열.
- `scheduled_at`: 선택적 가상 투여 시작/예정 시각(시간대 포함).
- `simulated_input`: 의사 입력 화면에서 생성된 **비영속·비임상** 기록임을 표시.
- `is_clinically_complete=false`, `dose_review_status=simulation_unverified`: 모든 가상 입력에 필수.
- `createEnvelope()`: 통합 연구용 가상 공통 참조 구조; 실제 FHIR 호환은 주장하지 않음.

자세한 모델 분리 및 다른 프로젝트와의 ID 매핑 제한은 `docs/THREE-PROJECT-CONVERGENCE-v0.3.md` 참조.

## v0.5 MedicationOrder structured instruction (explicitly entered only)

- `instruction_structure`: `null` for newly entered free-text-only orders; absent for the unchanged seeded 18 orders.
- `schema_version=1` and `source=explicit_simulated_input`, `verification_status=simulation_unverified`: no clinical verification.
- `ingredient_catalog_id`: catalog reference; not an actual drug product code.
- `product: {name,form,strength}`: independent, optional user-supplied simulated product data; no product catalog inference.
- `dose: {value,unit}`: decimal numeric **string** plus explicitly chosen unit. Numeric plausibility is not a clinical dose check.
- `route: {code,display}`: internal prototype mapping; not an assertion of institutional or terminology standard codes.
- `schedule: {frequency:{count,period}, interval:{value,unit}, times:[HH:MM]}`: optional and independent dimensions.
- `prn: {indication,condition}`: explicitly entered PRN reason and condition, not an administration decision.
- `maximum: {dose:{value,unit}, administrations:{count,period}}`: user-supplied maximum instructions only, with no cumulative dose logic.
- `stale_sections`: sections invalidated for current interpretation when a corresponding free-text field changes. Historical snapshots remain stored in memory.
- Existing `dose_instruction`, `route_instruction`, `frequency_instruction`, `maximum_limit_instruction`, `original_order_text`, `order_revision` remain compatible.
- Disallowed at v0.5: deriving structured fields from existing free-text orders, clinical administration eligibility, uncontrolled bulk medication enrichment, unauthorized persistence or migration.
