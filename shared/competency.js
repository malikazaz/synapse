import { DOMAINS } from './quiz.js';
export const RULE_VERSION = 'ccs-2-akt';
const DAY = 86400000;

// rows are first selections, ordered by actual first exposure. Excluded/unmapped
// first exposures still consume the fingerprint: later retakes cannot gain credit.
export function eligibleEvidence(rows) {
  const seen = new Set();
  return [...rows].sort((a, b) => a.exposedAt.localeCompare(b.exposedAt) || (a.exposureOrder??0)-(b.exposureOrder??0) || a.eventId.localeCompare(b.eventId)).filter(r => {
    if (seen.has(r.fingerprint)) return false;
    seen.add(r.fingerprint);
    return r.completedAt && r.topicId && DOMAINS.includes(r.domain) && !r.excluded;
  });
}

function snapshot(rows) {
  const recent = rows.slice(-20);
  const accuracy = recent.length ? recent.filter(r => r.correct).length / recent.length * 100 : null;
  const domains = DOMAINS.map(id => {
    const rs = recent.filter(r => r.domain === id);
    return { id, count: rs.length, accuracy: rs.length ? rs.filter(r => r.correct).length / rs.length * 100 : null };
  });
  const assessments = [...new Set(rows.map(r => r.sessionId))].map(id => {
    const rs = rows.filter(r => r.sessionId === id);
    return { at: rs[0].completedAt, count: rs.length, accuracy: rs.filter(r => r.correct).length / rs.length * 100 };
  }).filter(a => a.count >= 5).sort((a,b) => a.at.localeCompare(b.at));
  const latest = assessments.at(-1);
  const retained = latest && latest.accuracy >= 85 && assessments.some(a => Date.parse(latest.at) - Date.parse(a.at) >= 7 * DAY);
  const covered = domains.every(d => d.count >= 2);
  const clinical=recent.filter(r=>r.learningStage==='clinical');
  const applied=clinical.length>=5&&clinical.filter(r=>r.correct).length/clinical.length>=.8;
  let status = !recent.length ? 'Untested' : accuracy < 50 ? 'Red' : 'Amber';
  if (accuracy >= 85 && covered && domains.every(d => d.accuracy >= 50) && retained && applied) status = 'Green';
  const reasons = [];
  if (!recent.length) reasons.push('No eligible first-attempt evidence');
  else {
    if (accuracy < 85) reasons.push('Recent accuracy below 85%');
    if (!covered) reasons.push('Need two questions in each domain');
    if (domains.some(d => d.count && d.accuracy < 50)) reasons.push('A domain is below 50%');
    if (!retained) reasons.push('Need a successful fresh reassessment at least seven days later');
    if (!applied) reasons.push('Need five clinical-application questions with at least 80% accuracy in the recent window');
  }
  return { status, accuracy, domains, applicationEvidence:clinical.length,coverage: domains.filter(d => d.count >= 2).length, reason: reasons.join('; ') || 'Knowledge coverage, application and retention demonstrated' };
}

export function calculateCompetency(rows, now = new Date().toISOString()) {
  rows = [...rows].sort((a,b) => a.completedAt.localeCompare(b.completedAt) || a.exposedAt.localeCompare(b.exposedAt) || (a.exposureOrder??0)-(b.exposureOrder??0) || a.eventId.localeCompare(b.eventId));
  const current = snapshot(rows);
  let interval = current.status === 'Red' ? 3 : current.status === 'Amber' ? 7 : 14;
  // Extend only on successful, spaced, fresh assessments; retries don't extend it.
  let previousGreen = null, greenChecks = 0;
  const sessions = [...new Set(rows.map(r => r.sessionId))];
  const prefix = [];
  for (const sessionId of sessions) {
    const sessionRows = rows.filter(r => r.sessionId === sessionId), at = sessionRows[0].completedAt;
    prefix.push(...sessionRows);
    const s = snapshot(prefix);
    if (s.status !== 'Green') { previousGreen = null; greenChecks = 0; continue; }
    if (!previousGreen) { previousGreen = at; greenChecks = 1; }
    else if (sessionRows.length >= 5 && sessionRows.filter(r => r.correct).length / sessionRows.length >= .85 && Date.parse(at) - Date.parse(previousGreen) >= 7 * DAY) {
      greenChecks++; previousGreen = at;
    }
  }
  if (current.status === 'Green') interval = greenChecks >= 3 ? 56 : greenChecks >= 2 ? 28 : 14;
  const lastAssessed = rows.at(-1)?.completedAt ?? null;
  const reviewAnchor = current.status === 'Green' ? previousGreen : lastAssessed;
  const nextReview = reviewAnchor ? new Date(Date.parse(reviewAnchor) + interval * DAY).toISOString() : null;
  return { ...current, ruleVersion: RULE_VERSION, evidenceCount: rows.length, lastAssessed, nextReview, overdue: !!nextReview && nextReview < now };
}
