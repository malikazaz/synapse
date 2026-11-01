# Trusted clinical sources and student learning resources

Reviewed 1 November 2026. The live searchable directory is in Synapse → Sources. Its versioned data and generation policy live in `shared/sources.js` and are returned by `get_study_context`.

This is a curated starting directory, not a downloaded guideline library. The exact recommendation must be checked for every generated clinical answer. NICE, CKS, BNF and BNFC blocked automated retrieval during this research; their clinical content was not read. BNF/BNFC’s role was checked against the [publisher’s explanation](https://www.pharmaceuticalpress.com/bnf-and-bnfc/about), and CKS’s role against [NICE’s CKS guide](https://www.nice.org.uk/media/default/About/what-we-do/Evidence%20Services/CKS/CKS-guide.pdf). Access and reuse terms remain applicable.

## Core references across specialties

| Source | Use in Synapse | Boundary |
| --- | --- | --- |
| [NICE guidance](https://www.nice.org.uk/guidance) | Diagnosis, investigations, management, referral and prevention across medicine, surgery, psychiatry, neurology, cancer, primary care, children and women’s health | Check the particular recommendation, population, date and UK jurisdiction. |
| [NICE CKS](https://cks.nice.org.uk/) | Practical primary-care approaches, differentials, red flags and follow-up | A synthesis; inspect supporting guidance where needed. Access/reuse restrictions apply. |
| [BNF](https://bnf.nice.org.uk/) and [BNFC](https://bnfc.nice.org.uk/) | Adult and paediatric prescribing, interactions, cautions and monitoring | Verify patient-specific dosing context; never invent a checked monograph. |
| [MHRA Drug Safety Update](https://www.gov.uk/drug-safety-update) | Current warnings and changes that can supersede older teaching | Check the relevant dated alert, not just a search snippet. |
| [Electronic medicines compendium](https://www.medicines.org.uk/emc) | Exact product SmPC and leaflet | Product licensing information is distinct from guideline-supported off-label use. |
| [NHS conditions A–Z](https://www.nhs.uk/conditions/) | Plain-language explanations, counselling and safety-netting | Supplement professional guidance for detailed management decisions. |

Use current local NHS trust formularies and pathways when a question explicitly concerns that placement or institution. Label the setting. Consider SIGN/Scottish and other devolved-nation guidance when applicable; do not silently treat an England-specific pathway as universal. SIGN/Right Decisions could not be fetched in this research, so no individual recommendation from them was verified.

## Specialist references

| Area | Starting reference |
| --- | --- |
| Resuscitation and acute deterioration | [Resuscitation Council UK 2025 guidelines](https://www.resus.org.uk/professional-library/2025-resuscitation-guidelines) |
| Emergency medicine | [RCEM clinical standards and guidance](https://rcem.ac.uk/clinical-standards-and-guidance/) |
| Vaccination and public health | [UKHSA Green Book](https://www.gov.uk/government/collections/immunisation-against-infectious-disease-the-green-book), using the updated individual chapter |
| Respiratory medicine | [British Thoracic Society guidelines](https://www.brit-thoracic.org.uk/clinical-resources/guidelines/), including applicable joint guidance |
| Obstetrics and gynaecology | [RCOG Green-top guidelines](https://www.rcog.org.uk/guidance/browse-all-guidance/green-top-guidelines/) |
| Contraception | [CoSRH, formerly FSRH](https://www.cosrh.org/standards-and-guidance/) |
| Sexual health | [BASHH guidelines](https://www.bashh.org/resources/guidelines) |
| Child health | [RCPCH guidelines](https://www.rcpch.ac.uk/resources/clinical-guidelines), with NICE and BNFC |
| Inpatient diabetes | [JBDS](https://abcd.care/jbds-ip), selecting the appropriate population and current protocol |
| Renal medicine | [UK Kidney Association guidelines and commentaries](https://www.ukkidney.org/guidelines-and-commentaries) |
| Gastroenterology and hepatology | [British Society of Gastroenterology](https://www.bsg.org.uk/clinical-resource) |
| Rheumatology | [British Society for Rheumatology](https://www.rheumatology.org.uk/guidelines) |
| Trauma and orthopaedics | [BOA standards](https://www.boa.ac.uk/standards-guidance/boasts.html) |
| Dermatology | [British Association of Dermatologists guidelines](https://www.bad.org.uk/guidelines-and-standards/clinical-guidelines) |

For cardiology, neurology, mental health, oncology, older-person care, surgery, ENT and ophthalmology, start with relevant NICE guidance and identify a current UK specialist document where more detail is needed. The directory is deliberately non-exhaustive: an organisation’s reputation does not make all of its archived documents current. International guidance may fill a gap, but must be labelled and reconciled with UK practice.

## Curriculum, professionalism and assessment

- [GMC MLA content map](https://www.gmc-uk.org/education/medical-licensing-assessment/mla-content-map): scope and capabilities. The updated map applies from September 2026; match it to the learner’s assessment date. Do not change permanent Synapse topic IDs automatically.
- [GMC professional standards](https://www.gmc-uk.org/professional-standards/): professional duties, consent, confidentiality and communication.
- [MSC AKT preparation](https://www.medschools.ac.uk/for-students/medical-licensing-assessment/preparing-for-the-medical-school-applied-knowledge-test/): official practice materials and expectations.
- [Prescribing Safety Assessment](https://www.prescribingsafetyassessment.ac.uk/): official prescribing assessment information and school-accessible practice resources.
- Your school’s curriculum, teaching, assessment handbook and placement feedback establish local expectations. They do not automatically override newer clinical safety guidance.

## What other medical students rely on

A 2026 descriptive case study surveyed **31 of 64 final-year students at one medical school**. PassMedicine ranked highest for AKT preparation; Geeky Medics, personal notes, Zero to Finals, Anki and MSC practice papers also featured strongly. Quesmed, BMJ Best Practice and Oxford Handbooks were among the resources used. This small, self-reported, single-school study establishes use, not superiority or a causal effect on passing. [Full study](https://pmc.ncbi.nlm.nih.gov/articles/PMC13197485/).

Recent [UK medical-student discussion](https://www.reddit.com/r/medicalschooluk/comments/1vfaj4w/anki_study_approach_in_clin_yrs/) also mentions Anki, PassMedicine, Quesmed, Geeky Medics and Zero to Finals. This is anecdotal and non-representative; it should not determine clinical correctness.

| Resource type | Useful role | How to use alongside Synapse |
| --- | --- | --- |
| PassMedicine / Quesmed / other question banks | Exposure to exam-style practice and unfamiliar stems | Use licensed access separately. Generate original Synapse questions; do not copy bank items or explanations. |
| Geeky Medics | Structured learning and OSCE preparation | Pair reading with observed examination and communication practice. |
| Zero to Finals / established textbooks / teaching resources | Understand a topic and build a mental model | Verify management and numerical thresholds against current clinical guidance. |
| Anki / personal flashcards | Recall practice over time | Focus on your errors and useful clinical concepts; card completion is not mastery evidence. |
| BMJ Best Practice / Oxford Handbooks through permitted access | Clinical synthesis and background explanations | Check edition, updates, cited evidence and applicable UK pathway. Do not claim access to unread paywalled content. |
| Official school / MSC / PSA materials | Assessment-specific preparation and calibration | Use alongside supervised clinical learning, not as proof that one question-bank percentage predicts a pass. |

## Rules ChatGPT must follow

1. Read study context, the applicable blueprint and the source policy before generating.
2. Verify the precise source section. Save title, specific URL or supplied-document location, actual retrieval date, and an explanation tied to the decision being tested.
3. Establish the population and clinical setting. Check versions and supersession; explain meaningful disagreements or omit an ambiguous item.
4. Check prescribing details against an accessible current reference, including relevant age/weight, organ function, pregnancy, contraindications and alerts. Do not fill missing details from guesswork.
5. Write original single-best-answer questions. Explain the correct answer and important distractors. Avoid unsupported numerical thresholds, copied paid content and citations that only point to a homepage.
6. If a page is inaccessible, disclose it and find an authoritative accessible alternative, ask for an authorised extract, or omit the question. A fabricated retrieval date is never acceptable.
7. Distinguish referenced guidance from generated reasoning. Source metadata is not automated clinical validation; review disputed items and exclude errors with an audit trail.
8. Use fresh, varied cases and spaced review. Keep knowledge evidence separate from observed clinical-skills assessment and school exam outcomes.

No source subscription, scraping service, OpenAI model API or paid inference fallback has been added to Synapse. Browsing and generation remain user-initiated in ChatGPT; access to some references may require the learner’s existing university or NHS entitlement.
