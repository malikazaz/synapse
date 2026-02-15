/* Synapse Web
   Vanilla JS single-page app that mirrors the core behaviour of your Tkinter app.

   Format expected per question block (blank line between questions):

   Question 1 text...
   A) option
   B) option
   C) option
   D) option
   E) option
   Answer: D
*/

(() => {
  'use strict';

  // ---- Themes (matches your Python dict) ----
  const THEMES = {
    "Default Dark": {"BG_COLOR":"#2c3e50","TEXT_COLOR":"#ecf0f1","FRAME_COLOR":"#34495e","CORRECT_COLOR":"#27ae60","WRONG_COLOR":"#c0392b","NEUTRAL_COLOR":"#7f8c8d","BUTTON_COLOR":"#3498db","BUTTON_TEXT_COLOR":"#ffffff"},
    "UCAT Light": {"BG_COLOR":"#f0f0f0","TEXT_COLOR":"#000000","FRAME_COLOR":"#ffffff","CORRECT_COLOR":"#27ae60","WRONG_COLOR":"#e74c3c","NEUTRAL_COLOR":"#bdc3c7","BUTTON_COLOR":"#3498db","BUTTON_TEXT_COLOR":"#ffffff"},
    "Classic Blue": {"BG_COLOR":"#aed6f1","TEXT_COLOR":"#17202a","FRAME_COLOR":"#d6eaf8","CORRECT_COLOR":"#229954","WRONG_COLOR":"#cb4335","NEUTRAL_COLOR":"#85929e","BUTTON_COLOR":"#2980b9","BUTTON_TEXT_COLOR":"#ffffff"},
    "High Contrast": {"BG_COLOR":"#000000","TEXT_COLOR":"#ffffff","FRAME_COLOR":"#222222","CORRECT_COLOR":"#00ff00","WRONG_COLOR":"#ff0000","NEUTRAL_COLOR":"#888888","BUTTON_COLOR":"#444444","BUTTON_TEXT_COLOR":"#ffffff"},
    "Forest": {"BG_COLOR":"#2d4a2e","TEXT_COLOR":"#f0f0f0","FRAME_COLOR":"#3d5c3d","CORRECT_COLOR":"#5a9367","WRONG_COLOR":"#c7524a","NEUTRAL_COLOR":"#8d8d8d","BUTTON_COLOR":"#4a7c59","BUTTON_TEXT_COLOR":"#ffffff"},
    "Crimson Night": {"BG_COLOR":"#2C001E","TEXT_COLOR":"#F0E6EF","FRAME_COLOR":"#4C0033","CORRECT_COLOR":"#79D70F","WRONG_COLOR":"#FF005C","NEUTRAL_COLOR":"#8E05C2","BUTTON_COLOR":"#AE00FB","BUTTON_TEXT_COLOR":"#ffffff"}
  };

  const SERIAL = "SN-AZAZ-MALIK-2024-07-04-UNIQUE-001";
  const SECRET = ['s','h','o','w','i','d'];

  // ---- State ----
  const state = {
    screen: 'input', // 'input' | 'quiz' | 'results'
    isRandomOrder: false,
    themeName: 'Default Dark',
    fontSize: 16,

    questions: [],
    originalQuestionsBackup: [],
    currentIndex: 0,
    score: 0,
    answerRecords: [],

    navCollapsed: false,

    keyBuf: []
  };

  // ---- DOM ----
  const app = document.getElementById('app');
  const themeSelect = document.getElementById('themeSelect');
  const fontSize = document.getElementById('fontSize');
  const randomToggle = document.getElementById('randomToggle');
  const randomToggleLabel = document.getElementById('randomToggleLabel');

  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalText = document.getElementById('modalText');
  const copyModalBtn = document.getElementById('copyModalBtn');

  // ---- Helpers ----
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function setCSSVars(theme) {
    document.documentElement.style.setProperty('--bg', theme.BG_COLOR);
    document.documentElement.style.setProperty('--text', theme.TEXT_COLOR);
    document.documentElement.style.setProperty('--frame', theme.FRAME_COLOR);
    document.documentElement.style.setProperty('--correct', theme.CORRECT_COLOR);
    document.documentElement.style.setProperty('--wrong', theme.WRONG_COLOR);
    document.documentElement.style.setProperty('--neutral', theme.NEUTRAL_COLOR);
    document.documentElement.style.setProperty('--btn', theme.BUTTON_COLOR);
    document.documentElement.style.setProperty('--btnText', theme.BUTTON_TEXT_COLOR);
    document.documentElement.style.setProperty('--fs', `${state.fontSize}px`);
    // match theme-color meta for nicer mobile status bar colour
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.BG_COLOR);
  }

  function savePrefs() {
    localStorage.setItem('synapse:prefs', JSON.stringify({
      themeName: state.themeName,
      fontSize: state.fontSize,
      isRandomOrder: state.isRandomOrder
    }));
  }
  function loadPrefs() {
    try {
      const raw = localStorage.getItem('synapse:prefs');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.themeName && THEMES[p.themeName]) state.themeName = p.themeName;
      if (typeof p.fontSize === 'number') state.fontSize = clamp(p.fontSize, 10, 30);
      if (typeof p.isRandomOrder === 'boolean') state.isRandomOrder = p.isRandomOrder;
    } catch { /* ignore */ }
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function parseQuestions(rawText) {
    const blocks = rawText.trim().split(/\n\s*\n/);
    const questions = [];
    let qCounter = 0;

    for (const block of blocks) {
      const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      qCounter += 1;

      const options = {};
      const qLines = [];
      let answer = null;

      for (const line of lines) {
        const m = line.match(/^([A-E])\)\s*(.*)$/);
        if (m) {
          options[m[1]] = (m[2] ?? '').trim();
          continue;
        }
        const a = line.match(/^Answer:\s*(.*)$/i);
        if (a) {
          answer = (a[1] ?? '').trim();
          continue;
        }
        qLines.push(line);
      }

      const question = qLines.join('\n').trim();
      if (!question) throw new Error(`Could not parse question block #${qCounter}: No question text found.`);
      if (Object.keys(options).length !== 5) throw new Error(`Could not parse question block #${qCounter}: Expected 5 options (A-E), found ${Object.keys(options).length}.`);
      if (!answer) throw new Error(`Could not parse question block #${qCounter}: No 'Answer:' line found.`);
      if (!options[answer]) throw new Error(`Could not parse question block #${qCounter}: Answer '${answer}' is not a valid option key.`);

      questions.push({
        question,
        options,
        answer,
        original_q_number: qCounter
      });
    }

    if (!questions.length) throw new Error('No valid questions could be parsed from the input.');
    return questions;
  }

  function resetQuizState() {
    state.questions = [];
    state.originalQuestionsBackup = [];
    state.currentIndex = 0;
    state.score = 0;
    state.answerRecords = [];
    state.navCollapsed = false;
  }

  function goHome() {
    resetQuizState();
    state.originalQuestionsBackup = [];
    state.screen = 'input';
    render();
  }

  function startQuizWithQuestions(parsedQuestions) {
    if (!parsedQuestions || !parsedQuestions.length) return;
    state.originalQuestionsBackup = parsedQuestions.slice();
    retakeQuiz();
  }

  function retakeQuiz() {
    if (!state.originalQuestionsBackup.length) {
      alert('No quiz loaded to retake.');
      return;
    }
    state.questions = state.originalQuestionsBackup.slice();
    if (state.isRandomOrder) shuffleInPlace(state.questions);

    state.score = 0;
    state.currentIndex = 0;
    state.navCollapsed = false;
    state.answerRecords = state.questions.map(() => ({
      attempts: 0,
      first_try_correct: false,
      final_selection: null,
      is_locked: false,
      selection_history: []
    }));

    state.screen = 'quiz';
    render();
  }

  function getSkippedQuestions() {
    const skipped = [];
    for (let i = 0; i < state.answerRecords.length; i++) {
      if (state.answerRecords[i].final_selection === null) {
        skipped.push(String(state.questions[i].original_q_number));
      }
    }
    return skipped;
  }

  function buildSummaryText(forDisplay) {
    const total = state.questions.length;
    if (!total) return 'No questions were loaded.';

    const correct = state.score;
    const pct = (correct / total) * 100;

    const wrongIds = [];
    for (let i = 0; i < state.answerRecords.length; i++) {
      const r = state.answerRecords[i];
      if (!r.first_try_correct && r.final_selection !== null) {
        wrongIds.push(String(state.questions[i].original_q_number));
      }
    }

    const idLabel = state.isRandomOrder ? 'Original IDs' : 'IDs';

    if (forDisplay) {
      return `Your total score: ${correct}/${total} (${pct.toFixed(2)}%)\n` +
             `Questions wrong on first attempt: ${wrongIds.length ? wrongIds.join(', ') : 'None'}`;
    }

    return [
      '[ SUMMARY ]',
      `- Score: ${correct}/${total} (${pct.toFixed(2)}%)`,
      `- Correct (1st attempt): ${correct}`,
      `- Incorrect (1st attempt): ${wrongIds.length}`,
      `- Questions wrong (${idLabel}): ${wrongIds.length ? wrongIds.join(', ') : 'None'}`
    ].join('\n');
  }

  function buildDetailedReportText() {
    const headerLines = [
      '--- HOW TO READ THIS REPORT ---',
      "This report summarizes the student's quiz performance.",
      '',
      '- [ SUMMARY ]: An overview of the student\'s score and performance.',
      '- [ DETAILED ANALYSIS ]: A breakdown of each question the student answered.',
      '- Status: Indicates if the student answered correctly on their first attempt.',
      '- Answer Path: Shows all the options the student selected for a question, in order.',
      '- Correct Answer: The correct option for the question.'
    ];
    if (state.isRandomOrder) headerLines.push('- Question Text: The full text of the question for reference.');

    const summaryText = buildSummaryText(false);

    const analysisLines = ['---', '[ DETAILED ANALYSIS ]', ''];

    const sortedOriginal = state.originalQuestionsBackup
      .map((q, idx) => ({ q, idx }))
      .sort((a, b) => a.q.original_q_number - b.q.original_q_number);

    for (const item of sortedOriginal) {
      const qData = item.q;
      const sessionIndex = state.questions.findIndex(q => q === qData);
      if (sessionIndex === -1) continue;

      const record = state.answerRecords[sessionIndex];
      const status = record.first_try_correct ? 'CORRECT on first attempt' : 'INCORRECT on first attempt';
      const historyStr = record.selection_history.length ? record.selection_history.join(' -> ') : 'Not Answered';
      const qIdentifier = state.isRandomOrder
        ? `[ Original Question ID: ${qData.original_q_number} ]`
        : `[ Question ${qData.original_q_number} ]`;

      analysisLines.push(qIdentifier);
      analysisLines.push(`- Status: ${status}`);
      if (state.isRandomOrder) {
        analysisLines.push(`- Question Text: "${qData.question.replace(/\n/g,' ')}"`);
      }
      analysisLines.push(`- Answer Path: ${historyStr}`);
      analysisLines.push(`- Correct Answer: ${qData.answer}`);
      analysisLines.push('');
    }

    return headerLines.join('\n') +
      '\n\n--- QUIZ REPORT ---\n\n' +
      summaryText + '\n\n' +
      analysisLines.join('\n') +
      '--- END OF REPORT ---';
  }

  function copyToClipboard(text) {
    return navigator.clipboard.writeText(text);
  }

  function setScreenInput() {
    state.screen = 'input';
    resetQuizState();
    render();
  }

  function checkAnswer(selectedKey) {
    const record = state.answerRecords[state.currentIndex];
    if (record.is_locked) return;

    record.selection_history.push(selectedKey);
    record.final_selection = selectedKey;

    const correct = state.questions[state.currentIndex].answer;
    const isCorrect = (selectedKey === correct);

    if (record.selection_history.length === 1 && isCorrect) {
      record.first_try_correct = true;
      state.score += 1;
    }
    if (isCorrect) record.is_locked = true;

    render();
  }

  function prevQuestion() {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      render();
    }
  }

  function nextQuestion() {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex += 1;
      render();
      return;
    }

    // last question
    const skipped = getSkippedQuestions();
    if (skipped.length) return; // locked by UI
    state.screen = 'results';
    render();
  }

  function jumpToQuestion(index) {
    state.currentIndex = index;
    render();
  }

  function openModal(title, text) {
    modalTitle.textContent = title;
    modalText.value = text;
    modal.showModal();
  }

  // ---- Render ----
  function render() {
    setCSSVars(THEMES[state.themeName]);

    // Sync controls
    themeSelect.value = state.themeName;
    fontSize.value = String(state.fontSize);
    randomToggle.checked = state.isRandomOrder;
    randomToggleLabel.textContent = state.isRandomOrder ? 'Random' : 'Original';

    // Random/Original is only relevant before a quiz starts
    const randomWrap = randomToggle.closest('.toggle');
    if (randomWrap) randomWrap.style.display = (state.screen === 'input') ? '' : 'none';

    if (state.screen === 'input') return renderInput();
    if (state.screen === 'quiz') return renderQuiz();
    return renderResults();
  }

  function renderInput() {
    app.innerHTML = `
      <section class="card padded">
        <div class="h1">Load your quiz</div>
        <div class="help">
          Paste your MCQs into the box below (or upload a .txt). Each question must have 5 options (A–E) and an <span class="muted">Answer:</span> line.
        </div>

        <hr class="sep" />

        <textarea id="paste" class="big" placeholder="Paste your questions here..."></textarea>

        <div class="row spread" style="margin-top:12px">
          <div class="row">
            <input id="file" type="file" accept=".txt,text/plain" />
            <button id="loadBtn" class="btn">Start quiz</button>
          </div>
          <button id="demoBtn" class="btn secondary">Load demo</button>
        </div>

        <div class="help muted" style="margin-top:10px">
          Tip: Install this as an app on iPhone/iPad: share → <b>Add to Home Screen</b>. It also works offline once loaded.
        </div>
      </section>
    `;

    const paste = document.getElementById('paste');
    const file = document.getElementById('file');
    const loadBtn = document.getElementById('loadBtn');
    const demoBtn = document.getElementById('demoBtn');

    loadBtn.addEventListener('click', async () => {
      try {
        let raw = paste.value || '';
        if (!raw.trim() && file.files?.[0]) {
          raw = await file.files[0].text();
        }
        if (!raw.trim()) {
          alert('Please paste quiz content (or select a file).');
          return;
        }
        const parsed = parseQuestions(raw);
        startQuizWithQuestions(parsed);
      } catch (e) {
        alert(String(e?.message || e));
      }
    });

    demoBtn.addEventListener('click', () => {
      paste.value = [
        'Which structure separates the false pelvis from the true pelvis?',
        'A) Anterior superior iliac spine',
        'B) Iliac crest',
        'C) Iliac fossa',
        'D) Pelvic brim',
        'E) Pubic tubercle',
        'Answer: D',
        '',
        'In anatomical position, the anterior superior iliac spine aligns with which bony prominence?',
        'A) Iliac crest',
        'B) Ischial spine',
        'C) Ischial tuberosity',
        'D) Pubic ramus',
        'E) Pubic tubercle',
        'Answer: E',
      ].join('\n');
      paste.focus();
    });
  }

  function renderQuiz() {
    const total = state.questions.length;
    const q = state.questions[state.currentIndex];
    const record = state.answerRecords[state.currentIndex];

    const qNumDisplay = state.currentIndex + 1;
    let progressText = `Question: ${qNumDisplay} / ${total}`;
    if (state.isRandomOrder) progressText += ` (Original Q.${q.original_q_number})`;

    const sortedOptions = Object.entries(q.options).sort(([a],[b]) => a.localeCompare(b));

    const skipped = (state.currentIndex === total - 1) ? getSkippedQuestions() : [];
    const finishDisabled = (state.currentIndex === total - 1) && skipped.length;

    const navButtons = state.questions.map((qq, idx) => {
      const r = state.answerRecords[idx];
      let cls = 'navbtn';
      if (r.first_try_correct) cls += ' correct';
      else if (r.final_selection !== null) cls += ' wrong';
      if (idx === state.currentIndex) cls += ' current';
      return `<button class="${cls}" data-idx="${idx}">Q ${qq.original_q_number}</button>`;
    }).join('');

    const optsHtml = sortedOptions.map(([key, val]) => {
      let cls = 'opt';
      if (record.is_locked) cls += (key === q.answer) ? ' correct' : ' answered';
      else if (key === record.final_selection) cls += ' wrong';
      return `<button class="${cls}" data-key="${key}"> ${key}. ${escapeHtml(val)}</button>`;
    }).join('');

    app.innerHTML = `
      <section class="grid quiz ${state.navCollapsed ? 'nav-collapsed' : ''}">
        <aside class="card navigator ${state.navCollapsed ? 'collapsed' : ''}">${navButtons}</aside>

        <section class="card padded">
          <div class="quizHeader">
            <div class="row" style="align-items:center">
              <div class="badge" id="progress">${escapeHtml(progressText)}</div>
              <div class="badge" id="score">Score: ${state.score}</div>
            </div>
            <div class="row" style="align-items:center">
              <button id="toggleNavBtn" class="btn secondary small">${state.navCollapsed ? 'Show list' : 'Hide list'}</button>
              <button id="homeBtn" class="btn secondary small" title="Return to the home screen to start a new quiz">Home</button>
            </div>
          </div>

          <div class="question">${escapeHtml(q.question)}</div>

          <div class="options">${optsHtml}</div>

          <div class="footerBar">
            <div class="row">
              <button id="prevBtn" class="btn secondary" ${state.currentIndex === 0 ? 'disabled' : ''}>Back (B)</button>
              <button id="nextBtn" class="btn" ${finishDisabled ? 'disabled' : ''}>${state.currentIndex === total - 1 ? 'Finish' : 'Next (Space) ➡'}</button>
            </div>
            <div class="warn" id="warn">${finishDisabled ? `Answer skipped questions to finish: ${skipped.join(', ')}` : ''}</div>
          </div>
        </section>
      </section>
    `;

    // Wire option buttons
    app.querySelectorAll('button.opt').forEach(btn => {
      btn.addEventListener('click', () => checkAnswer(btn.dataset.key));
    });

    // Navigator
    app.querySelectorAll('button.navbtn').forEach(btn => {
      btn.addEventListener('click', () => jumpToQuestion(Number(btn.dataset.idx)));
    });

    // Header controls
    const toggleNavBtn = document.getElementById('toggleNavBtn');
    if (toggleNavBtn) toggleNavBtn.addEventListener('click', () => {
      state.navCollapsed = !state.navCollapsed;
      render();
    });

    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) homeBtn.addEventListener('click', () => {
      goHome();
    });

    // Footer
    document.getElementById('prevBtn').addEventListener('click', prevQuestion);
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
  }

  function renderResults() {
    const summary = buildSummaryText(true);

    app.innerHTML = `
      <section class="card padded">
        <div class="h1">Quiz finished!</div>
        <pre class="help" style="white-space:pre-wrap;margin:0">${escapeHtml(summary)}</pre>

        <hr class="sep" />

        <div class="row">
          <button id="reportBtn" class="btn">View detailed report</button>
          <button id="retakeBtn" class="btn secondary">Retake this quiz</button>
          <button id="homeBtn" class="btn ghost">Load new quiz</button>
        </div>
      </section>
    `;

    document.getElementById('reportBtn').addEventListener('click', () => {
      openModal('Detailed results report', buildDetailedReportText());
    });
    document.getElementById('retakeBtn').addEventListener('click', retakeQuiz);
    document.getElementById('homeBtn').addEventListener('click', setScreenInput);
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'
    }[c]));
  }

  // ---- Top controls ----
  function initTopControls() {
    // Theme select
    themeSelect.innerHTML = Object.keys(THEMES).map(name => `<option value="${name}">${name}</option>`).join('');
    themeSelect.addEventListener('change', () => {
      state.themeName = themeSelect.value;
      savePrefs();
      render();
    });

    // Font slider
    fontSize.addEventListener('input', () => {
      state.fontSize = clamp(Number(fontSize.value), 10, 30);
      savePrefs();
      render();
    });

    // Random toggle
    randomToggle.addEventListener('change', () => {
      // Only applies before a quiz starts
      if (state.screen !== 'input') {
        randomToggle.checked = state.isRandomOrder;
        return;
      }
      state.isRandomOrder = !!randomToggle.checked;
      savePrefs();
      render();
    });

    // Modal copy
    copyModalBtn.addEventListener('click', (e) => {
      e.preventDefault(); // keep dialog open
      copyToClipboard(modalText.value).then(() => {
        copyModalBtn.textContent = 'Copied!';
        setTimeout(() => copyModalBtn.textContent = 'Copy to clipboard', 1400);
      }).catch(() => alert('Could not copy to clipboard in this browser.'));
    });
  }

  // ---- Keyboard support (like your Tkinter) ----
  function initKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Ignore keys when typing into inputs/textarea
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input' || tag === 'select') return;

      const key = (e.key || '').toLowerCase();

      if (state.screen === 'quiz') {
        if (key === 'b') prevQuestion();
        if (key === ' ') {
          e.preventDefault();
          nextQuestion();
        }
      }

      // secret key => show serial
      state.keyBuf.push(key);
      if (state.keyBuf.length > SECRET.length) state.keyBuf.shift();
      if (SECRET.every((k, i) => state.keyBuf[i] === k)) {
        alert(`This copy is registered with serial:\n${SERIAL}`);
        state.keyBuf = [];
      }
    });
  }

  // ---- Service worker (offline) ----
  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=3').catch(() => {});
    });
  }

  // ---- Boot ----
  loadPrefs();
  initTopControls();
  initKeyboard();
  initServiceWorker();
  render();

})();
