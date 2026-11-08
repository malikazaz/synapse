# AKT learning and performance contract

Version: `akt-1` generation, `stage-1` progression, `ccs-2-akt` competency, `performance-1` analytics. Updated 1 November 2026.

## Curriculum and learning

All 655 imported catalogue topics keep their IDs, exact labels, type and associations. The five existing CCS domains are unchanged. They are application study dimensions; the catalogue does not claim to encode every GMC curriculum axis. Foundation, focused and clinical are additional per-question stages, independent of domain. Earlier questions without a stage remain unclassified; no historical relabelling is inferred.

New topics start with foundations. The suggested next stage requires five fresh first answers and at least 80% in the latest ten at each preparatory stage. These are transparent study heuristics, not validated cut-offs; the learner may override the suggestion. All stages contribute to the same topic record. Green retains the original accuracy, five-domain coverage and spaced retention requirements, and now also needs five clinical-stage questions at 80% or better in the latest 20. Previously Green topics can become Amber if application evidence is not labelled or sufficient. History is preserved.

Private Study plan settings include up to twelve named exam dates with optional blocks, current blocks, foundation pack size and recall-first preference. Date arithmetic uses UK calendar days. Concurrent saves reject stale revisions and keep a local draft. Saved plans sync across devices; editing requires a connection. A draft can be downloaded at sign-out but is not an automatically restored account setting.

## Recorded and derived performance

| Data | Meaning and storage |
| --- | --- |
| Catalogue | Topic ID/type, aliases, body systems and blocks; unchanged mappings |
| Question | Immutable text/options/key, stage, difficulty, objective, primary mapping, contextual tags, explanation, each option’s rationale and sources/retrieval dates |
| Attempt | Session ID, pack, ordered questions, start/completion times, revisions and every ordered answer selection |
| First-answer evidence | Distinct question fingerprint, first exposure, eligibility/exclusion and correct/incorrect; server scored |
| Retry paths | Every selection, attempts until correction, unresolved errors and practice-only repetitions; never extra mastery credit |
| Timing | Cumulative active focused/visible question milliseconds, recall-before-options milliseconds, visits and first option-reveal timestamp, saved with each answer |
| Confidence | Optional unsure/partial/confident self-report, snapshotted on submission; correlated with first-answer accuracy |
| Topic/domain/stage/difficulty | Evidence counts, lifetime and recent accuracy, preceding-window accuracy and descriptive percentage-point change where each window has at least five answers |
| Coverage/retention | Domain counts, gaps, RAG reason/version, last assessment, next review, overdue flag and suggested learning stage |
| Errors | Recent first-answer errors with selected/correct option text, objective, sources, confidence and measured time; number of sessions containing errors per topic |
| Reviews/audit | Source-supported reviews, mapping proposals/confirmation, exclusions and sync jobs |
| Priorities | Transparent ordering of Red, due, Amber and untested topics, weighted by coverage gaps and exams within 28 days; each includes evidence and a next action |

Raw events are authoritative; summaries are recomputed. Measurements live in immutable answer-event snapshots inside `sessions.state`, alongside the normalized answer-event index. No historical timing/confidence is fabricated. Short focus intervals between device checkpoints can be lost if a tab is forcibly closed; submitting an answer waits for its measurement and answer to be saved locally. Unanswered local observations are not cloud assessment evidence. Time on a question is not total study time, verified attention or competence. Private mental recall is never claimed to have been assessed.

`get_performance_profile` defaults to current blocks, supports topic/block filters and `allBlocks`, returns up to 100 ranked topics per call and ten recent errors. Raw session history remains available through `get_session_results` and full account backup. Homepage recent activity is still a bounded list, not a lifetime total. Aggregate profiles read the stored history and should be monitored for free-tier resource use as it grows.

Account backups are `synapse-backup-v3`, including pack collections/pins/archive, study settings, curriculum blocks/items and measurement-bearing session history. Legacy v1 and v2 imports remain supported. Restoring settings requires an empty plan as well as the existing empty-account history rule. No API keys or private credentials are in backups published to Git.

The Sheet’s existing CCS Progress A:M and MSK J:N remain structurally stable. Managed CCS Progress N:U adds suggested stage, three stage counts/accuracies and unclassified history. The upgrade refuses to overwrite existing extension content. Complete answer paths and measurements remain in D1/MCP/account exports, avoiding a spreadsheet row for every mouse or key event.

## Year 3 block views and linked ratings

The six supplied guides are represented as MSK, Mental Health, Medicine 1, Medicine 2, Surgery & Perioperative Care, and Primary Care. MSK is current; Mental Health is previously studied, which does not award mastery. The other blocks are upcoming. Future year imports add memberships and preserve topic IDs, classifications and assessment history. Guide wording, source location, mapping method and unresolved entries are retained independently of the UKMLA catalogue. The initial import contains 621 guide entries, with 25 unresolved entries flagged rather than guessed.

`get_curriculum_context` exposes block summaries and paginated guide items to ChatGPT. The managed CCS Curriculum and CCS Curriculum Map tabs show those records. Block tabs retain the original manual Confidence, Recall 1–3 and Notes columns and add the existing CCS projection by stable Record ID. There are 361 distinct linked topics across the six views, including retained MSK topics outside the supplied guide.

