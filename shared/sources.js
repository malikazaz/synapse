// A reference directory, not downloaded clinical content or an endorsement of every page.
export const SOURCE_POLICY_VERSION='uk-sources-1';
export const SOURCE_REVIEW_DATE='2026-11-01';
export const SOURCE_POLICY=[
  'Use the GMC MLA map applicable to the assessment date and the medical school curriculum to set scope; neither is a treatment guideline.',
  'Support clinical answers with current NICE guidance, BNF/BNFC, MHRA safety updates or relevant UK specialist guidance. Check jurisdiction, population, setting, publication/update date and whether guidance is archived or superseded. Do not silently combine conflicting pathways.',
  'Read the exact supporting page or supplied extract. Cite its title, specific URL/section and actual retrieval date. A directory link or search snippet is not evidence that the recommendation was verified. If access fails, disclose it and use an accessible authoritative alternative, request an authorised extract, or omit the question.',
  'For prescribing verify indication, dose, route, frequency, duration, age/weight, renal or hepatic adjustments, pregnancy, contraindications and relevant safety alerts. Do not invent missing details. Distinguish licensed product information from guideline-supported off-label use.',
  'Teaching sites, textbooks and question banks are learning aids; cross-check management and numerical thresholds against current clinical references. Write original questions; do not copy paid banks, bypass access controls or bulk reproduce licensed material.',
  'Use five plausible options and one defensibly best answer, explaining the correct answer and key distractors. Cover recognition, investigations, management and red flags, not just recall of labels. Vary age, setting and presentation; include uncertainty and escalation where appropriate.',
  'SBA performance is study evidence, not a pass prediction or proof of bedside competence. This system focuses on AKT knowledge. Use official school assessments and mocks to judge exam readiness.'
];
const source=(name,group,url,use,access='Public guidance; check individual document status and reuse terms.')=>({name,group,url,use,access});
export const TRUSTED_SOURCES=[
  source('GMC MLA content map','Curriculum & assessment','https://www.gmc-uk.org/education/medical-licensing-assessment/mla-content-map','Blueprint for presentations, conditions and capabilities. Select the map for your assessment date.'),
  source('Medical Schools Council AKT preparation','Curriculum & assessment','https://www.medschools.ac.uk/for-students/medical-licensing-assessment/preparing-for-the-medical-school-applied-knowledge-test/','Official practice papers and assessment expectations; combine with your school curriculum.'),
  source('Prescribing Safety Assessment','Curriculum & assessment','https://www.prescribingsafetyassessment.ac.uk/','Official prescribing assessment information and practice resources through your medical school.'),
  source('GMC professional standards','Curriculum & assessment','https://www.gmc-uk.org/professional-standards/','Professionalism, consent, confidentiality, communication and duties.'),
  source('NICE guidelines','Core clinical references','https://www.nice.org.uk/guidance','First stop across medicine, surgery, mental health, cancer, neurology, women’s health, children and primary care. Check applicability within the UK.','Public pages; automated retrieval may be blocked. Read the exact recommendation.'),
  source('NICE Clinical Knowledge Summaries','Core clinical references','https://cks.nice.org.uk/','Practical primary-care assessment, differential diagnosis, red flags and management.','Access and reuse restrictions apply; automated retrieval may be blocked.'),
  source('BNF','Core clinical references','https://bnf.nice.org.uk/','Adult prescribing, treatment summaries, interactions, contraindications and monitoring.','Access/licensing restrictions apply. Never claim to have checked an inaccessible monograph.'),
  source('BNF for Children','Core clinical references','https://bnfc.nice.org.uk/','Paediatric prescribing: verify age, weight, formulation and dosing context.','Access/licensing restrictions apply; use an authorised source or supplied extract.'),
  source('MHRA Drug Safety Update','Core clinical references','https://www.gov.uk/drug-safety-update','Current medicine safety warnings and restrictions that may update older teaching.'),
  source('Electronic medicines compendium','Core clinical references','https://www.medicines.org.uk/emc','Product-specific SmPCs and patient leaflets. Distinguish licensed use from guideline recommendations.'),
  source('Resuscitation Council UK','Specialty guidance','https://www.resus.org.uk/professional-library/2025-resuscitation-guidelines','Adult, paediatric and newborn resuscitation; current algorithms and acute escalation.'),
  source('UKHSA Green Book','Specialty guidance','https://www.gov.uk/government/collections/immunisation-against-infectious-disease-the-green-book','Vaccination and immunisation. Check the individual chapter’s update date.'),
  source('British Thoracic Society','Specialty guidance','https://www.brit-thoracic.org.uk/clinical-resources/guidelines/','Respiratory medicine; use current joint NICE/BTS/SIGN guidance where applicable.'),
  source('RCOG Green-top Guidelines','Specialty guidance','https://www.rcog.org.uk/guidance/browse-all-guidance/green-top-guidelines/','Obstetrics and gynaecology; exclude archived recommendations unless discussing history.'),
  source('CoSRH (formerly FSRH)','Specialty guidance','https://www.cosrh.org/standards-and-guidance/','Contraception and sexual/reproductive healthcare; check the current guideline version.'),
  source('BASHH','Specialty guidance','https://www.bashh.org/resources/guidelines','Sexually transmitted infections and sexual health.'),
  source('RCPCH','Specialty guidance','https://www.rcpch.ac.uk/resources/clinical-guidelines','Child health guidelines; combine with NICE and BNFC.'),
  source('JBDS for Inpatient Care','Specialty guidance','https://abcd.care/jbds-ip','Inpatient diabetes and metabolic emergencies; distinguish adult and paediatric pathways.'),
  source('UK Kidney Association','Specialty guidance','https://www.ukkidney.org/guidelines-and-commentaries','Renal disease, electrolyte problems and UK interpretations of international guidance.'),
  source('British Society of Gastroenterology','Specialty guidance','https://www.bsg.org.uk/clinical-resource','Gastroenterology, hepatology and endoscopy; select guidelines rather than news.'),
  source('British Society for Rheumatology','Specialty guidance','https://www.rheumatology.org.uk/guidelines','Rheumatology, inflammatory disease and specialist treatment monitoring.'),
  source('British Orthopaedic Association standards','Specialty guidance','https://www.boa.ac.uk/standards-guidance/boasts.html','Trauma and orthopaedic initial management, time-critical injuries and escalation.'),
  source('British Association of Dermatologists','Specialty guidance','https://www.bad.org.uk/guidelines-and-standards/clinical-guidelines','Dermatology guidance; check current status.'),
  source('Royal College of Emergency Medicine','Specialty guidance','https://rcem.ac.uk/clinical-standards-and-guidance/','Emergency assessment and management; distinguish guidelines from advisory statements.'),
  source('NHS conditions A–Z','Patient explanations','https://www.nhs.uk/conditions/','Plain-language explanations, counselling and safety-netting. Use professional guidance for detailed management.')
];
