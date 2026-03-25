/**
 * CompTIA A+ 220-1202 · Platform Shared JS
 * platform.js — loaded by every tool
 *
 * Provides:
 *  - Persistent student code across all tools
 *  - Tool switcher bar injection
 *  - Unified toast system
 *  - Shared localStorage helpers
 *  - Shared Claude AI helper
 *  - Shared PBIS award helper
 */

(function() {
  'use strict';

  // ── CONSTANTS ──────────────────────────────────────────────
  const PLATFORM_KEY = 'PLATFORM_CODE';
  const SYNC_KEY     = 'PLATFORM_SYNC_URL';

  const TOOLS = [
    { id: 'hub',         label: 'Hub',         file: 'hub.html' },
    { id: 'classroom',   label: 'Classroom',   file: 'comptia-classroom-v2.html' },
    { id: 'notes',       label: 'Notes',       file: 'comptia-notes-quiz.html' },
    { id: 'command',     label: 'My Dashboard',file: 'student-command-center.html' },
    { id: 'pbis',        label: 'PBIS',        file: 'pbis-quiz-tools.html' },
    { id: 'exam',        label: 'Exam Suite',  file: 'exam-suite.html' },
    { id: 'arena',       label: 'Arena',       file: 'competition-arena.html' },
    { id: 'engagement',  label: 'Engage',      file: 'engagement-layer.html' },
    { id: 'setup',       label: 'Setup',       file: 'setup-extras.html' },
  ];

  // ── STORAGE HELPERS ────────────────────────────────────────
  window.pls  = function(k, d) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
    catch { return d; }
  };
  window.psl  = function(k, v) { localStorage.setItem(k, JSON.stringify(v)); };

  // ── STUDENT CODE ───────────────────────────────────────────
  window.Platform = {

    getCode: function() {
      return pls(PLATFORM_KEY, null);
    },

    setCode: function(code) {
      code = (code || '').toUpperCase().trim();
      if (code) {
        psl(PLATFORM_KEY, code);
        this._updateCodeUI(code);
        this._syncToAllTools(code);
      }
      return code;
    },

    clearCode: function() {
      localStorage.removeItem(PLATFORM_KEY);
      this._updateCodeUI(null);
    },

    _updateCodeUI: function(code) {
      const el = document.getElementById('platformCode');
      if (!el) return;
      if (code) {
        el.textContent = code;
        el.classList.remove('empty');
      } else {
        el.textContent = 'Set Code';
        el.classList.add('empty');
      }
    },

    _syncToAllTools: function(code) {
      // Store in all known keys so legacy tools pick it up
      const legacyKeys = ['scc_code', 'student_code', 'STUDENT_CODE'];
      legacyKeys.forEach(k => localStorage.setItem(k, JSON.stringify(code)));
    },

    promptCode: function() {
      const existing = this.getCode();
      const code = prompt(
        'Enter your student code (e.g. STU-007):\n\n' +
        'Your code is your only identifier — no names stored.',
        existing || ''
      );
      if (code !== null) return this.setCode(code);
      return existing;
    },

    // ── PDF EXPORT ──
    // Call with an array of question objects and optional metadata
    // questions: [{q, opts:{A,B,C,D}, answer, rationale, type, domain, studentAnswer}]
    // meta: {title, course, code, date, score, total}
    quizToPDF: function(questions, meta) {
      meta = meta || {};
      const title    = meta.title  || 'CompTIA A+ Quiz';
      const course   = meta.course || 'CompTIA A+ 220-1202';
      const code     = meta.code   || this.getCode() || '';
      const date     = meta.date   || new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
      const showKey  = meta.showKey !== false; // default true
      const scored   = meta.score !== undefined;

      const scoreColor = scored
        ? (meta.score/meta.total >= .8 ? '#16a34a' : meta.score/meta.total >= .6 ? '#d97706' : '#dc2626')
        : '#2563eb';

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Barlow',Arial,sans-serif;font-size:11pt;color:#111;background:#fff;padding:0}
  .page{width:8.5in;min-height:11in;padding:.75in;margin:0 auto}
  .hdr{border-bottom:2pt solid #111;padding-bottom:10pt;margin-bottom:16pt;display:flex;justify-content:space-between;align-items:flex-end}
  .hdr-left h1{font-family:'Barlow Condensed',sans-serif;font-size:22pt;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:2pt}
  .hdr-left p{font-size:9pt;color:#555;letter-spacing:.5px}
  .hdr-right{text-align:right;font-size:9pt;color:#555;line-height:1.8}
  .meta-bar{display:flex;gap:20pt;margin-bottom:14pt;padding:8pt 12pt;background:#f8f8f8;border:1pt solid #ddd;border-radius:4pt;font-size:10pt}
  .meta-item{display:flex;flex-direction:column;gap:2pt}
  .meta-label{font-size:7pt;letter-spacing:1px;text-transform:uppercase;color:#888;font-weight:600}
  .meta-val{font-weight:600;color:#111}
  .score-badge{font-family:'Barlow Condensed',sans-serif;font-size:28pt;font-weight:800;color:${scoreColor};line-height:1}
  .instructions{background:#f0f7ff;border:1pt solid #bcd;border-radius:4pt;padding:8pt 12pt;margin-bottom:14pt;font-size:9.5pt;color:#333;line-height:1.6}
  .q-block{margin-bottom:14pt;page-break-inside:avoid;border-left:2pt solid #e5e7eb;padding-left:10pt}
  .q-block.correct{border-left-color:#16a34a}
  .q-block.wrong{border-left-color:#dc2626}
  .q-meta{font-size:8pt;color:#888;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4pt;display:flex;gap:8pt}
  .q-text{font-size:11pt;font-weight:500;line-height:1.6;margin-bottom:7pt}
  .scenario{background:#f9f9f9;border-left:3pt solid #2563eb;padding:6pt 10pt;margin-bottom:7pt;font-style:italic;font-size:10.5pt}
  .opts{margin-left:4pt}
  .opt{display:flex;gap:8pt;margin-bottom:4pt;font-size:10.5pt;align-items:flex-start;padding:4pt 6pt;border-radius:3pt}
  .opt.correct-ans{background:#dcfce7;border:1pt solid #16a34a}
  .opt.student-wrong{background:#fee2e2;border:1pt solid #dc2626}
  .opt-ltr{font-weight:700;min-width:16pt;flex-shrink:0;font-family:'Barlow Condensed',sans-serif;font-size:12pt}
  .rationale{margin-top:6pt;padding:6pt 10pt;background:#f0fdf4;border-left:2pt solid #16a34a;font-size:9.5pt;color:#166534;line-height:1.6;border-radius:0 4pt 4pt 0}
  .rationale-wrong{background:#fff7ed;border-left-color:#d97706;color:#92400e}
  .ans-line{border-bottom:1pt solid #999;height:18pt;margin:5pt 0}
  .answer-key{page-break-before:always}
  .ak-hdr{background:#111;color:#fff;padding:10pt 14pt;font-family:'Barlow Condensed',sans-serif;font-size:16pt;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:14pt}
  .ak-item{display:flex;gap:10pt;padding:7pt 10pt;margin-bottom:6pt;border-radius:4pt;background:#f8f8f8;border:1pt solid #e5e7eb;align-items:flex-start;page-break-inside:avoid}
  .ak-num{font-family:'Barlow Condensed',sans-serif;font-size:13pt;font-weight:800;min-width:24pt;color:#2563eb}
  .ak-ans{flex:1}
  .ak-ans strong{font-size:11pt}
  .ak-rat{font-size:9pt;color:#555;margin-top:3pt;line-height:1.6}
  @media print{.page{padding:.5in}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>${title}</h1>
      <p>${course}</p>
    </div>
    <div class="hdr-right">
      ${date}<br>
      ${code ? `Student: <strong>${code}</strong><br>` : ''}
      ${scored ? `Score: <span class="score-badge">${meta.score}/${meta.total}</span>` : ''}
    </div>
  </div>

  ${!scored ? `<div class="instructions"><strong>Instructions:</strong> Choose the BEST answer for each question. Look for qualifier words: BEST · FIRST · MOST · NEXT · LEAST. Read each scenario carefully before answering.</div>` : ''}

  ${questions.map((q, i) => {
    const isScored   = q.studentAnswer !== undefined;
    const isCorrect  = isScored && q.studentAnswer === q.answer;
    const blockClass = isScored ? (isCorrect ? 'correct' : 'wrong') : '';
    const isTF       = q.type === 'tf';
    const isOpen     = q.type === 'open';

    return `<div class="q-block ${blockClass}">
      <div class="q-meta">
        <span>Question ${i+1}</span>
        ${q.domain ? `<span>${q.domain}</span>` : ''}
        ${isScored ? `<span style="color:${isCorrect?'#16a34a':'#dc2626'};font-weight:700">${isCorrect?'✓ CORRECT':'✗ WRONG'}</span>` : ''}
      </div>
      ${q.scenario ? `<div class="scenario">${q.scenario}</div>` : ''}
      <div class="q-text">${q.q}</div>
      ${isTF ? `
        <div class="opts">
          <div class="opt ${isScored&&q.answer===true?'correct-ans':''} ${isScored&&q.studentAnswer===true&&q.answer!==true?'student-wrong':''}">
            <span class="opt-ltr">T</span> True
          </div>
          <div class="opt ${isScored&&q.answer===false?'correct-ans':''} ${isScored&&q.studentAnswer===false&&q.answer!==false?'student-wrong':''}">
            <span class="opt-ltr">F</span> False
          </div>
        </div>` :
      isOpen ? `
        <div class="ans-line"></div>
        <div class="ans-line"></div>
        <div class="ans-line"></div>` :
      `<div class="opts">
        ${['A','B','C','D'].map(l => {
          const isAns = l === q.answer;
          const isStu = isScored && l === q.studentAnswer;
          let cls = '';
          if (isScored && isAns) cls = 'correct-ans';
          else if (isScored && isStu && !isAns) cls = 'student-wrong';
          return `<div class="opt ${cls}">
            <span class="opt-ltr">${l}</span>${q.opts ? q.opts[l] : ''}
          </div>`;
        }).join('')}
      </div>`}
      ${isScored && q.rationale ? `
        <div class="rationale ${isCorrect?'':'rationale-wrong'}">
          <strong>${isCorrect ? '✓' : '✗'}</strong> ${q.rationale}
        </div>` : ''}
    </div>`;
  }).join('')}

  ${showKey && !scored ? `
  <div class="answer-key">
    <div class="ak-hdr">📋 Answer Key — Do Not Distribute</div>
    ${questions.map((q, i) => `
      <div class="ak-item">
        <div class="ak-num">Q${i+1}</div>
        <div class="ak-ans">
          ${q.type === 'open'
            ? `<strong>Open Response</strong> — ${q.modelAnswer || q.answer || 'See rubric'}`
            : q.type === 'tf'
            ? `<strong>${q.answer ? 'TRUE' : 'FALSE'}</strong>`
            : `<strong>${q.answer}. ${q.opts ? q.opts[q.answer] : ''}</strong>`}
          ${q.rationale ? `<div class="ak-rat">${q.rationale}</div>` : ''}
        </div>
      </div>`).join('')}
  </div>` : ''}

</div>
<script>window.print();<\/script>
</body></html>`;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      } else {
        this.toast('Allow pop-ups to download PDF', 'err');
      }
    },

    // Returns code or prompts if missing
    requireCode: function() {
      const code = this.getCode();
      if (code) return code;
      return this.promptCode();
    },

    // ── SYNC URL ──
    getSyncUrl: function() { return pls(SYNC_KEY, null); },
    setSyncUrl: function(url) { psl(SYNC_KEY, url); },

    // ── SYNC TO SHEETS ──
    async syncToSheets(action, params) {
      const url = this.getSyncUrl();
      if (!url) return null;
      try {
        const qs = new URLSearchParams({ action, ...params });
        const r = await fetch(`${url}?${qs}`, { mode: 'cors' });
        return await r.json();
      } catch {
        return null;
      }
    },

    // ── PBIS AWARD ──
    awardPBIS: function(code, reason, pts, auto = false) {
      code = (code || '').toUpperCase();
      if (!code) return;
      const students = pls('pbis_students', {});
      students[code] = (students[code] || 0) + pts;
      psl('pbis_students', students);

      const log = pls('pbis_log', []);
      log.unshift({
        code, reason, pts, auto,
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        ts: Date.now(),
      });
      psl('pbis_log', log.slice(0, 500));

      // Sync to Sheets if connected
      this.syncToSheets('save_pbis', { code, reason, pts, auto: String(auto) });

      Platform.toast(`🏆 ${code} +${pts} PBIS pts — ${reason}`, 'gold');
    },

    // ── AI HELPER ──
    async ai(prompt, system, maxTokens = 2000) {
      system = system || 'You are a CompTIA A+ 220-1202 instructor. Return only valid JSON, no markdown, no preamble.';
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const d = await r.json();
      const text = d.content?.map(c => c.text || '').join('') || '';
      return text.replace(/```json\n?|\n?```/g, '').trim();
    },

    // ── TOAST ──
    toast: function(msg, type = '') {
      let el = document.getElementById('platformToast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'platformToast';
        el.className = 'p-toast';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.className = 'p-toast show' + (type ? ' p-toast-' + type : '');
      clearTimeout(el._t);
      el._t = setTimeout(() => { el.className = 'p-toast'; }, 3500);
    },

    // ── INJECT TOOL SWITCHER ──
    injectToolSwitcher: function(currentId) {
      // Find the platform-nav or insert after header
      const nav = document.querySelector('.platform-nav') || document.querySelector('nav');
      if (!nav) return;

      const bar = document.createElement('div');
      bar.className = 'tool-switcher';
      bar.innerHTML = TOOLS.map(t =>
        `<a href="${t.file}" class="ts-btn ${t.id === currentId ? 'current' : ''}">${t.label}</a>`
      ).join('');

      nav.insertAdjacentElement('afterend', bar);
    },

    // ── INJECT CODE PILL INTO HEADER ──
    injectCodePill: function() {
      const hRight = document.querySelector('.ph-right') ||
                     document.querySelector('.hright') ||
                     document.querySelector('.header-right');
      if (!hRight) return;

      const code = this.getCode();
      const pill = document.createElement('div');
      pill.id = 'platformCode';
      pill.className = 'ph-code' + (code ? '' : ' empty');
      pill.textContent = code || 'Set Code';
      pill.title = 'Click to change your student code';
      pill.onclick = () => this.promptCode();

      // Insert before the first existing child or at start
      hRight.insertBefore(pill, hRight.firstChild);
    },

    // ── INIT ── called once on each page
    init: function(toolId) {
      // Sync legacy code keys into PLATFORM_KEY
      const legacyCodes = ['scc_code', 'student_code'].map(k => pls(k, null)).filter(Boolean);
      if (!this.getCode() && legacyCodes[0]) {
        psl(PLATFORM_KEY, legacyCodes[0]);
      }

      // Sync PLATFORM_KEY back to legacy keys
      const code = this.getCode();
      if (code) this._syncToAllTools(code);

      // Inject UI
      document.addEventListener('DOMContentLoaded', () => {
        this.injectCodePill();
        if (toolId && toolId !== 'hub') {
          this.injectToolSwitcher(toolId);
        }
        this._updateCodeUI(this.getCode());

        // Add toast container
        if (!document.getElementById('platformToast')) {
          const t = document.createElement('div');
          t.id = 'platformToast';
          t.className = 'p-toast';
          document.body.appendChild(t);
        }
      });
    },

    // ── WEEK HELPER ──
    getWeekLabel: function() {
      const today = new Date();
      const dow = (today.getDay() + 6) % 7;
      const mon = new Date(today); mon.setDate(today.getDate() - dow);
      const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
      const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${fmt(mon)} – ${fmt(fri)}`;
    },

    // ── COLOR FOR SCORE ──
    scoreColor: function(pct) {
      if (pct >= 80) return 'var(--grn)';
      if (pct >= 60) return 'var(--amb)';
      return 'var(--red)';
    },

    // ── LETTER GRADE ──
    letterGrade: function(pct) {
      if (pct >= 90) return 'A';
      if (pct >= 80) return 'B';
      if (pct >= 70) return 'C';
      if (pct >= 60) return 'D';
      return 'F';
    },
  };

  // Auto-init with no toolId — pages call Platform.init('toolname') themselves
  // but this ensures toast container always exists
  document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('platformToast')) {
      const t = document.createElement('div');
      t.id = 'platformToast';
      t.className = 'p-toast';
      document.body.appendChild(t);
    }
  });

})();
