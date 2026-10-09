# 근거 출처·임상 검증 정책

**조사일:** 2026-10-10

## 출처 활용의 경계

- WHO ATC/DDD: 약물 성분과 치료·약리학적 대분류에 대한 **분류체계** 참조. PRN 처방 적합성은 증명하지 않음.
- ISMP (2019): 전자 처방의 약물명·빈도·용량·경로·PRN 적응증 표시 원칙에 대한 **UI 안전** 근거.
- ISMP (2024): 고위험 약물군의 **별도 안전조치 필요성** 참조. 임의의 개별 후보 등급을 인증해 주는 자료 아님.
- NICE NG5: 약물 정보 공유와 medication review의 중요성에 대한 일반 근거.
- MFDS 의약품 정보: 한국 내 구체적 제품 허가사항 **개별 확인 예정**. 이번 목록의 모든 성분을 확인한 것은 아님.
- DailyMed (NLM): 해외 제품 라벨 보조 확인. 한국 허가를 대신할 수 없음.
- HIRA 국내 ATC 매핑: 국내 제품과 ATC 코드 매핑에 관한 **후속 데이터 결합** 가능 경로. 이번 후보와 실제 매핑 작업 수행 안 함.

## 개별 후보 검증에서 추가할 열(향후)

`product_name`, `dosage_form`, `approved_indications`, `route`, `contraindications`, `label_source_url`, `label_verified_date`, `institution_prn_evidence`, `clinical_reviewer`, `review_outcome`.

등급 예시: `unverified` / `product_verified` / `clinical_reviewed` / `restricted`.
기준 충족 전에는 실제 투여 간격·최대량·일상 처방 사례를 임의 생성하지 않음.

## APA 7th references

Health Insurance Review & Assessment Service. (2026). *ATC 코드 매핑 목록 (2026-07-31)* [Data set]. 공공데이터포털. https://www.data.go.kr/data/15118958/fileData.do

Institute for Safe Medication Practices. (2019). *ISMP guidelines for safe electronic communication of medication information*. https://www.ismp.org/system/files/resources/2019-03/Electronic-Guidelines-2019.pdf

Institute for Safe Medication Practices. (2024). *ISMP list of high-alert medications in acute care settings*. https://dev-home.ecri.org/blogs/ismp-resources/high-alert-medications-in-acute-care-settings

National Institute for Health and Care Excellence. (2015). *Medicines optimisation: The safe and effective use of medicines to enable the best possible outcomes (NG5)*. https://www.nice.org.uk/guidance/ng5/chapter/Recommendations

National Library of Medicine. (n.d.). *DailyMed*. https://dailymed.nlm.nih.gov/dailymed/

Ministry of Food and Drug Safety. (n.d.). *식의약검색정보*. https://www.mfds.go.kr/mfdssearch/main.do

World Health Organization. (n.d.). *Anatomical Therapeutic Chemical (ATC) classification*. https://www.who.int/tools/atc-ddd-toolkit/atc-classification
