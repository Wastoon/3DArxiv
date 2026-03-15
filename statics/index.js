/* ══════════════════════════════════════════
   3DArxiv — index.js
   Theme · Search+History · Filter · Read · Charts · Bookmarks+Notes · Nav · Dedupe
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
  if (e.key === 'Escape') {
    document.getElementById('search-input')?.blur();
    hideSearchHistory();
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
        const hasStar = p.querySelector('.paper-title-wrap')?.textContent?.includes('★') || false;
        const hasConf = p.dataset.conference === '1';
        if (hasStar || hasConf) featured++;
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

const sbSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
sbSet('sb-total', `${totalPapers} 篇`);
sbSet('sb-days', `${DATA.length} 天`);
sbSet('sb-top', `${totalFeatured} 篇精选`);
sbSet('kpi-total', totalPapers);
sbSet('kpi-days', DATA.length);
sbSet('kpi-avg', avgDaily);
sbSet('kpi-top', totalFeatured);

// ─── Dedupe detection ──────────────────
const seenIds = new Map();
document.querySelectorAll('.paper-item').forEach(item => {
  const id = item.dataset.id || item.dataset.title;
  if (!id) return;
  seenIds.set(id, (seenIds.get(id) || 0) + 1);
});
let dupeCount = 0;
seenIds.forEach(count => { if (count > 1) dupeCount++; });

const dedupeInfo = document.getElementById('nav-dedupe-info');
if (dedupeInfo && dupeCount > 0) {
  dedupeInfo.textContent = `⚠ ${dupeCount} 篇论文跨领域重复出现`;
  dedupeInfo.title = '同一篇论文在不同领域下各计一次，统计总数有重复';
}

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
      a.onclick = e => e.stopPropagation();
      const readBtn = actions.querySelector('.paction--read');
      if (readBtn) actions.insertBefore(a, readBtn);
      else actions.appendChild(a);
    }
  }
});

// ─── Search cache ──────────────────────
document.querySelectorAll('.paper-item').forEach(item => {
  const title    = (item.dataset.title   || '').toLowerCase();
  const authors  = (item.dataset.authors || '').toLowerCase();
  const comment  = (item.dataset.comment || '').toLowerCase();
  const abstract = (item.querySelector('.paper-abstract')?.textContent || '').toLowerCase();
  const subject  = (item.closest('.subject-block')?.querySelector('.subject-name')?.textContent || '').toLowerCase();
  item.dataset.search = [title, authors, abstract, comment, subject].join(' ');
  item.dataset.hasStar = item.querySelector('.paper-title-wrap')?.textContent?.includes('★') ? '1' : '0';
});

// ─── Search history ────────────────────
const HISTORY_KEY = 'arxiv-search-history';
const MAX_HISTORY = 10;
let searchHistory = [];
try { searchHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch(e) {}

function saveToHistory(q) {
  if (!q || q.length < 2) return;
  searchHistory = [q, ...searchHistory.filter(h => h !== q)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory));
}

const searchInput = document.getElementById('search-input');
const historyDropdown = document.getElementById('search-history-dropdown');

function showSearchHistory(filter) {
  if (!historyDropdown) return;
  const filtered = filter
    ? searchHistory.filter(h => h.toLowerCase().includes(filter.toLowerCase()))
    : searchHistory;
  if (!filtered.length) { hideSearchHistory(); return; }
  historyDropdown.innerHTML = filtered.map(h =>
    `<div class="sh-item" data-val="${h.replace(/"/g,'&quot;')}">
       <i class="ri-history-line"></i>
       <span class="sh-text">${h}</span>
       <button class="sh-del" title="删除">×</button>
     </div>`
  ).join('');
  historyDropdown.classList.remove('hidden');

  historyDropdown.querySelectorAll('.sh-item').forEach(item => {
    item.querySelector('.sh-del')?.addEventListener('mousedown', e => {
      e.preventDefault();
      const val = item.dataset.val;
      searchHistory = searchHistory.filter(h => h !== val);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory));
      showSearchHistory(searchInput.value);
    });
    item.addEventListener('mousedown', e => {
      if (e.target.classList.contains('sh-del')) return;
      e.preventDefault();
      searchInput.value = item.dataset.val;
      hideSearchHistory();
      filterPapers();
    });
  });
}

function hideSearchHistory() {
  historyDropdown?.classList.add('hidden');
}

searchInput?.addEventListener('focus', () => showSearchHistory(searchInput.value));
searchInput?.addEventListener('blur', () => setTimeout(hideSearchHistory, 150));
searchInput?.addEventListener('input', () => { filterPapers(); showSearchHistory(searchInput.value); });
searchInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = searchInput.value.trim();
    if (q) saveToHistory(q);
    hideSearchHistory();
  }
});

// ─── Search + Featured filter ──────────
const featuredToggle = document.getElementById('featured-toggle');
let featuredOnly = false;

function filterPapers() {
  const q = (searchInput?.value || '').toLowerCase().trim();
  document.querySelectorAll('.paper-item').forEach(item => {
    const searchText = item.dataset.search || '';
    const hasStar    = item.dataset.hasStar === '1';
    const hasConf    = item.dataset.conference === '1';
    const matchQ = !q || searchText.includes(q);
    const matchF = !featuredOnly || hasStar || hasConf;
    item.style.display = (matchQ && matchF) ? '' : 'none';
  });
  document.querySelectorAll('.subject-block').forEach(sb => {
    const hasVisible = [...sb.querySelectorAll('.paper-item')].some(p => p.style.display !== 'none');
    sb.style.display = hasVisible ? '' : 'none';
  });
  document.querySelectorAll('.day-section').forEach(d => {
    const hasVisible = [...d.querySelectorAll('.paper-item')].some(p => p.style.display !== 'none');
    d.style.display = hasVisible ? '' : 'none';
  });
}

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

// ─── Read / Unread ─────────────────────
const READ_KEY = 'arxiv-read';
let readSet = new Set();
try { readSet = new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch(e) {}

function saveRead() { localStorage.setItem(READ_KEY, JSON.stringify([...readSet])); }

function updateReadCount() {
  const el = document.getElementById('sb-read');
  if (el) el.textContent = `已读 ${readSet.size} 篇`;
}

function applyReadState(item, id) {
  const btn = item.querySelector('.read-btn');
  if (readSet.has(id)) {
    item.classList.add('read');
    if (btn) { btn.classList.add('is-read'); btn.title = '标记为未读'; btn.querySelector('i').className = 'ri-eye-2-line'; }
  } else {
    item.classList.remove('read');
    if (btn) { btn.classList.remove('is-read'); btn.title = '标记为已读'; btn.querySelector('i').className = 'ri-eye-line'; }
  }
}

document.querySelectorAll('.paper-item').forEach(item => {
  const id = item.dataset.id;
  if (!id) return;
  applyReadState(item, id);
  item.querySelector('.read-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    if (readSet.has(id)) { readSet.delete(id); }
    else { readSet.add(id); item.querySelector('details')?.removeAttribute('open'); }
    saveRead(); applyReadState(item, id); updateReadCount();
  });
});

updateReadCount();

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

function initCharts() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const tickColor = isDark ? '#52525b' : '#a1a1aa';
  const textColor = isDark ? '#a1a1aa' : '#52525b';

  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  ['chart-daily','chart-subjects','chart-featured'].forEach(id => { const i = Chart.getChart(id); if (i) i.destroy(); });

  const dailyCtx = document.getElementById('chart-daily');
  if (dailyCtx) {
    const sorted = [...DATA].reverse();
    new Chart(dailyCtx, {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.date.slice(5)),
        datasets: [
          { label:'总论文', data: sorted.map(d=>d.total),
            backgroundColor: isDark?'rgba(96,165,250,.55)':'rgba(29,78,216,.55)',
            borderColor: isDark?'rgba(96,165,250,1)':'rgba(29,78,216,1)', borderWidth:1, borderRadius:3 },
          { label:'精选论文', data: sorted.map(d=>d.featured),
            backgroundColor: isDark?'rgba(251,191,36,.65)':'rgba(180,83,9,.65)',
            borderColor: isDark?'rgba(251,191,36,1)':'rgba(180,83,9,1)', borderWidth:1, borderRadius:3 }
        ]
      },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ color:textColor, boxWidth:12, padding:12 }}},
        scales:{ x:{ grid:{color:gridColor}, ticks:{color:tickColor,maxRotation:0}},
                 y:{ grid:{color:gridColor}, ticks:{color:tickColor}}}
      }
    });
  }

  const subjCtx = document.getElementById('chart-subjects');
  if (subjCtx) {
    const subjMap = {};
    DATA.forEach(d => Object.entries(d.subjects).forEach(([name,v]) => { subjMap[name]=(subjMap[name]||0)+v.count; }));
    const sorted2 = Object.entries(subjMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const palette = isDark
      ? ['#60a5fa','#34d399','#a78bfa','#f87171','#fbbf24','#38bdf8','#fb923c','#e879f9','#86efac','#fda4af']
      : ['#1d4ed8','#059669','#7c3aed','#dc2626','#d97706','#0284c7','#ea580c','#c026d3','#16a34a','#e11d48'];
    new Chart(subjCtx, {
      type:'bar',
      data:{ labels: sorted2.map(([k])=>k.length>16?k.slice(0,15)+'…':k),
             datasets:[{ data:sorted2.map(([,v])=>v), backgroundColor:palette, borderRadius:4 }]},
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{ x:{grid:{color:gridColor},ticks:{color:tickColor}}, y:{grid:{display:false},ticks:{color:tickColor}}}}
    });
  }

  const featCtx = document.getElementById('chart-featured');
  if (featCtx) {
    new Chart(featCtx, {
      type:'doughnut',
      data:{ labels:['精选论文','普通论文'],
             datasets:[{ data:[totalFeatured, totalPapers-totalFeatured],
               backgroundColor: isDark?['rgba(251,191,36,.85)','rgba(39,39,42,.85)']:['rgba(180,83,9,.85)','rgba(228,228,231,.85)'],
               borderColor: isDark?'#141416':'#ffffff', borderWidth:2 }]},
      options:{ responsive:true, maintainAspectRatio:false, cutout:'65%',
        plugins:{legend:{position:'bottom',labels:{color:textColor,boxWidth:12,padding:10}}}}
    });
  }
}

// ─── Bookmarks + Notes ─────────────────
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
    const safeAuthors = (b.authors||'').replace(/</g,'&lt;');
    const safeNote = (b.note||'').replace(/</g,'&lt;');
    const safeId = id.replace(/"/g,'&quot;');
    return `<div class="bm-item">
      <div class="bm-item-title">${safeTitle}</div>
      <div class="bm-item-meta">
        <div class="bm-item-authors">${safeAuthors}</div>
        <div class="bm-item-actions">
          <a href="${id}" target="_blank" rel="noopener" title="打开"><i class="ri-external-link-line"></i></a>
          <button class="bm-note-toggle" title="编辑笔记"><i class="ri-edit-2-line"></i></button>
          <button onclick="window._removeBM('${CSS.escape(id)}')" title="取消收藏"><i class="ri-delete-bin-line"></i></button>
        </div>
      </div>
      <div class="bm-note-area${safeNote ? '' : ' hidden'}">
        <textarea class="bm-note-input" placeholder="记录你的想法、收藏原因…" data-bm-id="${safeId}">${safeNote}</textarea>
      </div>
    </div>`;
  }).join('');

  body.querySelectorAll('.bm-note-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const area = btn.closest('.bm-item').querySelector('.bm-note-area');
      area.classList.toggle('hidden');
      if (!area.classList.contains('hidden')) area.querySelector('textarea')?.focus();
    });
  });
  body.querySelectorAll('.bm-note-input').forEach(ta => {
    ta.addEventListener('input', () => {
      const id = ta.dataset.bmId;
      if (bookmarks[id]) { bookmarks[id].note = ta.value; saveBM(); }
    });
  });
}

window._removeBM = function(id) {
  delete bookmarks[id]; saveBM(); updateBMCount(); renderBMPanel();
  document.querySelector(`.bookmark-btn[data-id="${id}"]`)?.classList.remove('bookmarked');
};

document.querySelectorAll('.bookmark-btn').forEach(btn => {
  const id = btn.dataset.id;
  if (bookmarks[id]) btn.classList.add('bookmarked');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (bookmarks[id]) { delete bookmarks[id]; btn.classList.remove('bookmarked'); }
    else {
      const card = btn.closest('.paper-item');
      bookmarks[id] = { title: card?.dataset.title||'', authors: (card?.dataset.authors||'').slice(0,120), url: btn.dataset.url||'#', note:'' };
      btn.classList.add('bookmarked');
    }
    saveBM(); updateBMCount(); renderBMPanel();
  });
});

const bmPanel = document.getElementById('bookmarks-panel');
const overlay = document.getElementById('panel-overlay');
const openPanel = () => { bmPanel?.classList.add('open'); overlay?.classList.add('open'); renderBMPanel(); };
const closePanel = () => { bmPanel?.classList.remove('open'); overlay?.classList.remove('open'); };
document.getElementById('bookmarks-btn')?.addEventListener('click', openPanel);
document.getElementById('bp-close')?.addEventListener('click', closePanel);
overlay?.addEventListener('click', closePanel);

document.getElementById('bp-export')?.addEventListener('click', () => {
  const lines = Object.values(bookmarks).map(b => {
    let s = `${b.title}\n${b.authors}\n${b.url}`;
    if (b.note) s += `\n📝 ${b.note}`;
    return s;
  }).join('\n\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines], {type:'text/plain'}));
  a.download = '3DArxiv-收藏.txt'; a.click();
});

updateBMCount();
renderBMPanel();

// ─── Nav Panel (subject quick jump) ────
const navBtn  = document.getElementById('nav-btn');
const navPanel = document.getElementById('nav-panel');
const navClose = document.getElementById('nav-close');
const navBody  = document.getElementById('nav-panel-body');

function buildNavPanel() {
  if (!navBody) return;
  // Aggregate counts across all days per subject name
  const subjMap = {};
  document.querySelectorAll('.subject-block').forEach(sb => {
    const name = sb.querySelector('.subject-name')?.textContent.trim() || '';
    const count = sb.querySelectorAll('.paper-item').length;
    const featured = [...sb.querySelectorAll('.paper-item')].filter(p =>
      p.querySelector('.paper-title-wrap')?.textContent?.includes('★') || p.dataset.conference==='1'
    ).length;
    const anchor = sb.id;
    if (!subjMap[name]) subjMap[name] = { count:0, featured:0, anchor };
    subjMap[name].count += count;
    subjMap[name].featured += featured;
  });

  const sorted = Object.entries(subjMap).sort((a,b) => b[1].count - a[1].count);

  navBody.innerHTML = sorted.map(([name, info]) =>
    `<div class="nav-item" data-name="${name.replace(/"/g,'&quot;')}">
       <span class="nav-item-name">${name}</span>
       <div class="nav-item-right">
         ${info.featured>0 ? `<span class="nav-item-feat">★${info.featured}</span>` : ''}
         <span class="nav-item-count">${info.count}</span>
       </div>
     </div>`
  ).join('');

  navBody.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const name = item.querySelector('.nav-item-name').textContent;
      // Find first visible subject block with this name
      const target = [...document.querySelectorAll('.subject-block')].find(sb =>
        sb.querySelector('.subject-name')?.textContent.trim() === name && sb.style.display !== 'none'
      );
      if (target) {
        target.querySelector('details')?.setAttribute('open','');
        target.scrollIntoView({ behavior:'smooth', block:'start' });
        target.classList.add('nav-flash');
        setTimeout(() => target.classList.remove('nav-flash'), 900);
      }
      navPanel.classList.add('hidden');
    });
  });
}

navBtn?.addEventListener('click', e => {
  e.stopPropagation();
  const isHidden = navPanel.classList.toggle('hidden');
  if (!isHidden) buildNavPanel();
});
navClose?.addEventListener('click', () => navPanel.classList.add('hidden'));
document.addEventListener('click', e => {
  if (navPanel && !navPanel.classList.contains('hidden') &&
      !navPanel.contains(e.target) && !navBtn?.contains(e.target)) {
    navPanel.classList.add('hidden');
  }
});

// ─── AI Summary (with pregenerated TL;DR support) ─────
// summaries 在下方 loadSummaries() 加载后填充
window._summaries = {};

function showAiPanel(btn, tldr) {
  const paperBody = btn.closest('.paper-body');
  const existing  = paperBody?.querySelector('.ai-panel');
  if (existing) { existing.classList.toggle('hidden'); return; }

  const aiPanel = document.createElement('div');
  aiPanel.className = 'ai-panel';

  if (tldr) {
    // 有预生成的 TL;DR：直接展示
    aiPanel.innerHTML = `
      <div class="ai-panel-hd"><i class="ri-sparkling-2-line"></i> AI 一句话总结</div>
      <div class="ai-tldr">${tldr}</div>`;
  } else {
    // 没有预生成：跳转 Claude 网页
    const abstract = paperBody?.querySelector('.paper-abstract')?.textContent?.trim() || '';
    const title    = btn.dataset.title || '';
    const prompt   = `请对以下学术论文进行简洁的中文解读：\n\n**论文标题：** ${title}\n\n**摘要原文：**\n${abstract}\n\n请用以下格式回答：\n**一句话总结：** [用一句话说明这篇论文做了什么]\n**核心方法：** [2-3句话描述核心方法]\n**主要结论：** [1-2句话总结实验结论]`;
    window.open('https://claude.ai/new?q=' + encodeURIComponent(prompt), '_blank', 'noopener');
    aiPanel.innerHTML = `
      <div class="ai-panel-hd"><i class="ri-sparkling-2-line"></i> AI 中文解读</div>
      <div style="font-size:.82rem;color:var(--c-text2);line-height:1.7">
        已在新标签页打开 Claude，论文摘要已自动填入。
      </div>`;
  }
  btn.closest('.paper-actions').after(aiPanel);
}

document.querySelectorAll('.ai-summary-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const id   = btn.closest('.paper-item')?.dataset.id || '';
    const tldr = window._summaries[id]?.tldr || null;
    showAiPanel(btn, tldr);
  });
});

async function loadSummaries() {
  try {
    const resp = await fetch('summary.json?t=' + Date.now());
    if (!resp.ok) return;
    window._summaries = await resp.json();

    // 更新已加载的 AI 按钮状态：有预生成摘要的显示小圆点
    const count = Object.keys(window._summaries).length;
    if (count === 0) return;

    document.querySelectorAll('.paper-item').forEach(item => {
      const id  = item.dataset.id || '';
      const btn = item.querySelector('.ai-summary-btn');
      if (!btn) return;
      if (window._summaries[id]?.tldr) {
        btn.classList.add('has-tldr');
        btn.title = '查看 AI 一句话总结';
      }
    });

    // 在 summary bar 显示已生成数量
    const sbRead = document.getElementById('sb-read');
    if (sbRead) {
      const info = document.createElement('span');
      info.className = 'sb-sep';
      info.textContent = '·';
      const stat = document.createElement('span');
      stat.className = 'sb-stat';
      stat.style.color = 'var(--c-purple)';
      stat.innerHTML = `<i class="ri-sparkling-2-line"></i> ${count} AI摘要`;
      sbRead.after(stat);
      sbRead.after(info);
    }
  } catch(e) {
    // summary.json 不存在时静默失败
  }
}

loadSummaries();

// ═══════════════════════════════════════════
// ─── 1. Sub-topic Tag Filter ───────────────
// ═══════════════════════════════════════════

const TAG_RULES = [
  { tag: 'VLA',            keywords: ['vision-language-action','vla','vision language action'] },
  { tag: 'Humanoid',       keywords: ['humanoid','bipedal','whole-body','loco-manipulation'] },
  { tag: 'Manipulation',   keywords: ['manipulation','dexterous','grasping','grasp','in-hand'] },
  { tag: 'Navigation',     keywords: ['navigation','path planning','obstacle avoidance','autonomous driving','self-driving'] },
  { tag: 'NeRF / 3DGS',   keywords: ['nerf','neural radiance','3d gaussian','gaussian splatting','implicit surface'] },
  { tag: 'Digital Human',  keywords: ['digital human','human avatar','human reconstruction','human rendering','clothed human','free-viewpoint human','relightable human'] },
  { tag: 'Gaussian Avatar',keywords: ['gaussian avatar','avatar gaussian','animatable gaussian','deformable gaussian','4d gaussian','dynamic gaussian','smpl'] },
  { tag: 'Human Body',     keywords: ['human body','body reconstruction','parametric human','human pose','body model','pose estimation'] },
  { tag: 'Diffusion',      keywords: ['diffusion model','diffusion policy','score matching','denoising'] },
  { tag: 'Sim-to-Real',    keywords: ['sim-to-real','sim2real','simulation to real','domain randomization','domain adaptation'] },
  { tag: 'RL',             keywords: ['reinforcement learning','policy gradient','ppo','sac','rl agent','reward shaping'] },
  { tag: 'Transformer',    keywords: ['transformer','attention mechanism','self-attention','cross-attention','vision transformer','vit'] },
  { tag: 'Dataset',        keywords: ['dataset','benchmark','data collection','annotation','ground truth'] },
  { tag: 'Survey',         keywords: ['survey','review','overview','taxonomy'] },
];

// Assign tags to each paper based on title + abstract keywords
document.querySelectorAll('.paper-item').forEach(item => {
  const text = (item.dataset.search || '').toLowerCase();
  const tags = TAG_RULES.filter(r => r.keywords.some(kw => text.includes(kw))).map(r => r.tag);
  item.dataset.tags = tags.join(',');
});

// Build tag bar UI
const tagBar = document.createElement('div');
tagBar.id = 'tag-bar';
tagBar.className = 'tag-bar';

// Count papers per tag
const tagCounts = {};
TAG_RULES.forEach(r => { tagCounts[r.tag] = 0; });
document.querySelectorAll('.paper-item').forEach(item => {
  (item.dataset.tags || '').split(',').filter(Boolean).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
});

// Only show tags with at least 1 paper
const activeTags = TAG_RULES.filter(r => tagCounts[r.tag] > 0);

tagBar.innerHTML = `
  <div class="tag-bar-inner">
    <span class="tag-bar-label">子方向</span>
    <div class="tag-list" id="tag-list">
      <button class="tag-chip tag-chip--all active" data-tag="">全部</button>
      ${activeTags.map(r =>
        `<button class="tag-chip" data-tag="${r.tag}">${r.tag} <span class="tag-count">${tagCounts[r.tag]}</span></button>`
      ).join('')}
    </div>
  </div>`;

// Insert tag bar after summary bar
const summaryBar = document.querySelector('.summary-bar');
summaryBar?.after(tagBar);

// Tag filter state (multi-select)
const selectedTags = new Set();

function applyTagFilter() {
  document.querySelectorAll('.paper-item').forEach(item => {
    if (!selectedTags.size) {
      item.dataset.tagHidden = '';
      return;
    }
    const itemTags = (item.dataset.tags || '').split(',');
    const match = [...selectedTags].some(t => itemTags.includes(t));
    item.dataset.tagHidden = match ? '' : '1';
  });
  filterPapers(); // re-run existing filter to merge both conditions
}

// Patch existing filterPapers to also respect tag filter
const _origFilter = filterPapers;
// Override filterPapers to incorporate tag filtering
window.filterPapers = function() {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  document.querySelectorAll('.paper-item').forEach(item => {
    const searchText = item.dataset.search || '';
    const hasStar    = item.dataset.hasStar === '1';
    const hasConf    = item.dataset.conference === '1';
    const matchQ  = !q || searchText.includes(q);
    const matchF  = !featuredOnly || hasStar || hasConf;
    const matchT  = !selectedTags.size || [...selectedTags].some(t => (item.dataset.tags||'').split(',').includes(t));
    item.style.display = (matchQ && matchF && matchT) ? '' : 'none';
  });
  document.querySelectorAll('.subject-block').forEach(sb => {
    const hasVisible = [...sb.querySelectorAll('.paper-item')].some(p => p.style.display !== 'none');
    sb.style.display = hasVisible ? '' : 'none';
  });
  document.querySelectorAll('.day-section').forEach(d => {
    const hasVisible = [...d.querySelectorAll('.paper-item')].some(p => p.style.display !== 'none');
    d.style.display = hasVisible ? '' : 'none';
  });
};

document.getElementById('tag-list')?.addEventListener('click', e => {
  const chip = e.target.closest('.tag-chip');
  if (!chip) return;
  const tag = chip.dataset.tag;

  if (tag === '') {
    // "全部" resets all
    selectedTags.clear();
    document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  } else {
    document.querySelector('.tag-chip--all')?.classList.remove('active');
    if (selectedTags.has(tag)) {
      selectedTags.delete(tag);
      chip.classList.remove('active');
    } else {
      selectedTags.add(tag);
      chip.classList.add('active');
    }
    if (selectedTags.size === 0) {
      document.querySelector('.tag-chip--all')?.classList.add('active');
    }
  }
  filterPapers();
});


// ═══════════════════════════════════════════
// ─── 2. BibTeX One-click Copy ──────────────
// ═══════════════════════════════════════════

function buildBibTeX(title, authors, id) {
  // Extract arxiv ID from URL like https://arxiv.org/abs/2501.12345
  const arxivId = (id || '').replace(/.*abs\//, '').replace(/[^0-9.]/g, '');
  // Generate citekey: firstAuthorLastName + year + firstTitleWord
  const firstAuthor = (authors || '').split(',')[0].trim().split(' ').pop().toLowerCase().replace(/[^a-z]/g, '');
  const year = arxivId ? '20' + arxivId.slice(0, 2) : new Date().getFullYear();
  const firstWord = (title || '').split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  const citekey = `${firstAuthor}${year}${firstWord}`;

  const authorBib = (authors || '').split(',').map(a => a.trim()).join(' and ');

  return `@article{${citekey},
  title   = {${title}},
  author  = {${authorBib}},
  journal = {arXiv preprint arXiv:${arxivId}},
  year    = {${year}},
  url     = {${id}}
}`;
}

// Add BibTeX button to every paper's action row
document.querySelectorAll('.paper-item').forEach(item => {
  const actions = item.querySelector('.paper-actions');
  if (!actions) return;
  const title   = item.dataset.title   || '';
  const authors = item.dataset.authors || '';
  const id      = item.dataset.id      || '';

  const btn = document.createElement('button');
  btn.className = 'paction paction--bib bibtex-btn';
  btn.title = '复制 BibTeX 引用';
  btn.innerHTML = '<i class="ri-double-quotes-l"></i> BibTeX';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const bib = buildBibTeX(title, authors, id);
    navigator.clipboard.writeText(bib).then(() => {
      btn.innerHTML = '<i class="ri-check-line"></i> 已复制';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = '<i class="ri-double-quotes-l"></i> BibTeX';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(() => {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = bib; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.innerHTML = '<i class="ri-check-line"></i> 已复制';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = '<i class="ri-double-quotes-l"></i> BibTeX';
        btn.classList.remove('copied');
      }, 2000);
    });
  });

  // Insert before read button
  const readBtn = actions.querySelector('.paction--read');
  if (readBtn) actions.insertBefore(btn, readBtn);
  else actions.appendChild(btn);
});


// ═══════════════════════════════════════════
// ─── 3. Permalink — anchor-based deep link ─
// ═══════════════════════════════════════════

// Assign stable DOM ids to every paper item based on arxiv ID
document.querySelectorAll('.paper-item').forEach(item => {
  const rawId = item.dataset.id || '';
  // e.g. https://arxiv.org/abs/2501.12345v1 → anchor "p-2501.12345"
  const anchor = 'p-' + rawId.replace(/.*abs\//, '').replace(/v\d+$/, '');
  if (anchor !== 'p-') item.id = anchor;
});

// Add "链接" copy button to each paper's action row
document.querySelectorAll('.paper-item').forEach(item => {
  const anchor = item.id;
  if (!anchor) return;
  const actions = item.querySelector('.paper-actions');
  if (!actions) return;

  const btn = document.createElement('button');
  btn.className = 'paction paction--permalink permalink-btn';
  btn.title = '复制论文永久链接';
  btn.innerHTML = '<i class="ri-link"></i> 链接';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const url = `${location.origin}${location.pathname}#${anchor}`;
    navigator.clipboard.writeText(url).then(() => {
      btn.innerHTML = '<i class="ri-check-line"></i> 已复制';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = '<i class="ri-link"></i> 链接';
        btn.classList.remove('copied');
      }, 2000);
    });
  });

  // Insert as the last action button
  actions.appendChild(btn);
});

// On page load, if URL has a hash, scroll to and open that paper
function handleDeepLink() {
  const hash = location.hash.slice(1);
  if (!hash || !hash.startsWith('p-')) return;
  const target = document.getElementById(hash);
  if (!target) return;
  // Open all parent details
  target.closest('.subject-block')?.querySelector('details')?.setAttribute('open', '');
  target.querySelector('details')?.setAttribute('open', '');
  // Scroll with a small delay to let layout settle
  setTimeout(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('permalink-flash');
    setTimeout(() => target.classList.remove('permalink-flash'), 1200);
  }, 120);
}

handleDeepLink();
window.addEventListener('hashchange', handleDeepLink);

// ═══════════════════════════════════════════════════════════════
// ④ 移动端优化 — 已通过 CSS 处理，JS 侧补充 tag-bar 触摸滚动
// ═══════════════════════════════════════════════════════════════
// tag-bar 在移动端支持横向滑动（防止误触发纵向滚动）
(function() {
  const tagList = document.querySelector('.tag-list');
  if (!tagList) return;
  let startX = 0, startScrollLeft = 0, isDragging = false;
  tagList.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startScrollLeft = tagList.scrollLeft;
    isDragging = false;
  }, { passive: true });
  tagList.addEventListener('touchmove', e => {
    const dx = startX - e.touches[0].clientX;
    if (Math.abs(dx) > 5) isDragging = true;
    tagList.scrollLeft = startScrollLeft + dx;
  }, { passive: true });
})();

// ═══════════════════════════════════════════════════════════════
// ⑤ 键盘快捷键增强
// j/k  — 上下浏览论文（聚焦到下/上一篇）
// o    — 在 ArXiv 打开当前聚焦论文
// b    — 收藏/取消收藏当前聚焦论文
// e    — 展开/折叠当前聚焦论文
// ═══════════════════════════════════════════════════════════════
(function() {
  let focusedIdx = -1;

  function getPapers() {
    return [...document.querySelectorAll('.paper-item')]
      .filter(p => p.style.display !== 'none');
  }

  function setFocus(idx) {
    const papers = getPapers();
    if (!papers.length) return;
    idx = Math.max(0, Math.min(idx, papers.length - 1));

    // 移除旧焦点
    papers.forEach(p => p.classList.remove('kb-focused'));
    focusedIdx = idx;
    const el = papers[idx];
    el.classList.add('kb-focused');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function getFocused() {
    const papers = getPapers();
    return focusedIdx >= 0 && focusedIdx < papers.length ? papers[focusedIdx] : null;
  }

  document.addEventListener('keydown', e => {
    // 输入框内不触发
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    // 已被原有逻辑处理的键
    if (e.key === 'Tab' || e.key === '/' || e.key === 'Escape') return;

    const papers = getPapers();
    if (!papers.length) return;

    switch(e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        setFocus(focusedIdx < 0 ? 0 : focusedIdx + 1);
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        setFocus(focusedIdx <= 0 ? 0 : focusedIdx - 1);
        break;
      case 'o': {
        e.preventDefault();
        const el = getFocused();
        if (!el) return;
        const id = el.dataset.id;
        if (id) window.open(id, '_blank', 'noopener');
        break;
      }
      case 'b': {
        e.preventDefault();
        const el = getFocused();
        if (!el) return;
        el.querySelector('.bookmark-btn')?.click();
        break;
      }
      case 'e':
      case 'Enter': {
        e.preventDefault();
        const el = getFocused();
        if (!el) return;
        const det = el.querySelector('details');
        if (det) det.open = !det.open;
        break;
      }
    }
  });

  // 鼠标悬停时也更新焦点索引
  document.addEventListener('mouseover', e => {
    const paper = e.target.closest('.paper-item');
    if (!paper) return;
    const papers = getPapers();
    const idx = papers.indexOf(paper);
    if (idx >= 0) {
      papers.forEach(p => p.classList.remove('kb-focused'));
      focusedIdx = idx;
    }
  });
})();

// ═══════════════════════════════════════════════════════════════
// ⑥ 论文导出 — 批量导出当前可见论文为 CSV / BibTeX
// ═══════════════════════════════════════════════════════════════
(function() {
  // 在收藏面板底部加导出按钮，另外在 summary-bar 右侧加导出入口
  const sbRight = document.querySelector('.sb-right');
  if (sbRight) {
    const exportBtn = document.createElement('button');
    exportBtn.className = 'sb-export-btn';
    exportBtn.title = '导出当前可见论文';
    exportBtn.innerHTML = '<i class="ri-download-2-line"></i> 导出';
    exportBtn.addEventListener('click', () => showExportModal());
    sbRight.prepend(exportBtn);
  }

  function getVisiblePapers() {
    return [...document.querySelectorAll('.paper-item')]
      .filter(p => p.style.display !== 'none')
      .map(p => ({
        id:      p.dataset.id || '',
        title:   p.dataset.title || '',
        authors: p.dataset.authors || '',
        comment: p.dataset.comment || '',
        subject: p.closest('.subject-block')?.querySelector('.subject-name')?.textContent?.trim() || '',
        abstract: p.querySelector('.paper-abstract')?.textContent?.trim() || '',
      }));
  }

  function exportCSV(papers) {
    const header = ['ArXiv ID','Title','Authors','Subject','Comment'];
    const rows = papers.map(p => [
      p.id, p.title, p.authors, p.subject, p.comment
    ].map(v => `"${(v||'').replace(/"/g,'""')}"`).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    download('3DArxiv-export.csv', csv, 'text/csv');
  }

  function exportBibTeX(papers) {
    const entries = papers.map(p => {
      const arxivId = (p.id || '').replace(/.*abs\//, '').replace(/[^0-9.]/g, '');
      const year = arxivId ? '20' + arxivId.slice(0,2) : new Date().getFullYear();
      const firstAuthor = (p.authors||'').split(',')[0].trim().split(' ').pop().toLowerCase().replace(/[^a-z]/g,'');
      const firstWord = (p.title||'').split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g,'');
      const key = `${firstAuthor}${year}${firstWord}`;
      const authorBib = (p.authors||'').split(',').map(a=>a.trim()).join(' and ');
      return `@article{${key},\n  title   = {${p.title}},\n  author  = {${authorBib}},\n  journal = {arXiv preprint arXiv:${arxivId}},\n  year    = {${year}},\n  url     = {${p.id}}\n}`;
    });
    download('3DArxiv-export.bib', entries.join('\n\n'), 'text/plain');
  }

  function exportMarkdown(papers) {
    const lines = papers.map(p =>
      `- **[${p.title}](${p.id})**\n  ${p.authors}${p.comment ? `\n  *${p.comment}*` : ''}`
    );
    download('3DArxiv-export.md', lines.join('\n\n'), 'text/markdown');
  }

  function download(filename, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff'+content], { type }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function showExportModal() {
    const papers = getVisiblePapers();
    const existing = document.getElementById('export-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'export-modal';
    modal.className = 'export-modal-overlay';
    modal.innerHTML = `
      <div class="export-modal">
        <div class="export-modal-hd">
          <span><i class="ri-download-2-line"></i> 导出论文</span>
          <button class="export-modal-close" id="export-close"><i class="ri-close-line"></i></button>
        </div>
        <div class="export-modal-body">
          <div class="export-count">当前可见 <strong>${papers.length}</strong> 篇论文</div>
          <div class="export-btns">
            <button class="export-btn" id="exp-csv">
              <i class="ri-file-excel-2-line"></i>
              <span>CSV</span>
              <small>Excel 可打开</small>
            </button>
            <button class="export-btn" id="exp-bib">
              <i class="ri-double-quotes-l"></i>
              <span>BibTeX</span>
              <small>文献管理软件</small>
            </button>
            <button class="export-btn" id="exp-md">
              <i class="ri-markdown-line"></i>
              <span>Markdown</span>
              <small>笔记软件</small>
            </button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('export-close').addEventListener('click', () => modal.remove());
    document.getElementById('exp-csv').addEventListener('click', () => { exportCSV(papers); modal.remove(); });
    document.getElementById('exp-bib').addEventListener('click', () => { exportBibTeX(papers); modal.remove(); });
    document.getElementById('exp-md').addEventListener('click',  () => { exportMarkdown(papers); modal.remove(); });
  }
})();

// ═══════════════════════════════════════════════════════════════
// ③ 论文关联推荐 — 基于 graph.json，在论文展开时显示相关论文
// ═══════════════════════════════════════════════════════════════
(function() {
  let graphData = null;

  async function loadGraph() {
    if (graphData) return graphData;
    try {
      const r = await fetch('graph.json?t=' + Date.now());
      if (!r.ok) return null;
      graphData = await r.json();
      return graphData;
    } catch(e) { return null; }
  }

  function getRelated(paperId, graph, limit = 3) {
    if (!graph?.edges) return [];
    const nodeMap = new Map((graph.nodes||[]).map(n => [n.id, n]));

    return graph.edges
      .filter(e => {
        if (e.type === 'author') return false; // 排除共同作者边，只保留语义相关
        return e.source === paperId || e.target === paperId;
      })
      .map(e => {
        const otherId = e.source === paperId ? e.target : e.source;
        const node = nodeMap.get(otherId);
        return node ? { node, type: e.type, weight: e.weight } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  }

  // 监听每篇论文的展开事件
  document.querySelectorAll('.paper-item').forEach(item => {
    const det = item.querySelector('details');
    if (!det) return;
    let loaded = false;

    det.addEventListener('toggle', async () => {
      if (!det.open || loaded) return;
      loaded = true;

      const paperId = item.dataset.id || '';
      if (!paperId) return;

      const graph = await loadGraph();
      if (!graph) return;

      const related = getRelated(paperId, graph);
      if (!related.length) return;

      const paperBody = item.querySelector('.paper-body');
      if (!paperBody) return;

      const relDiv = document.createElement('div');
      relDiv.className = 'related-papers';
      relDiv.innerHTML = `
        <div class="related-title"><i class="ri-links-line"></i> 相关论文</div>
        ${related.map(({ node, type, weight }) => `
          <a class="related-item" href="${node.id}" target="_blank" rel="noopener">
            <div class="related-item-title">${node.title}</div>
            <div class="related-item-meta">
              <span class="related-type ${type}">${type === 'historical' ? '历史关联' : '语义相似'}</span>
              <span class="related-score">${(weight * 100).toFixed(0)}%</span>
              ${node.confName ? `<span class="related-conf">${node.confName}</span>` : ''}
            </div>
          </a>`).join('')}`;

      // 插入到 paper-body 末尾
      paperBody.appendChild(relDiv);
    });
  });
})();

// ═══════════════════════════════════════════════════════════════
// ① 论文图表预览 — 读取 figures.json，在摘要上方显示首图
// ═══════════════════════════════════════════════════════════════
(function() {
  let figureData = null;

  async function loadFigures() {
    if (figureData) return figureData;
    try {
      const r = await fetch('figures.json?t=' + Date.now());
      if (!r.ok) return null;
      figureData = await r.json();
      return figureData;
    } catch(e) { return null; }
  }

  // 只在论文展开时懒加载图片
  document.querySelectorAll('.paper-item').forEach(item => {
    const det = item.querySelector('details');
    if (!det) return;
    let loaded = false;

    det.addEventListener('toggle', async () => {
      if (!det.open || loaded) return;
      loaded = true;

      const paperId = item.dataset.id || '';
      if (!paperId) return;

      const figures = await loadFigures();
      if (!figures) return;

      // figures.json key 用 arxiv ID（去掉版本号）
      const arxivId = paperId.replace(/.*abs\//, '').replace(/v\d+$/, '');
      const figUrl  = figures[arxivId] || figures[paperId];
      if (!figUrl) return;

      const paperBody = item.querySelector('.paper-body');
      const abstract  = paperBody?.querySelector('.paper-abstract');
      if (!abstract) return;

      const fig = document.createElement('div');
      fig.className = 'paper-figure';
      fig.innerHTML = `
        <img src="${figUrl}" alt="论文首图" loading="lazy"
             onerror="this.closest('.paper-figure').remove()"/>`;
      abstract.before(fig);
    });
  });
})();

// ═══════════════════════════════════════════════════════════════
// 访问统计 Dashboard — 读取 site_stats.json 展示 Umami 数据
// ═══════════════════════════════════════════════════════════════
(function() {
  let siteStats = null;
  let statsTabInited = false;

  // 在统计 Dashboard 里加"访问统计"Tab
  function injectVisitorTab() {
    const dash = document.getElementById('stats-dashboard');
    if (!dash) return;

    const inner = dash.querySelector('.stats-dashboard-inner');
    if (!inner) return;

    // 给现有内容加 Tab 结构
    const sdHeader = inner.querySelector('.sd-header');
    if (!sdHeader) return;

    // 如果已经注入过就跳过
    if (inner.querySelector('.sd-tabs')) return;

    // 创建 Tab 导航
    const tabNav = document.createElement('div');
    tabNav.className = 'sd-tabs';
    tabNav.innerHTML = `
      <button class="sd-tab active" data-tab="papers">
        <i class="ri-bar-chart-2-line"></i> 论文统计
      </button>
      <button class="sd-tab" data-tab="visitors">
        <i class="ri-global-line"></i> 访问统计
      </button>`;
    sdHeader.after(tabNav);

    // 把原有 KPI + 图表包裹进论文 Tab
    const kpiRow    = inner.querySelector('.sd-kpi-row');
    const sdCharts  = inner.querySelector('.sd-charts');
    const papersTab = document.createElement('div');
    papersTab.className = 'sd-tab-content';
    papersTab.dataset.tab = 'papers';
    if (kpiRow)   papersTab.appendChild(kpiRow);
    if (sdCharts) papersTab.appendChild(sdCharts);
    inner.appendChild(papersTab);

    // 创建访问统计 Tab 内容
    const visitorsTab = document.createElement('div');
    visitorsTab.className = 'sd-tab-content hidden';
    visitorsTab.dataset.tab = 'visitors';
    visitorsTab.innerHTML = `
      <div class="vs-kpi-row" id="vs-kpi-row">
        <div class="kpi-card"><div class="kpi-val" id="vs-pv">—</div><div class="kpi-label">页面浏览</div></div>
        <div class="kpi-card"><div class="kpi-val" id="vs-uv">—</div><div class="kpi-label">独立访客</div></div>
        <div class="kpi-card"><div class="kpi-val" id="vs-vis">—</div><div class="kpi-label">访问次数</div></div>
        <div class="kpi-card"><div class="kpi-val" id="vs-time">—</div><div class="kpi-label">平均停留</div></div>
      </div>
      <div class="vs-charts">
        <div class="chart-card chart-card--wide">
          <div class="chart-card-title">每日访问趋势（近90天）</div>
          <div class="chart-wrap"><canvas id="chart-daily-pv"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">访客国家分布</div>
          <div id="vs-countries" class="vs-countries"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">流量来源</div>
          <div id="vs-referrers" class="vs-referrers"></div>
        </div>
      </div>
      <div class="vs-footer">
        <span id="vs-generated">—</span>
        <span>· 数据来自 <a href="https://umami.is" target="_blank" rel="noopener">Umami</a></span>
      </div>`;
    inner.appendChild(visitorsTab);

    // Tab 切换逻辑
    tabNav.addEventListener('click', e => {
      const btn = e.target.closest('.sd-tab');
      if (!btn) return;
      const tab = btn.dataset.tab;
      tabNav.querySelectorAll('.sd-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      inner.querySelectorAll('.sd-tab-content').forEach(c => c.classList.toggle('hidden', c.dataset.tab !== tab));
      if (tab === 'visitors' && !statsTabInited) {
        statsTabInited = true;
        loadAndRenderStats();
      }
    });
  }

  async function loadAndRenderStats() {
    const container = document.getElementById('vs-kpi-row');
    if (container) {
      container.innerHTML = `<div class="vs-loading"><i class="ri-loader-4-line vs-spin"></i> 加载中…</div>`;
    }
    try {
      const r = await fetch('site_stats.json?t=' + Date.now());
      if (!r.ok) throw new Error('site_stats.json not found');
      siteStats = await r.json();
      renderStats(siteStats);
    } catch(e) {
      if (container) {
        container.innerHTML = `<div class="vs-empty">暂无访问数据<br><small>需配置 UMAMI_API_TOKEN 并等待 Actions 运行</small></div>`;
      }
    }
  }

  function fmt(n) {
    if (n >= 10000) return (n/10000).toFixed(1) + '万';
    if (n >= 1000)  return (n/1000).toFixed(1) + 'k';
    return String(n || 0);
  }

  function fmtTime(ms) {
    if (!ms) return '—';
    const s = Math.round(ms / 1000);
    if (s < 60)  return s + '秒';
    const m = Math.floor(s / 60), rs = s % 60;
    return `${m}分${rs}秒`;
  }

  function renderStats(data) {
    const s = data.summary || {};
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // KPI
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const kpiRow = document.getElementById('vs-kpi-row');
    if (kpiRow) {
      kpiRow.innerHTML = `
        <div class="kpi-card"><div class="kpi-val">${fmt(s.pageviews)}</div><div class="kpi-label">页面浏览</div></div>
        <div class="kpi-card"><div class="kpi-val">${fmt(s.visitors)}</div><div class="kpi-label">独立访客</div></div>
        <div class="kpi-card"><div class="kpi-val">${fmt(s.visits)}</div><div class="kpi-label">访问次数</div></div>
        <div class="kpi-card"><div class="kpi-val">${fmtTime(s.visits > 0 ? Math.round(s.totaltime / s.visits) : 0)}</div><div class="kpi-label">平均停留</div></div>`;
    }

    // 每日趋势图
    const dailyCtx = document.getElementById('chart-daily-pv');
    if (dailyCtx && data.daily?.length) {
      const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
      const tickColor = isDark ? '#52525b' : '#a1a1aa';
      const textColor = isDark ? '#a1a1aa' : '#52525b';
      const existing  = Chart.getChart('chart-daily-pv');
      if (existing) existing.destroy();
      // 只显示最近 30 天
      const recent = (data.daily || []).slice(-30);
      new Chart(dailyCtx, {
        type: 'line',
        data: {
          labels: recent.map(d => d.date.slice(5)),
          datasets: [
            { label: 'PV', data: recent.map(d => d.pageviews),
              borderColor: isDark ? '#60a5fa':'#1d4ed8',
              backgroundColor: isDark ? 'rgba(96,165,250,.1)':'rgba(29,78,216,.08)',
              fill: true, tension: 0.3, pointRadius: 2, borderWidth: 1.5 },
            { label: 'UV', data: recent.map(d => d.visitors),
              borderColor: isDark ? '#34d399':'#059669',
              backgroundColor: 'transparent',
              tension: 0.3, pointRadius: 2, borderWidth: 1.5, borderDash: [4,3] },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: textColor, boxWidth: 12, padding: 12 }}},
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor, maxRotation: 0, maxTicksLimit: 10 }},
            y: { grid: { color: gridColor }, ticks: { color: tickColor }},
          }
        }
      });
    }

    // 国家分布
    const countriesEl = document.getElementById('vs-countries');
    if (countriesEl && data.countries?.length) {
      const max = data.countries[0]?.visitors || 1;
      countriesEl.innerHTML = data.countries.slice(0, 12).map(c => `
        <div class="vs-bar-row">
          <span class="vs-bar-label">${c.name || c.country}</span>
          <div class="vs-bar-track">
            <div class="vs-bar-fill" style="width:${(c.visitors/max*100).toFixed(1)}%"></div>
          </div>
          <span class="vs-bar-val">${fmt(c.visitors)}</span>
        </div>`).join('');
    }

    // 来源
    const refEl = document.getElementById('vs-referrers');
    if (refEl && data.referrers?.length) {
      const maxR = data.referrers[0]?.count || 1;
      refEl.innerHTML = data.referrers.slice(0, 8).map(r => `
        <div class="vs-bar-row">
          <span class="vs-bar-label">${r.name || '直接访问'}</span>
          <div class="vs-bar-track">
            <div class="vs-bar-fill vs-bar-fill--green" style="width:${(r.count/maxR*100).toFixed(1)}%"></div>
          </div>
          <span class="vs-bar-val">${fmt(r.count)}</span>
        </div>`).join('');
    }

    // 生成时间
    const genEl = document.getElementById('vs-generated');
    if (genEl && data.generated) {
      genEl.textContent = `数据更新于 ${data.generated.slice(0,10)}，统计近 ${data.range_days || 90} 天`;
    }
  }

  // 在 stats dashboard 打开时注入 Tab
  const statsBtn = document.getElementById('stats-btn');
  const origStatsClick = statsBtn?.onclick;
  statsBtn?.addEventListener('click', () => {
    // 等 DOM 更新后注入
    setTimeout(injectVisitorTab, 50);
  });

  // 主题切换时重渲染图表
  document.querySelector('.theme-switch input')?.addEventListener('change', () => {
    if (statsTabInited && siteStats) {
      setTimeout(() => renderStats(siteStats), 60);
    }
  });
})();

// ═══════════════════════════════════════════════════════════════
// 个性化推荐 — 基于收藏夹 × graph.json embedding 向量
// ═══════════════════════════════════════════════════════════════
(function() {

  // ── 向量工具 ────────────────────────────────────────────────
  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na  += a[i] * a[i];
      nb  += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
  }

  function avgVector(vecs) {
    if (!vecs.length) return null;
    const dim = vecs[0].length;
    const avg = new Float32Array(dim);
    for (const v of vecs) for (let i = 0; i < dim; i++) avg[i] += v[i];
    const norm = Math.sqrt(avg.reduce((s,x) => s + x*x, 0)) || 1;
    return Array.from(avg).map(x => x / norm);
  }

  // ── 数据加载 ────────────────────────────────────────────────
  let graphCache = null;
  async function loadGraph() {
    if (graphCache) return graphCache;
    try {
      const r = await fetch('graph.json?t=' + Date.now());
      if (!r.ok) return null;
      graphCache = await r.json();
      return graphCache;
    } catch(e) { return null; }
  }

  // embeddings.json 单独存储，但 graph.json 里的节点没有 vec 字段
  // 需要从 data/embeddings.json 读取（gh-pages 不部署 data/，改用专用端点）
  // 实际上 embeddings 已经很大，改为：直接用 graph.json 的边做协同过滤
  // 具体：找收藏论文的相邻节点（similar/historical 边），按出现频率排序

  function getRecommendations(bookmarkedIds, graph, limit = 10) {
    if (!graph?.edges || !graph?.nodes) return [];

    const bmSet   = new Set(bookmarkedIds);
    const nodeMap = new Map((graph.nodes||[]).map(n => [n.id, n]));
    const score   = new Map(); // id → score

    // 遍历所有边，找和收藏论文相连的节点
    for (const e of graph.edges) {
      if (e.type === 'author') continue; // 只用语义边
      const isBmSrc = bmSet.has(e.source);
      const isBmTgt = bmSet.has(e.target);
      if (!isBmSrc && !isBmTgt) continue;

      const otherId = isBmSrc ? e.target : e.source;
      if (bmSet.has(otherId)) continue; // 已收藏的不推荐

      const weight = e.weight || 0.5;
      score.set(otherId, (score.get(otherId) || 0) + weight);
    }

    // 按得分排序
    return [...score.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, sc]) => ({ node: nodeMap.get(id), score: sc }))
      .filter(r => r.node);
  }

  // ── UI ──────────────────────────────────────────────────────
  function buildRecoPanel() {
    const existing = document.getElementById('reco-panel');
    if (existing) { existing.classList.toggle('hidden'); return; }

    const panel = document.createElement('aside');
    panel.id = 'reco-panel';
    panel.className = 'reco-panel';
    panel.innerHTML = `
      <div class="reco-header">
        <span class="reco-title"><i class="ri-magic-line"></i> 为你推荐</span>
        <button class="reco-close" id="reco-close"><i class="ri-close-line"></i></button>
      </div>
      <div class="reco-body" id="reco-body">
        <div class="reco-loading"><i class="ri-loader-4-line reco-spin"></i> 分析收藏中…</div>
      </div>
      <div class="reco-footer">基于你的 <span id="reco-bm-count">0</span> 篇收藏 · 语义相似推荐</div>`;

    document.body.appendChild(panel);
    document.getElementById('reco-close')?.addEventListener('click', () => {
      panel.classList.add('hidden');
      document.getElementById('reco-btn')?.classList.remove('active');
    });

    loadAndRender(panel);
  }

  async function loadAndRender(panel) {
    const body = document.getElementById('reco-body');

    // 读取收藏夹
    let bookmarks = {};
    try { bookmarks = JSON.parse(localStorage.getItem('arxiv-bm') || '{}'); } catch(e) {}
    const bmIds = Object.keys(bookmarks);

    const countEl = document.getElementById('reco-bm-count');
    if (countEl) countEl.textContent = bmIds.length;

    if (!bmIds.length) {
      body.innerHTML = `<div class="reco-empty">
        <i class="ri-bookmark-line" style="font-size:2rem;display:block;margin-bottom:8px"></i>
        收藏几篇感兴趣的论文<br>即可获得个性化推荐
      </div>`;
      return;
    }

    const graph = await loadGraph();
    if (!graph) {
      body.innerHTML = `<div class="reco-empty">图谱数据加载失败</div>`;
      return;
    }

    const recs = getRecommendations(bmIds, graph, 12);

    if (!recs.length) {
      body.innerHTML = `<div class="reco-empty">
        暂无推荐<br>
        <small>图谱数据积累后将自动推荐</small>
      </div>`;
      return;
    }

    body.innerHTML = recs.map(({ node, score }) => {
      const conf  = node.confName ? `<span class="reco-conf">${node.confName}</span>` : '';
      const tags  = (node.tags||[]).slice(0,2).map(t =>
        `<span class="reco-tag">${t}</span>`).join('');
      const pct   = Math.min(100, Math.round(score * 80 + 20)); // 视觉化分数
      const arxiv = node.id || '#';
      return `
        <div class="reco-item" data-id="${node.id}">
          <div class="reco-item-score-bar" style="width:${pct}%"></div>
          <div class="reco-item-content">
            <div class="reco-item-title">${node.title}</div>
            <div class="reco-item-meta">
              ${conf}${tags}
              <span class="reco-item-subject">${node.subject||''}</span>
            </div>
            <div class="reco-item-actions">
              <a class="reco-action" href="${arxiv}" target="_blank" rel="noopener">
                <i class="ri-external-link-line"></i> arXiv
              </a>
              <button class="reco-action reco-bm-btn" data-id="${node.id}" data-title="${(node.title||'').replace(/"/g,'&quot;')}" data-authors="${(node.authors||'').replace(/"/g,'&quot;')}">
                <i class="ri-bookmark-line"></i> 收藏
              </button>
            </div>
          </div>
        </div>`;
    }).join('');

    // 收藏按钮事件
    body.querySelectorAll('.reco-bm-btn').forEach(btn => {
      const id = btn.dataset.id;
      // 检查是否已收藏
      let bm = {};
      try { bm = JSON.parse(localStorage.getItem('arxiv-bm')||'{}'); } catch(e) {}
      if (bm[id]) { btn.innerHTML = '<i class="ri-bookmark-fill"></i> 已收藏'; btn.classList.add('bookmarked'); }

      btn.addEventListener('click', e => {
        e.preventDefault();
        let bms = {};
        try { bms = JSON.parse(localStorage.getItem('arxiv-bm')||'{}'); } catch(e) {}
        if (bms[id]) {
          delete bms[id];
          btn.innerHTML = '<i class="ri-bookmark-line"></i> 收藏';
          btn.classList.remove('bookmarked');
        } else {
          bms[id] = { title: btn.dataset.title, authors: btn.dataset.authors, url: id, note: '' };
          btn.innerHTML = '<i class="ri-bookmark-fill"></i> 已收藏';
          btn.classList.add('bookmarked');
        }
        localStorage.setItem('arxiv-bm', JSON.stringify(bms));
        // 同步主页收藏数
        const badge = document.getElementById('bookmark-count');
        const n = Object.keys(bms).length;
        if (badge) { badge.textContent = n; badge.classList.toggle('hidden', n===0); }
      });
    });
  }

  // ── 注入推荐按钮到 header-actions ────────────────────────
  function injectRecoBtn() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.getElementById('reco-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'reco-btn';
    btn.className = 'hbtn';
    btn.title = '个性化推荐';
    btn.innerHTML = '<i class="ri-magic-line"></i>';
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      buildRecoPanel();
    });
    // 插到 nav-btn 前面
    const navBtn = document.getElementById('nav-btn');
    if (navBtn) actions.insertBefore(btn, navBtn);
    else actions.prepend(btn);
  }

  injectRecoBtn();

  // 收藏操作后实时刷新推荐（如果推荐面板已打开）
  document.addEventListener('click', e => {
    const bmBtn = e.target.closest('.bookmark-btn');
    if (!bmBtn) return;
    const panel = document.getElementById('reco-panel');
    if (panel && !panel.classList.contains('hidden')) {
      // 延迟刷新，等收藏状态更新
      setTimeout(() => loadAndRender(panel), 100);
    }
  });

})();

// ═══════════════════════════════════════════════════════════════
// 领域热度趋势 — 在统计 Dashboard 加"热度趋势" Tab
// ═══════════════════════════════════════════════════════════════
(function() {
  let trendInited = false;

  // ── 从 DOM 数据计算趋势 ─────────────────────────────────────
  // DATA 已有 { date, subjects: { name: { count, featured } } }
  function buildTrendData() {
    // 收集所有领域名
    const subjSet = new Set();
    DATA.forEach(d => Object.keys(d.subjects).forEach(s => subjSet.add(s)));
    const subjects = [...subjSet];

    // 只保留总量 top 8 的领域（避免图太乱）
    const totalBySubj = {};
    subjects.forEach(s => {
      totalBySubj[s] = DATA.reduce((sum, d) => sum + (d.subjects[s]?.count || 0), 0);
    });
    const topSubjects = subjects
      .sort((a, b) => totalBySubj[b] - totalBySubj[a])
      .slice(0, 8);

    // 日期序列（倒序 → 正序）
    const dates = [...DATA].reverse().map(d => d.date.slice(5));

    // 每个领域按日期的数据
    const datasets = topSubjects.map((subj, i) => {
      const palette = [
        '#60a5fa','#34d399','#a78bfa','#f87171',
        '#fbbf24','#38bdf8','#fb923c','#e879f9'
      ];
      const paletteDark = palette;
      const paletteLight = [
        '#1d4ed8','#059669','#7c3aed','#dc2626',
        '#d97706','#0284c7','#ea580c','#c026d3'
      ];
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const color  = isDark ? paletteDark[i] : paletteLight[i];
      const data   = [...DATA].reverse().map(d => d.subjects[subj]?.count || 0);
      return { label: subj.length > 18 ? subj.slice(0,17)+'…' : subj,
               data, borderColor: color, backgroundColor: color + '18',
               tension: 0.35, pointRadius: 2, borderWidth: 1.8, fill: false };
    });

    return { dates, datasets, topSubjects, totalBySubj };
  }

  // ── 计算各领域环比增长率（最近7天 vs 前7天）──────────────────
  function buildGrowthData() {
    if (DATA.length < 2) return [];
    const recent = DATA.slice(0, Math.min(7, DATA.length));
    const prev   = DATA.slice(Math.min(7, DATA.length), Math.min(14, DATA.length));
    if (!prev.length) return [];

    const subjSet = new Set();
    DATA.forEach(d => Object.keys(d.subjects).forEach(s => subjSet.add(s)));

    return [...subjSet].map(s => {
      const r = recent.reduce((sum, d) => sum + (d.subjects[s]?.count || 0), 0);
      const p = prev.reduce((sum, d) => sum + (d.subjects[s]?.count || 0), 0);
      const growth = p > 0 ? ((r - p) / p * 100) : (r > 0 ? 100 : 0);
      return { subject: s, recent: r, prev: p, growth: Math.round(growth) };
    })
    .filter(x => x.recent > 0 || x.prev > 0)
    .sort((a, b) => b.growth - a.growth);
  }

  // ── 注入热度趋势 Tab ─────────────────────────────────────────
  function injectTrendTab() {
    const inner = document.querySelector('.stats-dashboard-inner');
    if (!inner) return;

    const tabs = inner.querySelector('.sd-tabs');
    if (!tabs) return;

    // 如果已有趋势 Tab 就跳过
    if (tabs.querySelector('[data-tab="trend"]')) return;

    // 在论文统计 / 访问统计 后面加趋势 Tab
    const trendTabBtn = document.createElement('button');
    trendTabBtn.className = 'sd-tab';
    trendTabBtn.dataset.tab = 'trend';
    trendTabBtn.innerHTML = '<i class="ri-line-chart-line"></i> 热度趋势';
    tabs.appendChild(trendTabBtn);

    // 创建趋势 Tab 内容
    const trendContent = document.createElement('div');
    trendContent.className = 'sd-tab-content hidden';
    trendContent.dataset.tab = 'trend';
    trendContent.innerHTML = `
      <div class="trend-top">
        <div class="chart-card chart-card--wide">
          <div class="chart-card-title">各领域论文数量趋势</div>
          <div class="chart-wrap" style="height:220px"><canvas id="chart-trend-line"></canvas></div>
        </div>
      </div>
      <div class="trend-bottom">
        <div class="chart-card">
          <div class="chart-card-title">近7天 vs 上周 增长率</div>
          <div id="trend-growth" class="trend-growth"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">子方向标签热度</div>
          <div id="trend-tags" class="trend-tags"></div>
        </div>
      </div>`;
    inner.appendChild(trendContent);

    // Tab 切换联动
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('.sd-tab');
      if (!btn || btn.dataset.tab !== 'trend') return;
      if (!trendInited) {
        trendInited = true;
        renderTrend();
      }
    });

    // 主题切换时重渲染
    document.querySelector('.theme-switch input')?.addEventListener('change', () => {
      if (trendInited) setTimeout(renderTrend, 60);
    });
  }

  function renderTrend() {
    const isDark     = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor  = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
    const tickColor  = isDark ? '#52525b' : '#a1a1aa';
    const textColor  = isDark ? '#a1a1aa' : '#52525b';

    const { dates, datasets } = buildTrendData();

    // ── 折线趋势图 ─────────────────────────────────────────
    const trendCtx = document.getElementById('chart-trend-line');
    if (trendCtx) {
      const existing = Chart.getChart('chart-trend-line');
      if (existing) existing.destroy();
      new Chart(trendCtx, {
        type: 'line',
        data: { labels: dates, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: textColor, boxWidth: 10, padding: 10, font: { size: 10 } }
            },
            tooltip: { callbacks: {
              title: items => items[0].label,
              label: item => ` ${item.dataset.label}: ${item.raw} 篇`
            }}
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor, maxRotation: 0, maxTicksLimit: 10 }},
            y: { grid: { color: gridColor }, ticks: { color: tickColor },
                 title: { display: true, text: '论文数', color: tickColor, font: { size: 10 } }}
          }
        }
      });
    }

    // ── 增长率排行 ────────────────────────────────────────
    const growthEl = document.getElementById('trend-growth');
    if (growthEl) {
      const growthData = buildGrowthData();
      if (!growthData.length) {
        growthEl.innerHTML = '<div style="font-size:.8rem;color:var(--c-text3);padding:20px;text-align:center">数据不足（需要至少14天数据）</div>';
      } else {
        const maxAbs = Math.max(...growthData.map(x => Math.abs(x.growth)), 1);
        growthEl.innerHTML = growthData.slice(0, 10).map(x => {
          const pct    = Math.min(100, (Math.abs(x.growth) / maxAbs) * 100);
          const isUp   = x.growth >= 0;
          const color  = isUp
            ? (isDark ? '#34d399' : '#059669')
            : (isDark ? '#f87171' : '#dc2626');
          const arrow  = isUp ? '↑' : '↓';
          const label  = x.subject.length > 16 ? x.subject.slice(0,15)+'…' : x.subject;
          return `
            <div class="growth-row">
              <span class="growth-label">${label}</span>
              <div class="growth-bar-track">
                <div class="growth-bar-fill" style="width:${pct}%;background:${color}20;"></div>
              </div>
              <span class="growth-val" style="color:${color}">${arrow}${Math.abs(x.growth)}%</span>
              <span class="growth-sub">${x.recent}篇</span>
            </div>`;
        }).join('');
      }
    }

    // ── 子方向标签热度（基于 TAG_RULES 关键词匹配的论文数）────
    const tagsEl = document.getElementById('trend-tags');
    if (tagsEl && typeof TAG_RULES !== 'undefined') {
      // 统计每个 tag 近7天命中的论文数
      const tagCounts7 = {};
      const tagCountsAll = {};
      TAG_RULES.forEach(r => { tagCounts7[r.tag] = 0; tagCountsAll[r.tag] = 0; });

      const recent7Papers = new Set();
      DATA.slice(0, 7).forEach(d => {
        document.querySelectorAll('.paper-item').forEach(item => {
          const date = item.closest('.day-section')?.querySelector('.day-date time')
            ?.getAttribute('datetime')?.slice(0,10);
          if (date !== d.date) return;
          (item.dataset.tags || '').split(',').filter(Boolean).forEach(t => {
            if (t in tagCounts7) tagCounts7[t]++;
          });
        });
      });
      document.querySelectorAll('.paper-item').forEach(item => {
        (item.dataset.tags || '').split(',').filter(Boolean).forEach(t => {
          if (t in tagCountsAll) tagCountsAll[t]++;
        });
      });

      // 用已有的 tagCounts（从 DOM 收集）做展示
      const allTagData = TAG_RULES
        .map(r => ({ tag: r.tag, count: tagCountsAll[r.tag] || 0 }))
        .filter(x => x.count > 0)
        .sort((a, b) => b.count - a.count);

      if (!allTagData.length) {
        tagsEl.innerHTML = '<div style="font-size:.8rem;color:var(--c-text3);padding:20px;text-align:center">暂无标签数据</div>';
      } else {
        const maxC = allTagData[0].count;
        tagsEl.innerHTML = allTagData.map((x, i) => {
          const pct = (x.count / maxC * 100).toFixed(1);
          const colors = isDark
            ? ['#60a5fa','#34d399','#a78bfa','#f87171','#fbbf24','#38bdf8','#fb923c','#e879f9','#86efac','#fda4af','#c4b5fd','#6ee7b7','#fca5a5','#fde68a']
            : ['#1d4ed8','#059669','#7c3aed','#dc2626','#d97706','#0284c7','#ea580c','#c026d3','#16a34a','#e11d48','#4f46e5','#0d9488','#b91c1c','#92400e'];
          const color = colors[i % colors.length];
          return `
            <div class="tag-heat-row">
              <span class="tag-heat-label">${x.tag}</span>
              <div class="tag-heat-track">
                <div class="tag-heat-fill" style="width:${pct}%;background:${color}"></div>
              </div>
              <span class="tag-heat-val">${x.count}</span>
            </div>`;
        }).join('');
      }
    }
  }

  // stats btn 打开时注入趋势 Tab
  document.getElementById('stats-btn')?.addEventListener('click', () => {
    setTimeout(injectTrendTab, 80);
  });

})();

// ═══════════════════════════════════════════════════════════════
// 作者/关键词订阅 — localStorage 持久化，页面加载时自动匹配高亮
// ═══════════════════════════════════════════════════════════════
(function() {

  const SUB_KEY = 'arxiv-subscriptions';

  // ── 数据结构 ─────────────────────────────────────────────────
  // { authors: ["Yann LeCun", ...], keywords: ["diffusion policy", ...] }
  function loadSubs() {
    try { return JSON.parse(localStorage.getItem(SUB_KEY) || '{"authors":[],"keywords":[]}'); }
    catch(e) { return { authors: [], keywords: [] }; }
  }
  function saveSubs(subs) { localStorage.setItem(SUB_KEY, JSON.stringify(subs)); }

  // ── 匹配逻辑 ────────────────────────────────────────────────
  function matchPaper(item, subs) {
    const text    = (item.dataset.search || '').toLowerCase();
    const authors = (item.dataset.authors || '').toLowerCase();
    const title   = (item.dataset.title   || '').toLowerCase();

    const matchedAuthors  = subs.authors.filter(a => authors.includes(a.toLowerCase()));
    const matchedKeywords = subs.keywords.filter(k => title.includes(k.toLowerCase()) || text.includes(k.toLowerCase()));
    return { matchedAuthors, matchedKeywords,
             matched: matchedAuthors.length > 0 || matchedKeywords.length > 0 };
  }

  // ── 应用订阅高亮 ─────────────────────────────────────────────
  function applySubscriptions() {
    const subs = loadSubs();
    const hasAny = subs.authors.length > 0 || subs.keywords.length > 0;
    let hitCount = 0;

    document.querySelectorAll('.paper-item').forEach(item => {
      item.classList.remove('sub-match');
      const existing = item.querySelector('.sub-badge');
      if (existing) existing.remove();

      if (!hasAny) return;
      const { matched, matchedAuthors, matchedKeywords } = matchPaper(item, subs);
      if (!matched) return;

      hitCount++;
      item.classList.add('sub-match');

      // 在论文标题前插入订阅命中标记
      const titleWrap = item.querySelector('.paper-title-wrap');
      if (titleWrap) {
        const badge = document.createElement('span');
        badge.className = 'sub-badge';
        const tips = [...matchedAuthors, ...matchedKeywords].slice(0, 2).join(', ');
        badge.title = `订阅命中：${tips}`;
        badge.innerHTML = '<i class="ri-notification-2-fill"></i>';
        titleWrap.prepend(badge);
      }
    });

    // 更新 summary bar 提示
    const sbRead = document.getElementById('sb-read');
    let subHint  = document.getElementById('sb-sub-hint');
    if (hasAny) {
      if (!subHint) {
        subHint = document.createElement('span');
        subHint.id = 'sb-sub-hint';
        subHint.className = 'sb-stat sb-sub-hint';
        const sep = document.createElement('span');
        sep.className = 'sb-sep'; sep.textContent = '·';
        sbRead?.after(sep); sbRead?.after(subHint);
      }
      subHint.innerHTML = `<i class="ri-notification-2-fill"></i> 订阅命中 ${hitCount} 篇`;
      subHint.style.color = hitCount > 0 ? 'var(--c-accent)' : 'var(--c-text3)';
      subHint.style.cursor = 'pointer';
      subHint.onclick = () => {
        // 点击后滚动到第一篇命中的论文
        const first = document.querySelector('.paper-item.sub-match');
        if (first) {
          first.closest('.subject-block')?.querySelector('details')?.setAttribute('open','');
          first.scrollIntoView({ behavior:'smooth', block:'center' });
        }
      };
    } else if (subHint) {
      subHint.remove();
    }
  }

  // ── 订阅管理面板 ─────────────────────────────────────────────
  function buildSubPanel() {
    const existing = document.getElementById('sub-panel');
    if (existing) {
      existing.classList.toggle('hidden');
      document.getElementById('sub-btn')?.classList.toggle('active', !existing.classList.contains('hidden'));
      return;
    }

    const panel = document.createElement('aside');
    panel.id = 'sub-panel';
    panel.className = 'sub-panel';
    panel.innerHTML = `
      <div class="sub-header">
        <span class="sub-title"><i class="ri-notification-2-line"></i> 订阅关注</span>
        <button class="sub-close" id="sub-close"><i class="ri-close-line"></i></button>
      </div>
      <div class="sub-body">
        <!-- 作者订阅 -->
        <div class="sub-section">
          <div class="sub-section-label">
            <i class="ri-user-follow-line"></i> 关注作者
            <span class="sub-hint">论文作者列表中包含时提醒</span>
          </div>
          <div class="sub-input-row">
            <input type="text" id="sub-author-input" class="sub-input"
                   placeholder="输入作者姓名，如 Yann LeCun" autocomplete="off"/>
            <button class="sub-add-btn" id="sub-author-add">
              <i class="ri-add-line"></i>
            </button>
          </div>
          <div class="sub-tags" id="sub-author-tags"></div>
        </div>

        <!-- 关键词订阅 -->
        <div class="sub-section">
          <div class="sub-section-label">
            <i class="ri-key-2-line"></i> 关注关键词
            <span class="sub-hint">出现在标题或摘要中时提醒</span>
          </div>
          <div class="sub-input-row">
            <input type="text" id="sub-kw-input" class="sub-input"
                   placeholder="输入关键词，如 diffusion policy" autocomplete="off"/>
            <button class="sub-add-btn" id="sub-kw-add">
              <i class="ri-add-line"></i>
            </button>
          </div>
          <div class="sub-tags" id="sub-kw-tags"></div>
        </div>

        <!-- 快速添加推荐 -->
        <div class="sub-section">
          <div class="sub-section-label">
            <i class="ri-lightbulb-line"></i> 快速添加
          </div>
          <div class="sub-quick" id="sub-quick-authors">
            <div class="sub-quick-label">来自 config 的顶级作者</div>
            <div class="sub-quick-chips" id="sub-quick-author-chips"></div>
          </div>
          <div class="sub-quick" id="sub-quick-keywords">
            <div class="sub-quick-label">常用关键词</div>
            <div class="sub-quick-chips" id="sub-quick-kw-chips"></div>
          </div>
        </div>
      </div>
      <div class="sub-footer">
        <span id="sub-stats">—</span>
        <button class="sub-clear-btn" id="sub-clear">
          <i class="ri-delete-bin-line"></i> 清空全部
        </button>
      </div>`;

    document.body.appendChild(panel);
    renderSubPanel();

    // 快速添加：从 config.rhai 高亮作者中取前10个
    // （通过页面已高亮的作者反推）
    const highlightedAuthors = [...new Set(
      [...document.querySelectorAll('.highlight-author')]
        .map(el => el.textContent.trim())
        .filter(a => a.length > 3)
    )].slice(0, 10);
    const quickAuthorChips = document.getElementById('sub-quick-author-chips');
    if (quickAuthorChips) {
      highlightedAuthors.forEach(a => {
        const chip = makeQuickChip(a, 'author');
        quickAuthorChips.appendChild(chip);
      });
      if (!highlightedAuthors.length) {
        quickAuthorChips.innerHTML = '<span style="font-size:.72rem;color:var(--c-text3)">（暂无数据）</span>';
      }
    }

    // 快速关键词推荐
    const quickKws = ['VLA','Humanoid','Gaussian Avatar','Diffusion','NeRF','Manipulation','Navigation','Sim-to-Real','Transformer','SMPL','Digital Human'];
    const quickKwChips = document.getElementById('sub-quick-kw-chips');
    if (quickKwChips) {
      quickKws.forEach(k => {
        const chip = makeQuickChip(k, 'keyword');
        quickKwChips.appendChild(chip);
      });
    }

    // 事件绑定
    document.getElementById('sub-close')?.addEventListener('click', () => {
      panel.classList.add('hidden');
      document.getElementById('sub-btn')?.classList.remove('active');
    });

    document.getElementById('sub-clear')?.addEventListener('click', () => {
      if (!confirm('确定清空所有订阅？')) return;
      saveSubs({ authors: [], keywords: [] });
      renderSubPanel();
      applySubscriptions();
    });

    setupInput('sub-author-input', 'sub-author-add', 'author');
    setupInput('sub-kw-input',     'sub-kw-add',     'keyword');
  }

  function makeQuickChip(text, type) {
    const chip = document.createElement('button');
    chip.className = 'sub-quick-chip';
    chip.textContent = text;
    chip.addEventListener('click', () => {
      addSub(text, type);
      chip.classList.add('added');
      chip.disabled = true;
    });
    // 如果已订阅，初始化为已添加状态
    const subs = loadSubs();
    const list = type === 'author' ? subs.authors : subs.keywords;
    if (list.some(x => x.toLowerCase() === text.toLowerCase())) {
      chip.classList.add('added'); chip.disabled = true;
    }
    return chip;
  }

  function setupInput(inputId, btnId, type) {
    const input = document.getElementById(inputId);
    const btn   = document.getElementById(btnId);
    const add   = () => {
      const val = input?.value.trim();
      if (!val) return;
      addSub(val, type);
      input.value = '';
      input.focus();
    };
    btn?.addEventListener('click', add);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  }

  function addSub(val, type) {
    const subs = loadSubs();
    const list = type === 'author' ? subs.authors : subs.keywords;
    if (!list.some(x => x.toLowerCase() === val.toLowerCase())) {
      list.push(val);
      saveSubs(subs);
    }
    renderSubPanel();
    applySubscriptions();
  }

  function removeSub(val, type) {
    const subs = loadSubs();
    if (type === 'author')  subs.authors  = subs.authors.filter(x => x !== val);
    else                    subs.keywords = subs.keywords.filter(x => x !== val);
    saveSubs(subs);
    renderSubPanel();
    applySubscriptions();
  }

  function renderSubPanel() {
    const subs = loadSubs();

    const renderTags = (containerId, items, type) => {
      const el = document.getElementById(containerId);
      if (!el) return;
      if (!items.length) {
        el.innerHTML = `<span class="sub-empty-hint">暂无${type==='author'?'关注作者':'关注关键词'}</span>`;
        return;
      }
      el.innerHTML = items.map(item => `
        <span class="sub-tag">
          ${item}
          <button class="sub-tag-del" data-val="${item.replace(/"/g,'&quot;')}" data-type="${type}">×</button>
        </span>`).join('');
      el.querySelectorAll('.sub-tag-del').forEach(btn => {
        btn.addEventListener('click', () => removeSub(btn.dataset.val, btn.dataset.type));
      });
    };

    renderTags('sub-author-tags', subs.authors,  'author');
    renderTags('sub-kw-tags',     subs.keywords, 'keyword');

    const total = subs.authors.length + subs.keywords.length;
    const statsEl = document.getElementById('sub-stats');
    if (statsEl) statsEl.textContent = `${subs.authors.length} 位作者 · ${subs.keywords.length} 个关键词`;

    // 同步快速添加按钮状态
    document.querySelectorAll('.sub-quick-chip').forEach(chip => {
      const text = chip.textContent;
      const type = chip.closest('#sub-quick-author-chips') ? 'author' : 'keyword';
      const list = type === 'author' ? subs.authors : subs.keywords;
      const added = list.some(x => x.toLowerCase() === text.toLowerCase());
      chip.classList.toggle('added', added);
      chip.disabled = added;
    });

    // 更新 header 按钮角标
    const badge = document.getElementById('sub-badge');
    if (badge) {
      badge.textContent = total;
      badge.classList.toggle('hidden', total === 0);
    }
  }

  // ── 注入订阅按钮到 header ──────────────────────────────────
  function injectSubBtn() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.getElementById('sub-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'sub-btn';
    btn.className = 'hbtn';
    btn.title = '订阅关注';
    btn.style.position = 'relative';
    btn.innerHTML = `
      <i class="ri-notification-2-line"></i>
      <span id="sub-badge" class="badge hidden">0</span>`;

    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      buildSubPanel();
    });

    // 插到推荐按钮后面
    const recoBtn = document.getElementById('reco-btn');
    if (recoBtn) recoBtn.after(btn);
    else {
      const navBtn = document.getElementById('nav-btn');
      if (navBtn) actions.insertBefore(btn, navBtn);
      else actions.prepend(btn);
    }

    // 初始化角标
    const subs  = loadSubs();
    const total = subs.authors.length + subs.keywords.length;
    const badge = document.getElementById('sub-badge');
    if (badge) { badge.textContent = total; badge.classList.toggle('hidden', total === 0); }
  }

  // ── 初始化 ───────────────────────────────────────────────────
  injectSubBtn();
  applySubscriptions();

  // 过滤器变更后重新应用订阅高亮
  const origFilter = window.filterPapers;
  window.filterPapers = function() {
    origFilter?.();
    setTimeout(applySubscriptions, 10);
  };

})();

// ═══════════════════════════════════════════════════════════════
// 引用链追踪 — 读取 citations.json，在论文展开时显示引用关系
// ═══════════════════════════════════════════════════════════════
(function() {
  let citationData = null;

  async function loadCitations() {
    if (citationData) return citationData;
    try {
      const r = await fetch('citations.json?t=' + Date.now());
      if (!r.ok) return null;
      citationData = await r.json();
      return citationData;
    } catch(e) { return null; }
  }

  function arxivUrl(arxivId) {
    if (!arxivId) return null;
    return `https://arxiv.org/abs/${arxivId}`;
  }

  function renderCitationSection(title, icon, items, emptyMsg) {
    if (!items || !items.length) {
      return `<div class="cite-section">
        <div class="cite-section-title"><i class="${icon}"></i> ${title}</div>
        <div class="cite-empty">${emptyMsg}</div>
      </div>`;
    }
    const itemsHtml = items.map(item => {
      const url     = item.arxivId ? arxivUrl(item.arxivId) : null;
      const yearStr = item.year ? `<span class="cite-year">${item.year}</span>` : '';
      const inner   = `
        <div class="cite-item-title">${item.title || '(no title)'}</div>
        <div class="cite-item-meta">
          ${yearStr}
          <span class="cite-item-authors">${item.authors || ''}</span>
          ${item.arxivId ? `<span class="cite-arxiv-badge">arXiv</span>` : ''}
        </div>`;
      return url
        ? `<a class="cite-item" href="${url}" target="_blank" rel="noopener">${inner}</a>`
        : `<div class="cite-item cite-item--nolink">${inner}</div>`;
    }).join('');

    return `<div class="cite-section">
      <div class="cite-section-title"><i class="${icon}"></i> ${title} <span class="cite-count">${items.length}</span></div>
      <div class="cite-list">${itemsHtml}</div>
    </div>`;
  }

  // 每篇论文展开时注入引用面板
  document.querySelectorAll('.paper-item').forEach(item => {
    const det = item.querySelector('details');
    if (!det) return;
    let loaded = false;

    det.addEventListener('toggle', async () => {
      if (!det.open || loaded) return;
      loaded = true;

      const rawId   = item.dataset.id || '';
      const arxivId = rawId.replace(/.*abs\//, '').replace(/v\d+$/, '');
      if (!arxivId) return;

      const citations = await loadCitations();
      if (!citations) return;

      const data = citations[arxivId];
      const paperBody = item.querySelector('.paper-body');
      if (!paperBody) return;

      // 在 paper-body 末尾注入引用面板
      const panel = document.createElement('div');
      panel.className = 'citations-panel';

      if (!data) {
        // 数据还未抓取
        panel.innerHTML = `
          <div class="cite-section-title">
            <i class="ri-git-branch-line"></i> 引用关系
            <span class="cite-pending">数据抓取中，请等待下次更新</span>
          </div>`;
      } else {
        // 被引次数徽章
        const citedBadge = data.citationCount > 0
          ? `<span class="cite-total-badge" title="Semantic Scholar 总被引次数">
               <i class="ri-bar-chart-box-line"></i> 被引 ${data.citationCount} 次
             </span>`
          : '';

        panel.innerHTML = `
          <div class="citations-header">
            <span class="citations-title">
              <i class="ri-git-branch-line"></i> 引用关系
            </span>
            ${citedBadge}
          </div>
          ${renderCitationSection(
            '引用的论文', 'ri-arrow-right-up-line',
            data.references,
            '暂无引用数据（论文可能尚未被 Semantic Scholar 收录）'
          )}
          ${renderCitationSection(
            '被引用', 'ri-arrow-left-down-line',
            data.citations,
            '暂无被引数据'
          )}`;
      }

      // 如果已有 related-papers，插在它前面；否则直接 append
      const relatedPapers = paperBody.querySelector('.related-papers');
      if (relatedPapers) paperBody.insertBefore(panel, relatedPapers);
      else paperBody.appendChild(panel);
    });
  });

  // 在论文操作栏加被引次数角标（citations.json 加载后异步更新）
  async function injectCitationBadges() {
    const citations = await loadCitations();
    if (!citations) return;

    document.querySelectorAll('.paper-item').forEach(item => {
      const rawId   = item.dataset.id || '';
      const arxivId = rawId.replace(/.*abs\//, '').replace(/v\d+$/, '');
      if (!arxivId) return;

      const data = citations[arxivId];
      if (!data || !data.citationCount) return;

      // 在论文标题行右侧加被引次数小角标
      const titleWrap = item.querySelector('.paper-title-wrap');
      if (titleWrap && !titleWrap.querySelector('.cite-inline-badge')) {
        const badge = document.createElement('span');
        badge.className = 'cite-inline-badge';
        badge.title = `Semantic Scholar 被引 ${data.citationCount} 次`;
        badge.textContent = `★${data.citationCount}`;
        // 插在 chevron 前
        const chevron = item.querySelector('.paper-chevron');
        if (chevron) chevron.before(badge);
      }
    });
  }

  // 延迟加载，不阻塞页面渲染
  setTimeout(injectCitationBadges, 1500);

})();
