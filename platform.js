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
