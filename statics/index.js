/* ══════════════════════════════════════════
   3DArxiv — index.js
   Theme · Search · Filter · Charts · Bookmarks · AI Summary
══════════════════════════════════════════ */

// ─── Theme ─────────────────────────────
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
const themeIcon = document.getElementById('theme-icon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (toggleSwitch) toggleSwitch.checked = (theme === 'light');
  if (themeIcon) themeIcon.className = theme === 'light' ? 'ri-sun-line' : 'ri-moon-line';
}

const savedTheme = localStorage.getItem('arxiv-theme') || 'dark';
applyTheme(savedTheme);

if (toggleSwitch) {
  toggleSwitch.addEventListener('change', () => {
    const t = toggleSwitch.checked ? 'light' : 'dark';
    applyTheme(t);
    localStorage.setItem('arxiv-theme', t);
    // Redraw charts on theme change
    setTimeout(initCharts, 50);
  });
}

// ─── Tab expand/collapse ───────────────
let allExpanded = false;
document.addEventListener('keydown', e => {
  if (e.key === 'Tab' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    allExpanded = !allExpanded;
    document.querySelectorAll('details').forEach(d => d.open = allExpanded);
  }
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
  }
});

// ─── Weekdays & Year ───────────────────
const WD = ['日','一','二','三','四','五','六'];
document.querySelectorAll('.day-weekday').forEach(el => {
  const dt = new Date(el.dataset.datetime);
  el.textContent = `周${WD[dt.getDay()]}`;
});
document.querySelectorAll('.day-year').forEach(el => {
  const dt = new Date(el.dataset.datetime);
  el.textContent = `${dt.getFullYear()}`;
});

// ─── Collect data from DOM ─────────────
function collectData() {
  const days = [];
  document.querySelectorAll('.day-section').forEach(sec => {
    const dateEl = sec.querySelector('.day-date time');
    const date = dateEl ? dateEl.getAttribute('datetime').slice(0, 10) : '';
    const subjects = {};
    let dayTotal = 0, dayFeatured = 0;
    sec.querySelectorAll('.subject-block').forEach(sb => {
      const name = sb.querySelector('.subject-name')?.textContent.trim() || '';
      const papers = sb.querySelectorAll('.paper-item');
      let count = papers.length, featured = 0;
      papers.forEach(p => {
        const titleText = p.querySelector('.paper-title-wrap')?.textContent || '';
        const hasStar = titleText.includes('★');
        const hasConf = p.dataset.conference === '1';
        if (hasStar || hasConf) featured++;
        // cache for search
        p.dataset.searchText = [
          p.dataset.title || '',
          p.dataset.authors || '',
          p.querySelector('.paper-abstract')?.textContent || ''
        ].join(' ').toLowerCase();
      });
      subjects[name] = { count, featured };
      dayTotal += count;
      dayFeatured += featured;
    });
    days.push({ date, total: dayTotal, featured: dayFeatured, subjects });
  });
  return days;
}

const DATA = collectData();
const totalPapers = DATA.reduce((s, d) => s + d.total, 0);
const totalFeatured = DATA.reduce((s, d) => s + d.featured, 0);
const avgDaily = DATA.length ? Math.round(totalPapers / DATA.length) : 0;

// Update summary bar
const sb = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
sb('sb-total', `${totalPapers} 篇`);
sb('sb-days', `${DATA.length} 天`);
sb('sb-top', `${totalFeatured} 篇精选`);
sb('kpi-total', totalPapers);
sb('kpi-days', DATA.length);
sb('kpi-avg', avgDaily);
sb('kpi-top', totalFeatured);

