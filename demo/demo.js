/* =========================================================================
   Live-Trans — static demo interactivity
   Pure vanilla JS, no dependencies, no network calls, no API keys.
   Simulates: popup toggle/pulse/metrics, options tabs/modes/save/glossary,
   and bilingual subtitle cycling on the mock video.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* =========================================================
     Top-level demo tabs
     ========================================================= */
  var tabs = document.querySelectorAll('.demo-tab');
  var panels = document.querySelectorAll('.demo-panel');

  function showTab(name) {
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
    panels.forEach(function (p) { p.hidden = p.dataset.panel !== name; });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.dataset.tab); });
  });

  /* =========================================================
     POPUP — toggle, pulsing status dot, live metrics
     ========================================================= */
  var toggleBtn = $('popup-toggle');
  var dot = $('popup-dot');
  var statusEl = $('popup-status');
  var stateEl = $('popup-state');
  var mTsr = $('m-tsr');
  var mUnits = $('m-units');
  var mCalls = $('m-calls');
  var mSplices = $('m-splices');

  var running = false;
  var tick = null;
  var units = 0, calls = 0, splices = 0;

  function setRunning(on) {
    running = on;
    toggleBtn.textContent = on ? 'Dừng dịch' : 'Dịch tab này';
    toggleBtn.classList.toggle('danger', on);
    dot.classList.toggle('dot-on', on);
    if (statusEl) statusEl.classList.toggle('on', on);
    if (stateEl) stateEl.textContent = on ? 'Đang dịch' : 'Sẵn sàng';

    if (on) {
      // reset + start a faux live session
      units = 0; calls = 0; splices = 0;
      mUnits.textContent = '0'; mCalls.textContent = '0'; mSplices.textContent = '0'; mTsr.textContent = '100%';
      tick = setInterval(function () {
        units += 1;
        if (units % 2 === 0) calls += 1;          // ~1 translation call per 2 units
        if (Math.random() < 0.32) splices += 1;   // occasional term-splice warning
        var tsr = Math.max(91, 100 - Math.floor(units / 3));
        mUnits.textContent = String(units);
        mCalls.textContent = String(calls);
        mSplices.textContent = String(splices);
        mTsr.textContent = tsr + '%';
      }, 1100);
    } else if (tick) {
      clearInterval(tick);
      tick = null;
    }
  }
  toggleBtn.addEventListener('click', function () { setRunning(!running); });

  // "Cài đặt" link in the popup footer jumps to the Options tab
  $('popup-open-options').addEventListener('click', function () { showTab('options'); });

  /* =========================================================
     OPTIONS — inner tabs (Chung / Glossary)
     ========================================================= */
  var optTabs = document.querySelectorAll('.opt-nav button');
  var optPanes = document.querySelectorAll('.opt-pane');
  optTabs.forEach(function (b) {
    b.addEventListener('click', function () {
      optTabs.forEach(function (x) { x.classList.toggle('active', x === b); });
      var name = b.dataset.opttab;
      optPanes.forEach(function (p) { p.hidden = p.dataset.pane !== name; });
    });
  });

  /* ---------- mode cards (Demo / Direct / Gateway) ---------- */
  var modeBtns = document.querySelectorAll('.modes .mode');
  var modeExtras = document.querySelectorAll('.mode-extra');
  modeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      modeBtns.forEach(function (x) { x.classList.toggle('active', x === b); });
      var m = b.dataset.mode;
      modeExtras.forEach(function (e) { e.hidden = e.dataset.modeExtra !== m; });
    });
  });

  /* ---------- save flash ---------- */
  var saveBtn = $('opt-save');
  saveBtn.addEventListener('click', function () {
    saveBtn.textContent = 'Đã lưu ✓';
    saveBtn.disabled = true;
    setTimeout(function () { saveBtn.textContent = 'Lưu cài đặt'; saveBtn.disabled = false; }, 1600);
  });

  /* ---------- chunk-seconds slider (30–180) ---------- */
  var chunkRange = $('chunk-range');
  var chunkLabel = $('chunk-label');
  chunkRange.addEventListener('input', function () {
    chunkLabel.textContent = 'Độ dài chunk ASR: ' + chunkRange.value + 's';
  });

  /* =========================================================
     GLOSSARY editor
     ========================================================= */
  // Starter glossary — copied verbatim from extension/lib/glossary/types.ts
  var STARTER_GLOSSARY = [
    { term: 'npm run start', type: 'command', note: 'Giữ nguyên văn tuyệt đối' },
    { term: 'useEffect', type: 'code' },
    { term: 'useState', type: 'code' },
    { term: 'gradient descent', type: 'jargon', vi: 'hạ gradient' },
    { term: 'backpropagation', type: 'jargon', vi: 'lan truyền ngược' },
    { term: 'overfitting', type: 'jargon', vi: 'quá khớp' },
    { term: 'GAN', type: 'acronym', vi: 'mạng đối sinh' },
    { term: 'LLM', type: 'acronym', vi: 'mô hình ngôn ngữ lớn' },
    { term: 'transformer', type: 'jargon', note: 'Giữ nguyên trong ngữ cảnh ML' },
  ];

  var terms = [];
  var gBody = $('g-body');
  var gCount = $('g-count');
  var gTerm = $('g-term');
  var gType = $('g-type');
  var gVi = $('g-vi');

  function renderGlossary() {
    gCount.textContent = String(terms.length);
    if (terms.length === 0) {
      gBody.innerHTML = '<tr><td colspan="4" class="empty">Chưa có thuật ngữ. Thêm hoặc &ldquo;Nạp bộ mẫu&rdquo;.</td></tr>';
      return;
    }
    gBody.innerHTML = terms
      .map(function (t, i) {
        return (
          '<tr>' +
          '<td><code>' + esc(t.term) + '</code></td>' +
          '<td><span class="tag tag-' + esc(t.type) + '">' + esc(t.type) + '</span></td>' +
          '<td class="muted">' + (t.vi ? esc(t.vi) : '—') + '</td>' +
          '<td><button class="ghost danger" data-del="' + i + '">Xoá</button></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function addTerm() {
    var term = gTerm.value.trim();
    if (!term) return;
    terms.push({ term: term, type: gType.value, vi: gVi.value.trim() || undefined });
    gTerm.value = '';
    gVi.value = '';
    gType.value = 'command';
    renderGlossary();
  }

  $('g-add').addEventListener('click', addTerm);
  $('g-starter').addEventListener('click', function () {
    terms = STARTER_GLOSSARY.map(function (t) { return Object.assign({}, t); });
    renderGlossary();
  });
  gBody.addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]');
    if (!b) return;
    terms.splice(Number(b.dataset.del), 1);
    renderGlossary();
  });

  // Export JSON (works from a local file:// page)
  $('g-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify({ version: 1, terms: terms }, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'live-trans-glossary.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Import JSON
  $('g-import').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    f.text().then(function (txt) {
      try {
        var parsed = JSON.parse(txt);
        if (!parsed || !Array.isArray(parsed.terms)) throw new Error('bad shape');
        terms = parsed.terms.map(function (t) { return Object.assign({}, t); });
        renderGlossary();
      } catch (err) {
        window.alert('File glossary không hợp lệ (cần {"version":1,"terms":[...]}).');
      }
    });
    e.target.value = ''; // allow re-importing the same file
  });

  renderGlossary();

  /* =========================================================
     MOCK VIDEO — bilingual subtitle cycling
     ========================================================= */
  // Canned subtitle units (ML lecture), translated to Vietnamese with
  // glossary terms preserved; the badge flags units that spliced a term back.
  var SUBS = [
    {
      vi: 'Chào mừng trở lại. Hôm nay chúng ta sẽ tìm hiểu các nền tảng của học máy.',
      en: 'Welcome back. Today we cover the fundamentals of machine learning.',
    },
    {
      vi: 'Chúng ta sẽ bắt đầu với hạ gradient và cách nó tối thiểu hóa hàm mất mát.',
      en: "We'll start with gradient descent and how it minimizes the loss.",
      badge: true,
    },
    {
      vi: 'Sau đó, lan truyền ngược giúp mạng học từ các sai số của chính nó.',
      en: 'Then backpropagation lets the network learn from its own errors.',
      badge: true,
    },
    {
      vi: 'Cuối cùng, chúng ta sẽ thấy transformer xử lý ngữ cảnh tầm xa ra sao.',
      en: 'Finally, we will see how a transformer handles long-range context.',
    },
  ];

  var subVi = $('sub-vi');
  var subEn = $('sub-en');
  var subEl = $('lt-sub');
  var runBtn = $('video-run');

  var playing = false;
  var subTimer = null;
  var subIdx = 0;

  function showSub(i) {
    var s = SUBS[i % SUBS.length];
    subEl.classList.remove('lt-fade');
    void subEl.offsetWidth; // reflow to restart the fade animation
    subVi.textContent = s.vi;
    if (s.badge) {
      var b = document.createElement('span');
      b.className = 'lt-badge';
      b.textContent = '⚠ thuật ngữ';
      subVi.appendChild(b);
    }
    subEn.textContent = s.en;
    subEl.classList.add('lt-fade');
  }

  function startVideo() {
    playing = true;
    runBtn.textContent = 'Dừng demo';
    runBtn.classList.add('danger');
    subIdx = 0;
    showSub(subIdx);
    subTimer = setInterval(function () {
      subIdx += 1;
      showSub(subIdx);
    }, 3200);
  }

  function stopVideo() {
    playing = false;
    runBtn.textContent = 'Chạy demo';
    runBtn.classList.remove('danger');
    if (subTimer) { clearInterval(subTimer); subTimer = null; }
    subEl.classList.remove('lt-fade');
    subVi.textContent = 'Đã dừng';
    subEn.textContent = 'Stopped';
  }

  runBtn.addEventListener('click', function () { playing ? stopVideo() : startVideo(); });

  /* ---------- initial view ---------- */
  showTab('popup');
})();
