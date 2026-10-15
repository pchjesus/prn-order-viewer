# AI-Assisted Development B+ & GitHub CI Policy v1.0

> **Approved project-wide operating policy, 2026-10-15.** Applies to all repositories owned by `pchjesus`. Based on **AI-Assisted Software Development Skill v1.4** and the user's established implementation/risk review contract. Use alongside the project's latest AGENTS/SPEC/README/DEVLOG and approved UX, safety, scientific, data, release and CI contracts; **project-specific protections take priority**. This policy does not authorize application/model/data redesign.

## 1. Goal: fewer public patches, stronger design and appropriate verification

Move from ad-hoc incremental releases to **version-level, goal-coherent integration**:
`inspect current main → understand users and data/state → design entire goal → risk/acceptance review → implement incremental internal commits → run relevant tests repeatedly → focused PR review/CI → full release regression → report/ship`.

**Fewer public patches is not fewer code checkpoints.** Preserve small, revertible internal commits, targeted local/agent tests and hotfixes for serious defects. Avoid large unrelated feature bundles merely to reduce CI runs.

## 2. Definition of Ready (DoR)

Before material implementation:
1. Confirm latest `main`, actual code, current contracts and unresolved bugs; do not rely on historical version labels.
2. Define one learner/user/workflow goal, scope and explicit non-goals.
3. Draw information hierarchy/flow or state transitions when meaningful; include desktop/mobile and accessibility.
4. Identify source-of-truth state, navigation/return/reset, persistence, calculations, data provenance, content approval and compatibility boundaries.
5. Describe important regression hazards, fallback/rollback and what existing functions must remain intact.
6. List observable acceptance scenarios and the exact planned test groups.
7. Bring **material UX/clinical/business-product decisions** to the user with consequences, but decide routine implementation details autonomously.
8. Record a compact version design contract before the release-scale code change. Trivial text/CSS fixes may use a brief issue/commit rationale instead.

A design contract reduces avoidable revision; it is not proof of correct implementation. If reality invalidates the design, update the contract and tests before proceeding.

## 3. Integration workflow and release discipline

- Use one feature branch and, where practical, one cohesive PR for a **single user outcome**. Within that branch, use reversible internal commits; do not force one giant unreviewable commit.
- Perform syntax/unit/model/data checks early, focused state/UI integration checks at feature boundaries, and broad regression before release. Run tests in the available local/agent environment without consuming hosted CI when suitable, but never falsely claim GitHub CI PASS.
- Do not reset live simulation progress, quiz sessions, patient/roster/order data, pending edits, animation clocks or browser navigation state merely for aesthetic improvements.
- Consolidate routine low-risk follow-ups into the planned release. Permit urgent focused hotfixes for corruption, safety, accessibility regression or blocked core flows.
- Distinguish **implemented**, **automated-tested**, **manually device-tested**, **subject-matter reviewed**, **released** and **FINAL**. CI PASS never substitutes for human/student/clinical or real-device approval.
- Define Done as accepted scope implemented, affected old functions regressed, evidence recorded, docs/versions updated, and remaining limitations disclosed.

## 4. Four-level CI/QA scheme (B: balanced)

| Level | Trigger policy | Purpose | Required decision rule |
|---|---|---|---|
| **FAST** | PR validation / internal development | Syntax, unit, schema, content integrity, fundamental state | Run whenever executable/model/data source changes; keep brief |
| **FOCUSED** | PR with material UX, interaction, browser or integration impacts | Browser tests for the affected screen, surrounding navigation and persisted state | Test touched flows **and likely regressions**, not only happy path |
| **FULL** | Release candidate, major model/state change, broad refactor, explicit manual dispatch; also when a project-specific approved contract mandates it | Complete historical/current regression with relevant viewports and state boundaries | Never remove or silently weaken historical/safety-critical tests |
| **RELEASE** | Approved ship/deployment, not every intermediate patch | Packaging, artifact correctness, deploy and post-deploy smoke | Retain the existing release approval and any published site contract |

**When scope is uncertain, run broader tests.** Path/filename-only classification cannot safely distinguish UI from physiology in mixed HTML/JS. Do not make a test green by deleting assertions, changing fixtures or silently excluding test suites.

## 5. GitHub Actions efficiency and safety

- Prefer **PR as the development validation entry**, with `main` Push restricted to protected final checks, publishing or release responsibilities. Avoid duplicate full runs from feature-branch `push` + `pull_request`; protect direct-`main` changes when possible.
- For the same PR, `concurrency` may cancel **superseded** runs. Do **not** auto-cancel `main` builds/deployments, user-launched FULL checks, unrelated PRs or release runs.
- Keep required checks stable. Avoid a workflow-wide `paths-ignore` that leaves mandatory checks Pending. If later adopting classification jobs, use an always-resolved required summary gate and document any intentional skips.
- Prefer pinned/reproducible dependencies and `npm ci` when a working lockfile exists. Cache cautiously; measure actual startup/install benefits before caching huge browsers.
- Keep cheap tests before expensive browser tests. Consider grouping very small jobs to avoid per-job minute rounding; splitting is worthwhile for early failure and parallelism only when justified.
- Upload screenshots/artifacts on failures, UI reviews and releases where useful; avoid producing excessive long-retention artifacts on every nonvisual patch.
- Observe public/private billing differences. Public standard hosted runners are normally free; **private-ready efficiency is still the design target**. Do not change repository visibility, payment settings or testing guarantees as a cost workaround without user approval.
- GitHub runner/job start failure is **CI not run**, not a software test FAIL/PASS. Inspect runner assignment, billing/limits and infrastructure before patching application code.
- Report checks at the exact tested SHA; do not reuse previous green results for a later commit.

## 6. Regression minimum by project type

- **Ventilator:** PB980 device reference, 7 settings pending/accept/cancel, fixed monitor versus simulated waveforms, LAB prediction gating, CORE/CASE sessions, route to the separate learning room, responsive controls.
- **RAAS:** stages, current/max progress, drugs, 4 physiological variables, Canvas path/graph, study vs clinical sessions, Lab source fidelity.
- **Cardiac:** canonical A/B clocks, Play/Pause/Reset/Timeline, HR and ECG/conduction/mechanical/Wiggers synchronization, single DOM/model instance, 3 top-level tabs, Guided/course/case isolation and clinical-review gate.
- **One Piece:** original character/evaluation data, 7-stat calculation, ranking, matchup, organization membership, character state, image/source provenance, public Pages publication.
- **MICU evacuation:** roster import/interpretation, duty/seniority assignment, overrides, IndexedDB transactions/migration/conflict, save/reload and audit history.
- **PRN/nursing order:** fictional patient/order/session boundaries, selection/record/version history, synthetic-data integrity, read-only study views, and no accidental real patient data.
- **Desktop Pet:** Electron window/main-process boundaries, movement/drag/click, per-character state and sprites, Windows package verification before claiming executable-ready.

## 7. Reports, approvals, and rollback

For each cohesive PR/release record:
- baseline SHA and feature scope;
- affected state, data, UI, model, saved information and navigation;
- tests actually run and result, including scripts, runner/OS, and SHA;
- skipped/blocked tests and their precise limitation;
- changed-file list, rollback plan, user-facing differences;
- remaining manual, accessibility, clinical, browser/device or licensing review.

This policy is a **forward-looking development contract**. Adding it alone does **not** constitute passing functional/clinical tests or approve UI redesign. Update the policy via reviewed version change when the workflow evolves.
