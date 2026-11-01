// Shared by the offline quiz runner and the server. No network or AI calls.
export const LETTERS = ['A', 'B', 'C', 'D', 'E'];
export const DOMAINS = ['recognition', 'foundations', 'investigations', 'management', 'safety'];
export const DOMAIN_LABELS = {
  Condition: ['Recognition and differential diagnosis', 'Mechanisms and risk factors', 'Investigations and interpretation', 'Management', 'Complications and red flags'],
  Presentation: ['Differential diagnosis', 'History and examination', 'Investigations and interpretation', 'Initial management', 'Red flags and escalation']
};

export function parseQuestions(rawText) {
  const questions = [];
  for (const block of rawText.trim().split(/\n\s*\n/)) {
    const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const number = questions.length + 1;
    const options = {}, qLines = [];
    let answer = null;
    for (const line of lines) {
      const m = line.match(/^([A-E])\)\s*(.*)$/);
      if (m) { options[m[1]] = (m[2] ?? '').trim(); continue; }
      const a = line.match(/^Answer:\s*(.*)$/i);
      if (a) { answer = (a[1] ?? '').trim(); continue; }
      qLines.push(line);
    }
    const question = qLines.join('\n').trim();
    if (!question) throw new Error(`Could not parse question block #${number}: No question text found.`);
    if (Object.keys(options).length !== 5) throw new Error(`Could not parse question block #${number}: Expected 5 options (A-E), found ${Object.keys(options).length}.`);
    if (!answer) throw new Error(`Could not parse question block #${number}: No 'Answer:' line found.`);
    if (!options[answer]) throw new Error(`Could not parse question block #${number}: Answer '${answer}' is not a valid option key.`);
    questions.push({ question, options, answer, original_q_number: number });
  }
  if (!questions.length) throw new Error('No valid questions could be parsed from the input.');
  return questions;
}

export async function digest(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function fingerprint(q) {
  const clean = s => String(s).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  // Numbering and shuffled option positions must not turn a retake into new evidence.
  return digest([clean(q.question.replace(/^Question\s+\d+:\s*/i, '')), Object.values(q.options).map(clean).sort()]);
}

export function replay(questions, events) {
  const records = Object.fromEntries(questions.map(q => [q.id, { selection_history: [], first_try_correct: false, final_selection: null, is_locked: false }]));
  let score = 0;
  for (const e of events) {
    const q = questions.find(q => q.id === e.questionId);
    if (!q || !LETTERS.includes(e.selection)) throw new Error('Invalid answer event.');
    const r = records[q.id];
    if (r.is_locked) throw new Error('This question is already locked.');
    if (!r.selection_history.length && e.selection === q.answer) { r.first_try_correct = true; score++; }
    r.selection_history.push(e.selection);
    r.final_selection = e.selection;
    r.is_locked = e.selection === q.answer;
  }
  return { score, records, answered: Object.values(records).filter(r => r.final_selection !== null).length };
}

export function balancedKey(size) {
  const key = Array.from({ length: size }, (_, i) => LETTERS[i % 5]);
  for (let i = key.length - 1; i > 0; i--) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [key[i], key[n]] = [key[n], key[i]];
  }
  return key.join('');
}