// ─── Auto-detect code links ────────────
document.querySelectorAll('.paper-abstract').forEach(el => {
  const m = el.textContent.match(/https?:\/\/github\.com\/[\w\-./]+/);
  if (m) {
    const actions = el.closest('.paper-body')?.querySelector('.paper-actions');
    if (actions && !actions.querySelector('.code-link')) {
      const a = document.createElement('a');
      a.className = 'paction paction--link code-link';
      a.href = m[0]; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.innerHTML = '<i class="ri-code-s-slash-line"></i> Code';
      const bmBtn = actions.querySelector('.paction--bm');
      if (bmBtn) actions.insertBefore(a, bmBtn);
      else actions.appendChild(a);
    }
  }
});

// ─── Search + Featured filter ──────────
const searchInput = document.getElementById('search-input');
const featuredToggle = document.getElementById('featured-toggle');
let featuredOnly = false;

function filterPapers() {
  const q = (searchInput?.value || '').toLowerCase().trim();

  document.querySelectorAll('.paper-item').forEach(item => {
    // Get searchable text from visible elements
    const titleText = item.querySelector('.paper-title-wrap')?.textContent?.toLowerCase() || '';
    const authorsText = item.querySelector('.paper-authors')?.textContent?.toLowerCase() || '';
    const abstractText = item.querySelector('.paper-abstract')?.textContent?.toLowerCase() || '';

    const hasStar = titleText.includes('★');
    const hasConf = item.dataset.conference === '1';

    const matchQ = !q || titleText.includes(q) || authorsText.includes(q) || abstractText.includes(q);
    const matchF = !featuredOnly || hasStar || hasConf;
    const show = matchQ && matchF;
    item.style.display = show ? '' : 'none';
  });

  // Hide empty subject blocks
  document.querySelectorAll('.subject-block').forEach(sb => {
    const hasVisible = [...sb.querySelectorAll('.paper-item')].some(p => p.style.display !== 'none');
    sb.style.display = hasVisible ? '' : 'none';
  });

  // Hide empty day sections
  document.querySelectorAll('.day-section').forEach(d => {
    const hasVisible = [...d.querySelectorAll('.paper-item')].some(p => p.style.display !== 'none');
    d.style.display = hasVisible ? '' : 'none';
  });
}

searchInput?.addEventListener('input', filterPapers);
featuredToggle?.addEventListener('click', () => {
  featuredOnly = !featuredOnly;
  featuredToggle.classList.toggle('active');
  filterPapers();
});

// ─── Featured Legend ───────────────────
document.getElementById('featured-info-icon')?.addEventListener('click', () => {
  document.getElementById('featured-legend')?.classList.toggle('hidden');
});
document.getElementById('legend-close')?.addEventListener('click', () => {
  document.getElementById('featured-legend')?.classList.add('hidden');
});

// ─── Stats Dashboard ───────────────────
const statsBtn = document.getElementById('stats-btn');
const statsDash = document.getElementById('stats-dashboard');
const statsClose = document.getElementById('stats-close');
let chartsInited = false;

