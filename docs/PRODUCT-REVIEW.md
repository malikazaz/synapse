# Synapse product and learning review

Reviewed 1 November 2026. This is a personal learning tool, not a validated clinical assessment or a prediction of examination success.

## Four perspectives

| Perspective | What the product needs | What this release provides | What still needs separate evidence |
| --- | --- | --- | --- |
| Software developer | Durable answers, understandable sync, private accounts, recovery, accessible navigation and useful empty/error states | Home dashboard; recent sessions and packs; device/cloud distinctions; cached-data labels; protected asynchronous navigation; searchable references; dynamic catalogue filters. Existing authentication, event deduplication, conflict preservation and backup paths remain. | Real iOS/Safari and Android device checks, ongoing quota/error monitoring and periodic restore drills. Browser emulation is not a physical-device certification. |
| Medical student | Know what to do next, continue quickly, see why a topic needs work, retain custom sets | Continue-session card; due reviews and topic gaps; first-answer results; editable study workflow through a prepared ChatGPT prompt; full paste/upload path; body-system, block, rating and topic-type filters | Personal exam dates, school-specific objectives and placement sign-offs are not yet tracked. Review date is a study schedule, not an exam timetable. |
| Professor | Original, referenced cases; defensible answers; broad coverage; feedback; no false mastery from repeats | Shared source policy delivered through MCP; primary topic/domain rules; visible evidence and retention requirements; dispute/exclusion audit and source-supported review workflow | A clinician-reviewed sample of generated packs, periodic checks for ambiguous distractors or stale guidance, and assessment of communication, examination and procedural skills. Source metadata alone does not prove a claim is correct. |
| Observer of effective study | Explain reasoning, improve gaps, transfer learning to unfamiliar patients, revisit knowledge later | Priorities and recent activity make study visible; fresh retention evidence is separated from repeated practice; homepage reminds the learner to apply knowledge on placement | Transfer to real clinical work and exam readiness must be judged through supervision, observed practice and school assessments. No claim that a Green dashboard ensures a pass. |

## Practical study cycle

1. Select the current placement block and inspect due reviews or weak domains.
2. Learn the clinical approach from verified references. Explain the differential, investigation choice, initial management and safety-netting aloud.
3. Request an original diagnostic or targeted pack in ChatGPT, then answer in Synapse without reading the explanation first.
4. Request a review of first answers and misconceptions. Check disputed questions against the exact source; exclude a flawed question rather than learning its error.
5. Return for genuinely fresh, spaced questions. Mix presentations across specialties to test transfer rather than pattern recognition alone.
6. Practise history, examination, communication and procedures with patients/peers and supervisors. Use official AKT practice papers, school mocks and prescribing practice for assessment-specific preparation.

The GMC distinguishes the AKT from the CPSA; an SBA dashboard covers only part of the required knowledge, skills and behaviours. [GMC MLA overview](https://www.gmc-uk.org/education/medical-licensing-assessment). Official practice materials should complement topic study. [MSC AKT preparation](https://www.medschools.ac.uk/for-students/medical-licensing-assessment/preparing-for-the-medical-school-applied-knowledge-test/).

## Changes in this release

- Default home view with real account data and device sessions, recent first-answer scores, review priorities, evidence counts and recent packs. Recent cloud activity is limited to the latest 100 sessions; it is not a lifetime activity total.
- Empty, disconnected and stale-cache states distinguish unknown data from zero progress. Pending device work does not become completed cloud evidence.
- Mobile navigation, touch targets, readable cards, theme-aware styling and a calmer default dark palette. Tables scroll within a labelled keyboard-accessible region.
- Navigation renders into a separate container and commits only if still current, preventing slow requests from replacing another view.
- Progress filters derive blocks and body systems from the catalogue; search includes aliases and stable IDs.
- A source directory and shared versioned policy in both the interface and `get_study_context`. No model calls or OpenAI API dependency added.

## Next product priorities

1. **Clinical quality assurance:** periodically sample generated questions with a clinical educator; track ambiguity, citation accuracy and outdated guidance. Do not describe unreviewed AI items as clinician-approved.
2. **Separate clinical-skills evidence:** a placement/OSCE log with observed feedback and explicit skill outcomes. Keep it separate from SBA RAG; do not infer skill competence from a correct MCQ.
3. **School blueprint and exam planning:** map school outcomes and assessment dates explicitly, with previewed catalogue changes. The GMC map is a blueprint, not an exhaustive textbook.
4. **Practical device validation:** user round trip on actual phone and computer, plus offline/reconnect and conflict checks. Maintain backup and restore practice.
5. **Long-term maintenance:** review source links and major guideline changes, reconcile catalogue exceptions, and inspect free-tier quotas before expanding usage.

These are future requirements, not features silently included in this release. The existing catalogue/history is preserved; its labels have not been automatically rewritten from a newer document.
