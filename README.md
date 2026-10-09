# PRN Order Viewer — Planning Baseline (v0.1)

> **EDUCATIONAL PROTOTYPE / SYNTHETIC DATA ONLY**
>
> 실제 가톨릭중앙의료원 nU 또는 서울성모병원 공식 시스템과 관계없는 독립형 기획자료.
> **실제 환자정보, 실제 처방코드, 실제 병원 프로토콜을 포함하지 않음.**
> **실제 투약·임상적 판단에 사용 금지.**

## 문제 및 목표

가상 전체 약물 처방 목록에서 필요시(PRN) 약물 처방을 빠르게 식별하고 핵심 정보를 놓치지 않게 조회하는 읽기 전용 UI를 설계한다.
현재 목표는 **기능 설계와 가상 데이터 후보 목록 수집**이다. 웹앱은 아직 구현되지 않았다.

## 조사 결과와 한계

- 107개 **후보 성분/제제**를 18개 증상·목적 중심 카테고리로 정리함.
- 'PRN 후보'는 실제 임상 빈도·국내 품목 허가·nU 처방 존재·병원별 관행을 입증하는 말이 아니다.
- **모든 후보의 개별 허가/제품/투여정보는 추가 검증 전(`individual_review_pending`)**.
- 실제 약물 용량·간격·최대량, 처방 허용 여부 및 투여 판단은 기입하지 않음.
- `simulated_orders_SCHEMA_ONLY.json`의 처방들은 UI 테스트용 불완전한 객체이며 **투약 가능한 처방 아님**.

## 파일

- `docs/SPEC-v0.1.md`: 목적, 기능/비기능 요구사항, 상태·UX 초안, 수용 기준
- `docs/DATA-DICTIONARY.md`: 약물 마스터와 처방의 분리, 가상 코드 체계, 스키마 필드
- `docs/MEDICATION-CANDIDATES.md`: 수집된 전체 후보 목록
- `docs/SOURCE-AND-VERIFICATION.md`: 근거 출처와 검증 정책
- `docs/DEVLOG.md`: 의사결정, 보류 사항, 진행상황
- `docs/GITHUB-SETUP.md`: private 저장소 생성 및 후속 커밋 절차
- `data/medication_catalog_candidates.csv` 및 `.json`: 후보 목록 원자료
- `data/simulated_orders_SCHEMA_ONLY.json`: 필터/상태 검사용 불완전한 가상 처방

## 설계상 핵심

1. `MedicationCatalog`와 `MedicationOrder` 분리. 같은 성분도 정규·PRN 처방 모두 가능.
2. `order_type=prn`인 처방만 PRN 탭에 노출.
3. 용량·간격 등 미검증 정보를 임의 보충하지 않음.
4. 처방상태(active 등)와 투약 가능성은 별개.
5. v0.1에서는 처방 정보 조회만. 실제 EMR 연동, 주문 생성·수정, 투약 판단 자동화 제외.

## 상태

- 기획 및 자료 수집: **초기 목록 작성 완료**
- 개별 약물 정보 임상 검증: **미완료**
- UX 최종 확정: **보류(사용자 결정 대기)**
- 앱 구현·실행·테스트: **미착수**
- GitHub 원격: **Private 저장소(main) 생성 확인, 초기 설계 자료 커밋·푸시 완료**

## 참조 원칙

프로젝트에 이미 지정된 `AI-개발-운영-가이드-Light` 및 `AI-Assisted-Software-Development-Skill-v1.4-Light`를 따라 작은 구현부터 단계적으로 검증한다. 해당 문서 원문은 이 저장소에 무단 복제하지 않음.