statsBtn?.addEventListener('click', () => {
  const hidden = statsDash.classList.toggle('hidden');
  if (!hidden && !chartsInited) { initCharts(); chartsInited = true; }
});
statsClose?.addEventListener('click', () => statsDash?.classList.add('hidden'));

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function initCharts() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const tickColor = isDark ? '#52525b' : '#a1a1aa';
  const textColor = isDark ? '#a1a1aa' : '#52525b';

  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;

  // Destroy existing if re-init
  ['chart-daily', 'chart-subjects', 'chart-featured'].forEach(id => {
    const inst = Chart.getChart(id);
    if (inst) inst.destroy();
  });

  // ── Chart 1: Daily trend ──
  const dailyCtx = document.getElementById('chart-daily');
  if (dailyCtx) {
    const sorted = [...DATA].reverse();
    new Chart(dailyCtx, {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.date.slice(5)),
        datasets: [
          {
            label: '总论文',
            data: sorted.map(d => d.total),
            backgroundColor: isDark ? 'rgba(96,165,250,.6)' : 'rgba(29,78,216,.6)',
            borderColor:      isDark ? 'rgba(96,165,250,1)'  : 'rgba(29,78,216,1)',
            borderWidth: 1, borderRadius: 3,
          },
          {
            label: '精选论文',
            data: sorted.map(d => d.featured),
            backgroundColor: isDark ? 'rgba(251,191,36,.6)' : 'rgba(180,83,9,.6)',
            borderColor:      isDark ? 'rgba(251,191,36,1)'  : 'rgba(180,83,9,1)',
            borderWidth: 1, borderRadius: 3,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor, boxWidth: 12, padding: 12 } } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: tickColor, maxRotation: 0 } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor } }
        }
      }
    });
  }

  // ── Chart 2: Subject distribution ──
  const subjCtx = document.getElementById('chart-subjects');
  if (subjCtx) {
    // Aggregate across all days
    const subjMap = {};
    DATA.forEach(d => {
      Object.entries(d.subjects).forEach(([name, v]) => {
        subjMap[name] = (subjMap[name] || 0) + v.count;
      });
    });
    const sorted2 = Object.entries(subjMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const palette = isDark
      ? ['#60a5fa','#34d399','#a78bfa','#f87171','#fbbf24','#38bdf8','#fb923c','#e879f9']
      : ['#1d4ed8','#059669','#7c3aed','#dc2626','#d97706','#0284c7','#ea580c','#c026d3'];

    new Chart(subjCtx, {
      type: 'bar',
      data: {
        labels: sorted2.map(([k]) => k.length > 14 ? k.slice(0,13)+'…' : k),
        datasets: [{
          data: sorted2.map(([,v]) => v),
          backgroundColor: palette,
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: tickColor } },
          y: { grid: { display: false }, ticks: { color: tickColor } }
        }
      }
    });
  }

  // ── Chart 3: Featured donut ──
  const featCtx = document.getElementById('chart-featured');
  if (featCtx) {
    const other = totalPapers - totalFeatured;
    new Chart(featCtx, {
      type: 'doughnut',
      data: {
        labels: ['精选论文', '普通论文'],
        datasets: [{
          data: [totalFeatured, other],
          backgroundColor: isDark
            ? ['rgba(251,191,36,.85)', 'rgba(39,39,42,.85)']
            : ['rgba(180,83,9,.85)',   'rgba(228,228,231,.85)'],
          borderColor: isDark ? '#141416' : '#ffffff',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, padding: 10 } }
        }
      }
    });
  }
}

// ─── Bookmarks ─────────────────────────
let bookmarks = {};
try { bookmarks = JSON.parse(localStorage.getItem('arxiv-bm') || '{}'); } catch(e) {}

function saveBM() { localStorage.setItem('arxiv-bm', JSON.stringify(bookmarks)); }

function updateBMCount() {
  const n = Object.keys(bookmarks).length;
  const badge = document.getElementById('bookmark-count');
  if (!badge) return;
  badge.textContent = n;
  badge.classList.toggle('hidden', n === 0);
}

