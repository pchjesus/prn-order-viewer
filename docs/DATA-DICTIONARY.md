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
