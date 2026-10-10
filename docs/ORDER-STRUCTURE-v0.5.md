# PRN Order Viewer v0.5 — structured order model and limitations

## Scope and motivation
Make patient-specific synthetic prescription instructions easier to distinguish without falsely interpreting existing unverified text as clinically validated data. The 107 ingredient candidates are not a verified product/formulation catalog.

## Current data flow
Doctor UI => PRNOrderStructure.compose => PRNOrderComposer.createOrder => PRNComposerHost.addOrder => PRNHistoryModel.createAddEvent => patient-specific order view and acknowledgement. Later textual revisions go through PRNHistoryModel.transition and preserve versioned before/after snapshots.

## Compatibility boundary
- Original 18 orders: no changes or inferences.
- New free-text entries: same instruction fields plus `instruction_structure:null`.
- New typed entries: direct-entry structured representation plus human-readable legacy fields.
- Duplicate non-identical text and typed instructions on the same dimension: rejected, never silently reconciled.
- PRN classification uses `order_type`. STAT uses `order_priority` / `order_mode`. No coupling.
- A current order revision does not inherit an earlier revision's RN acknowledgement.
- Revising free-text dose, route, frequency or PRN condition flags typed sections as stale; the old values remain in the versioned event snapshots, not deleted.

## Schema v1
- product (name, form, strength): each optional string; not an approved product identity.
- dose (value, unit): positive decimal string and textual unit.
- route (code, display): small local UI vocabulary, not SNOMED CT.
- schedule: frequency count/period, interval value/unit, and local simulated HH:MM times are separate.
- prn: indication and condition, only for PRN orders.
- maximum: optional dose limit and/or administration-count limit in a user-entered period.
- verification_status: simulation_unverified; not a prescribing-validation result.
- stale_sections: lists old structure no longer current after a text revision.

## Risk controls
1. No silent conversion of existing text into numerical fields.
2. Input presence and formatting checks are not clinical decision support.
3. Missing dose/route/frequency still causes order-entry rejection, using typed or text input.
4. Human-readable instruction and typed counterpart cannot conflict at entry.
5. No automatic dose, cumulative limit, administration eligibility or route suitability calculation.
6. No IndexedDB, account, server, migration, JSON backup or deletion; current-tab-only data lifetime unchanged.
7. Product strings remain explicitly unverified and isolated from the ingredient master.

## Limitations / next decisions
- Clinical consistency across independently entered frequency/interval/times is not checked, and needs clinical requirements.
- The current doctor UI has both free-text inputs and a separate collapsed typed section; consider a single-mode structured editor after usability testing and user approval.
- The revision UI still edits free text; structured fields affected by a revision are flagged stale rather than automatically rewritten.
- These structured fields are not claimed HL7 FHIR compliant, fully coded, validated, or usable for real healthcare records.
- Confirm product catalog source, controlled units, route terminology, maximum-dose semantics and institutional rules before actual clinical deployment.

## Verification
- Existing project tests: `node --test tests/*.test.cjs` (plus `tests/v0.5-structure.test.cjs`).
- Browser smoke: `python tests/browser_smoke.py` with Playwright/Chromium, when available.
- Verify new typed-entry flow, patient switching, history snapshots, stale warnings, revisions and version-specific nurse acknowledgement in an actual browser before MVP release.
- State actual runs separately; never infer pass from tests only being committed.