Manual ratings have one editable home per topic. Existing MSK rows remain their home; shared block rows, Domain 5/6 and Appendix A use stable-ID formulas to display that home's values. Column O identifies the editable row and provides an Edit ratings link where needed. This is a formula-linked view, not bidirectional synchronisation: edit the linked home rather than overwrite a formula in another view. Manual confidence remains separate from server-scored competency. A full workbook copy is taken before restructuring; changes are tested on a disposable copy first.

The app presents teaching blocks, guide sections, teaching scope (core, self-directed or supplementary) and body systems as independent filters. A topic can belong to a teaching block because of a linked specialty section: for example, bladder cancer is included in the MSK guide under radiology self-study, while retaining its urinary body-system classification. Each mapped topic shows its guide origin and expandable original wording, source location and mapping notes. Home and weak-point priorities also show guide context. Unmapped guide entries remain visible separately without competency credit.

Earlier catalogue groups, including Core MSK and Related MSK, appear separately from teaching blocks. Existing study-plan and exam selections keep their original stored values; browsing filters do not update settings, mappings, scores or the Sheet. The read-only curriculum API now supports bounded pagination so the app can display every guide entry, including those beyond the first 100. Owner-specific offline copies are stored in IndexedDB and labelled when stale. No catalogue migration, source re-import or spreadsheet edit is part of this presentation change.

## Ending or discarding sessions

My question packs separates active, completed, ended-early and discarded attempts. End session completes a fully answered attempt under normal first-answer scoring; otherwise it closes it as incomplete practice. Discard removes an unfinished attempt from active study, with a confirmation, while retaining its answers in a collapsed history. Neither action can discard a completed result. Incomplete or discarded attempts never award competency credit, and their prior exposures still prevent repeat questions earning fresh credit.

Account actions require a connection and synced answers. Closing uses revision checks, idempotent mutation IDs and an audit record. Other-device conflicts retain local answers for resolution. Local-only attempts can be closed offline. Account and device backups retain ended/discarded history; the current reader also accepts older backups. Closing incomplete attempts requires no spreadsheet changes; ordinary completed results use the existing sync path.

## Research and reference collection

The MCP playbook is original application guidance in `server/akt-skill.ts`, with clinical reference policy in `shared/sources.js`. It is returned as a tool, not a promise that ChatGPT has automatically read every source. Before saving a generated pack, ChatGPT must retrieve the playbook and verify each actual clinical claim.

- [MSC official practice papers](https://www.medschools.ac.uk/for-students/medical-licensing-assessment/practice-exam-for-the-ms-akt/) provide UK AKT format examples. Selected unmodified papers and the student handbook are stored privately for personal reference, not copied into a generated-question database. [MSC terms](https://www.medschools.ac.uk/terms-and-conditions/) permit personal noncommercial downloads and restrict systematic database copying.
- [NBME item-writing guide](https://www.nbme.org/sites/default/files/2021-02/NBME_Item%20Writing%20Guide_R_6.pdf) informs assessment construction, focused lead-ins and plausible parallel options. Its exam-writing emphasis on application is used for clinical-stage questions; direct foundational recall is an intentional preparatory learning format. UK clinical recommendations take precedence over non-UK clinical examples.
- [Trumble et al., 2024](https://link.springer.com/article/10.1007/s10459-023-10274-3) reviewed distributed and retrieval practice in health-professions education. The heterogeneous evidence supports those learning methods, not Synapse’s particular thresholds or a guaranteed exam result. The article is CC BY 4.0. Its publisher page/PDF was read online; the direct PDF download returned non-PDF content, so no downloaded research PDF is claimed.

`node scripts/download-akt-references.mjs` records retrieval timestamps, SHA-256 and rights notes under ignored `private/akt-library/`. It downloads selected documents, not entire sites or commercial question banks. Access failures remain explicit. Originals are not deployed or committed. Clinical guidelines must be checked live when questions are generated; this reference folder is not an automatically current clinical knowledge base.


## Practice-paper calibration (akt-2)

An editorial review of a supplied 30-item practice paper informed the general guidance returned by `get_akt_generation_skill`. The original paper and item-specific assessment remain private; no questions or inferred answer key were imported into the shared code or learning records. The sample is not treated as an official blueprint, a clinically validated bank or evidence of measured item difficulty.

The playbook now includes `practicePaperCalibration`: concise purposeful cases, decision-changing context, explicit pathway branches, separation of medication choice from overall management, competing-cause checks, qualified reassurance, credible parallel options, current-source checks, answer-cue removal and mapping from the actual lead-in. Reasoning stage remains separate from vignette length and competency domain. `preSaveReview` instructs ChatGPT to solve without the key, challenge the strongest alternative, verify sources and safety context, and repair or omit ambiguous items before saving.

MCP server instructions, the study-context response, tool descriptions and the homepage prompt all direct ChatGPT to call the current playbook for each generation request before drafting. The live tool can be called to inspect its version and content. This is instruction-based integration: there is no historical per-pack retrieval/compliance audit and no server-side clinical validation. Merely saving a structurally valid pack does not prove the model applied the guidance. No API inference, schema change, scoring change or spreadsheet write is involved.
