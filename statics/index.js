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

// ─── AI Summary ────────────────────────
document.querySelectorAll('.ai-summary-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const paperBody = btn.closest('.paper-body');
    const abstract = paperBody?.querySelector('.paper-abstract')?.textContent?.trim() || '';
    const title = btn.dataset.title || '';
    const existing = paperBody?.querySelector('.ai-panel');
    if (existing) { existing.classList.toggle('hidden'); return; }
    const prompt = `请对以下学术论文进行简洁的中文解读：\n\n**论文标题：** ${title}\n\n**摘要原文：**\n${abstract}\n\n请用以下格式回答：\n**一句话总结：** [用一句话说明这篇论文做了什么]\n**核心方法：** [2-3句话描述核心方法]\n**主要结论：** [1-2句话总结实验结论]`;
    window.open('https://claude.ai/new?q=' + encodeURIComponent(prompt), '_blank', 'noopener');
    const aiPanel = document.createElement('div');
    aiPanel.className = 'ai-panel';
    aiPanel.innerHTML = `<div class="ai-panel-hd"><i class="ri-sparkling-2-line"></i> AI 中文解读</div>
      <div style="font-size:.82rem;color:var(--c-text2);line-height:1.7">
        已在新标签页打开 Claude，论文摘要已自动填入。<br>
        <span style="color:var(--c-text3);font-size:.78rem">提示：在仓库中配置 GitHub Actions 可自动预生成所有摘要。</span>
      </div>`;
    btn.closest('.paper-actions').after(aiPanel);
  });
});