function renderBMPanel() {
  const body = document.getElementById('bp-body');
  if (!body) return;
  const ids = Object.keys(bookmarks);
  if (!ids.length) {
    body.innerHTML = `<div class="bp-empty"><i class="ri-bookmark-line" style="font-size:2.8rem"></i><br>暂无收藏<br><span style="font-size:.78rem">点击论文右侧 <i class="ri-bookmark-line"></i> 收藏</span></div>`;
    return;
  }
  body.innerHTML = ids.map(id => {
    const b = bookmarks[id];
    const safeTitle = b.title.replace(/</g,'&lt;');
    const safeAuthors = b.authors.replace(/</g,'&lt;');
    return `<div class="bm-item">
      <div class="bm-item-title">${safeTitle}</div>
      <div class="bm-item-meta">
        <div class="bm-item-authors">${safeAuthors}</div>
        <div class="bm-item-actions">
          <a href="${b.url}" target="_blank" rel="noopener" title="打开"><i class="ri-external-link-line"></i></a>
          <button onclick="window._removeBM('${CSS.escape(id)}')" title="取消收藏"><i class="ri-delete-bin-line"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

window._removeBM = function(id) {
  delete bookmarks[id];
  saveBM(); updateBMCount(); renderBMPanel();
  const btn = document.querySelector(`.bookmark-btn[data-id="${id}"]`);
  if (btn) { btn.classList.remove('bookmarked'); btn.title='收藏'; }
};

document.querySelectorAll('.bookmark-btn').forEach(btn => {
  const id = btn.dataset.id;
  if (bookmarks[id]) btn.classList.add('bookmarked');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (bookmarks[id]) {
      delete bookmarks[id];
      btn.classList.remove('bookmarked');
    } else {
      const card = btn.closest('.paper-item');
      const title = card?.dataset.title || card?.querySelector('.paper-title')?.textContent || '';
      const authorsRaw = card?.dataset.authors || card?.querySelector('.paper-authors')?.textContent || '';
      const authors = authorsRaw.slice(0, 100);
      const url = btn.dataset.url || '#';
      bookmarks[id] = { title, authors, url };
      btn.classList.add('bookmarked');
    }
    saveBM(); updateBMCount(); renderBMPanel();
  });
});

// Panel open/close
const bmPanel = document.getElementById('bookmarks-panel');
const overlay = document.getElementById('panel-overlay');
const openPanel = () => { bmPanel?.classList.add('open'); overlay?.classList.add('open'); renderBMPanel(); };
const closePanel = () => { bmPanel?.classList.remove('open'); overlay?.classList.remove('open'); };
document.getElementById('bookmarks-btn')?.addEventListener('click', openPanel);
document.getElementById('bp-close')?.addEventListener('click', closePanel);
overlay?.addEventListener('click', closePanel);

// Export
document.getElementById('bp-export')?.addEventListener('click', () => {
  const lines = Object.values(bookmarks).map(b => `${b.title}\n${b.authors}\n${b.url}\n`).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines], { type: 'text/plain' }));
  a.download = '3DArxiv-收藏.txt';
  a.click();
});

updateBMCount();
renderBMPanel();

// ─── AI Summary ────────────────────────
// Opens Claude.ai in a new tab with the abstract pre-filled as a prompt.
// This works without any API key or CORS issues.
document.querySelectorAll('.ai-summary-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();

    const paperBody = btn.closest('.paper-body');
    const abstractEl = paperBody?.querySelector('.paper-abstract');
    const abstract = abstractEl?.textContent?.trim() || '';
    const title = btn.dataset.title || '';

    // If already have a cached panel, just toggle it
    const existing = paperBody?.querySelector('.ai-panel');
    if (existing) {
      existing.classList.toggle('hidden');
      return;
    }

    // Build Claude prompt and open in new tab
    const prompt = `请对以下学术论文进行简洁的中文解读：

**论文标题：** ${title}

**摘要原文：**
${abstract}

请用以下格式回答：
**一句话总结：** [用一句话说明这篇论文做了什么]
**核心方法：** [2-3句话描述核心方法]
**主要结论：** [1-2句话总结实验结论]`;

    const claudeUrl = 'https://claude.ai/new?q=' + encodeURIComponent(prompt);
    window.open(claudeUrl, '_blank', 'noopener');

    // Show a small hint panel
    const aiPanel = document.createElement('div');
    aiPanel.className = 'ai-panel';
    aiPanel.innerHTML = `<div class="ai-panel-hd"><i class="ri-sparkling-2-line"></i> AI 中文解读</div>
      <div style="font-size:.82rem;color:var(--c-text2);line-height:1.7">
        已在新标签页打开 Claude，论文摘要已自动填入。<br>
        <span style="color:var(--c-text3);font-size:.78rem">提示：你也可以在仓库中配置 GitHub Actions 来自动预生成所有摘要。</span>
      </div>`;
    btn.closest('.paper-actions').after(aiPanel);
  });
});
