# GitHub 저장소 및 버전 관리

## 현황

- 저장소: `pchjesus/prn-order-viewer`
- URL: https://github.com/pchjesus/prn-order-viewer
- 공개 범위: **Private**
- 기본 브랜치: `main`
- 초기 등록 자료: `README.md`, `docs/`, `data/`
- 단계: v0.1 읽기 전용 웹앱 구현 및 자동 검증 완료(사용자 터미널 시각 확인 전)

## 후속 개발 규칙

1. 작업 전 원격 `main`의 파일과 최신 커밋 상태 확인.
2. 기존 자료·의사결정 보호, 가능한 최소 변경 적용.
3. 수정 범위에 따른 기능 검증 및 영향받는 기존 기능 회귀검증.
4. 관련 문서 갱신 후 목적이 드러나는 커밋 메시지 사용.
5. 원격 푸시 후 경로, 커밋 SHA, 검증 상태 확인.
6. 실제 환자정보, 내부 nU 화면, 병원 프로토콜이나 인증정보 업로드 금지.
7. Private 설정 유지. 공개·배포 기능은 사용자 승인 없이 활성화하지 않음.

## 확정한 UX 결정 (2026-10-10)

- 최초 진입 화면: **전체 약물 처방 탭**.
- PRN 목록의 기본 상태 필터: **전체 상태 표시**.
- PRN 전체 상태 보기의 표시 순서: **유효(`active`) 처방 상단 우선**, 다른 처방 상태도 모두 유지.
- 정확한 동작·안전 규칙 및 검증 기준은 `docs/SPEC-v0.1.md` 참조.
- 확정된 UX를 준수하여 v0.1 읽기 전용 웹앱을 구현했다. 후속 UX·임상 판단 기능은 사용자 검토 없이 확대하지 않는다.

## 비공개 저장소에서 직접 실행하기

저장소 루트의 GitHub Codespaces 또는 로컬 터미널에서:

```bash
git pull origin main
python -m http.server 8000
```

개발자 로컬 환경에서 `python3` 또는 `py`도 사용 가능. 브라우저 주소는 로컬에서 `http://localhost:8000`이며 Codespaces는 **Ports → 8000 → Open in Browser**를 사용한다. Codespaces 포트 접근 권한은 **Private**로 유지한다. GitHub Pages 활성화나 Public 저장소 변경은 하지 않는다.

테스트 명령: `node --test tests/core.test.cjs`.
