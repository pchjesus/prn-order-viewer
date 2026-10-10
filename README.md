# PRN Order Viewer v0.1 — Synthetic EMR PRN Medication Viewer

> **EDUCATIONAL PROTOTYPE / SYNTHETIC DATA ONLY**
>
> 실제 가톨릭중앙의료원 nU 또는 서울성모병원 공식 시스템과 관계없는 독립형 교육·시연용 웹앱.
> **실제 환자정보, 실제 처방코드, 실제 병원 프로토콜을 포함하지 않음.**
> **실제 투약·임상적 판단에 사용 금지.**

## 문제 및 목표

가상 전체 약물 처방 목록에서 필요시(PRN) 약물 처방을 빠르게 식별하고 원문·누락값을 함께 확인하는 **읽기 전용 v0.1 웹앱**이다. 실제 nU 화면을 복제하거나 병원 시스템을 연동하지 않는다.

## 조사 결과와 한계

- 107개 **후보 성분/제제**를 18개 증상·목적 중심 카테고리로 정리함.
- 'PRN 후보'는 실제 임상 빈도·국내 품목 허가·nU 처방 존재·병원별 관행을 입증하는 말이 아니다.
- **모든 후보의 개별 허가/제품/투여정보는 추가 검증 전(`individual_review_pending`)**.
- 실제 약물 용량·간격·최대량, 처방 허용 여부 및 투여 판단은 기입하지 않음.
- `simulated_orders_SCHEMA_ONLY.json`의 처방들은 UI 테스트용 불완전한 객체이며 **투약 가능한 처방 아님**.

## 실행 방법 (Private 저장소 로컬/Codespaces 터미널)

먼저 저장소 루트 디렉터리에서 최신 파일을 가져온 뒤 로컬 HTTP 서버를 실행한다.

```bash
git pull origin main
python -m http.server 8000
```

`python` 대신 `python3` 또는 Windows의 `py` 사용 가능. 로컬 브라우저에서 `http://localhost:8000` 접속. GitHub Codespaces 환경에서는 **Ports → 8000 → Open in Browser** 사용(공개 포트로 변경하지 말 것). GitHub Pages나 별도 공개 웹주소는 사용하지 않는다.

직접 `index.html` 파일을 더블클릭하면 브라우저의 `file://` 보안 정책 때문에 JSON 데이터 읽기가 차단될 수 있다. 서버로 열어야 한다.

## 테스트

```bash
node --test tests/core.test.cjs
```

개발 검증: 순수 JavaScript/데이터 구조 테스트 **8건 통과**. Chromium에서 HTML·CSS·JavaScript를 실행하고 로컬 가상 JSON을 주입한 **데스크톱/모바일 상호작용 확인**도 수행했다. 검증 환경의 네트워크 제한으로 실제 localhost HTTP 접속은 테스트하지 못했으므로 사용자 터미널에서 수동 실행 확인이 필요하다.

## 파일

- `index.html`, `styles.css`, `app.js`: 정적 읽기 전용 웹앱
- `tests/core.test.cjs`: 데이터/필터/정렬/예외 로직의 Node.js 테스트
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

## 확정한 초기 UI/UX (2026-10-10)

- **첫 화면:** `전체 약물` 탭(선택 환자의 정규·PRN 처방 모두 조회).
- **PRN 기본 목록:** 상태 필터 `전체`로 시작하고, `active` 처방을 상단에 안정 정렬. 보류·중지 등 다른 상태는 숨기지 않음.
- **안전 원칙:** `active`는 투약 가능 판단이 아니며, UI 필터·정렬이 가상 처방의 원본 데이터를 변경하지 않음.
- 위 결정은 실제 nU의 UI나 동작을 복제한 것이라는 의미가 아님.

## 상태

- 기획 및 자료 수집: **초기 목록 작성 완료**
- 개별 약물 정보 임상 검증: **미완료**
- UX 최종 확정: **완료(2026-10-10, 두 항목 반영)**
- 앱 구현: **v0.1 핵심 조회 기능 구현 완료**
- 자동 검증: **Node.js 8건 통과**, Chromium 데스크톱·모바일 가상 데이터 주입 테스트 통과
- 실제 사용자 PC·Codespaces의 HTTP 서버 구동 및 시각 검토: **추가 확인 필요**
- GitHub 원격: **Private 저장소(main)에 v0.1 소스·테스트·설계 문서 커밋·푸시**

## 참조 원칙

프로젝트에 이미 지정된 `AI-개발-운영-가이드-Light` 및 `AI-Assisted-Software-Development-Skill-v1.4-Light`를 따라 작은 구현부터 단계적으로 검증한다. 해당 문서 원문은 이 저장소에 무단 복제하지 않음.