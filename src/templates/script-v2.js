const state = {
  range: 'week',
  libraryTab: 'favorites',
  library: { favorites: {}, later: {} }
};

const LIBRARY_STORAGE_KEY = 'github-radar-library-v1';

document.addEventListener('DOMContentLoaded', function() {
  initializeTheme();
  initializeProjectCards();
  initializeAppearanceTags();
  initializeLibrary();
  initializeRandomHistory();
  initializeRankingTabs();
  updateRanking(state.range);
});

function initializeTheme() {
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('github-radar-theme');
  const preferredTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.dataset.theme = savedTheme || preferredTheme;
  themeToggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));

  themeToggle.addEventListener('click', function() {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('github-radar-theme', root.dataset.theme);
    themeToggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  });
}

function initializeAppearanceTags() {
  const reportDate = document.body.dataset.reportDate;
  const appearances = typeof rankingData === 'undefined' ? {} : (rankingData.appearances || {});
  document.querySelectorAll('.project-card').forEach(function(card) {
    const projectDates = appearances[card.dataset.projectName];
    if (!Array.isArray(projectDates) || !reportDate) return;
    const dates = projectDates.filter(function(date) { return date <= reportDate; }).sort().reverse();
    if (!dates.includes(reportDate)) return;

    let label = '再次上榜';
    if (dates.length === 1) {
      label = '今日新上榜';
    } else {
      let streak = 1;
      for (let index = 1; index < dates.length; index++) {
        const later = Date.parse(`${dates[index - 1]}T00:00:00Z`);
        const earlier = Date.parse(`${dates[index]}T00:00:00Z`);
        if (Math.round((later - earlier) / 86400000) !== 1) break;
        streak += 1;
      }
      if (streak > 1) label = `连续出现 ${streak} 天`;
    }

    const tag = card.querySelector('.appearance-tag');
    if (tag) {
      tag.textContent = label;
      tag.hidden = false;
    }
  });
}

function initializeLibrary() {
  state.library = readLibrary();
  document.querySelectorAll('.project-card').forEach(function(card) {
    bindLibraryAction(card, 'favorites', '.favorite-action');
  });

  const overlay = document.getElementById('libraryOverlay');
  const openButton = document.getElementById('libraryOpen');
  const closeButton = document.getElementById('libraryClose');
  if (!overlay || !openButton || !closeButton) return;

  openButton.addEventListener('click', openLibrary);
  closeButton.addEventListener('click', closeLibrary);
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) closeLibrary();
  });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && !overlay.hidden) closeLibrary();
  });
  document.querySelectorAll('[data-library-tab]').forEach(function(button) {
    button.addEventListener('click', function() {
      state.libraryTab = button.dataset.libraryTab;
      renderLibrary();
    });
  });
  document.getElementById('libraryExport').addEventListener('click', exportLibrary);
  refreshLibraryUI();
}

function readLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY));
    return {
      favorites: saved && saved.favorites && typeof saved.favorites === 'object' ? saved.favorites : {},
      later: saved && saved.later && typeof saved.later === 'object' ? saved.later : {}
    };
  } catch (error) {
    return { favorites: {}, later: {} };
  }
}

function bindLibraryAction(card, collection, selector) {
  const button = card.querySelector(selector);
  if (!button) return;
  button.addEventListener('click', function() {
    const key = projectKey(card);
    if (state.library[collection][key]) delete state.library[collection][key];
    else state.library[collection][key] = projectRecord(card);
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(state.library));
    refreshLibraryUI();
  });
}

function projectKey(card) {
  return card.dataset.projectUrl && card.dataset.projectUrl !== '#' ? card.dataset.projectUrl : card.dataset.projectName;
}

function projectRecord(card) {
  return {
    name: card.dataset.projectName || '未知项目',
    url: card.dataset.projectUrl || '#',
    summary: card.dataset.projectSummary || '',
    stars: card.dataset.projectStars || '0',
    language: card.dataset.language || 'Other',
    date: document.body.dataset.reportDate || '',
    savedAt: new Date().toISOString()
  };
}

function refreshLibraryUI() {
  document.querySelectorAll('.project-card').forEach(function(card) {
    const key = projectKey(card);
    setActionState(card.querySelector('.favorite-action'), Boolean(state.library.favorites[key]));
    setActionState(card.querySelector('.later-action'), Boolean(state.library.later[key]));
  });
  document.getElementById('libraryCount').textContent = Object.keys(state.library.favorites).length;
  document.getElementById('favoriteTabCount').textContent = Object.keys(state.library.favorites).length;
  renderLibrary();
}

function setActionState(button, isActive) {
  if (!button) return;
  button.classList.toggle('active', isActive);
  button.setAttribute('aria-pressed', String(isActive));
}

function openLibrary() {
  document.getElementById('libraryOverlay').hidden = false;
  document.body.classList.add('drawer-open');
  renderLibrary();
  document.getElementById('libraryClose').focus();
}

function closeLibrary() {
  document.getElementById('libraryOverlay').hidden = true;
  document.body.classList.remove('drawer-open');
  document.getElementById('libraryOpen').focus();
}

function renderLibrary() {
  const list = document.getElementById('libraryList');
  if (!list) return;
  document.querySelectorAll('[data-library-tab]').forEach(function(button) {
    button.setAttribute('aria-selected', String(button.dataset.libraryTab === state.libraryTab));
  });
  list.replaceChildren();
  const entries = Object.entries(state.library[state.libraryTab]).sort(function(a, b) {
    return (b[1].savedAt || '').localeCompare(a[1].savedAt || '');
  });
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'library-empty';
    const icon = document.createElement('span');
    icon.textContent = '♡';
    const title = document.createElement('strong');
    title.textContent = '这里还没有项目';
    const note = document.createElement('p');
    note.textContent = '在日报卡片上点一下图标，就会收进来。';
    empty.append(icon, title, note);
    list.appendChild(empty);
    return;
  }
  entries.forEach(function([key, item]) {
    const article = document.createElement('article');
    article.className = 'library-item';
    const link = document.createElement('a');
    link.href = /^https?:\/\//i.test(item.url || '') ? item.url : '#';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = item.name || '未知项目';
    const summary = document.createElement('p');
    summary.textContent = item.summary || '暂无摘要';
    const meta = document.createElement('span');
    meta.textContent = `${item.language || 'Other'} · ★ ${item.stars || '0'}${item.date ? ` · ${item.date}` : ''}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '移除';
    remove.addEventListener('click', function() {
      delete state.library[state.libraryTab][key];
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(state.library));
      refreshLibraryUI();
    });
    article.append(link, summary, meta, remove);
    list.appendChild(article);
  });
}

function exportLibrary() {
  const items = Object.values(state.library[state.libraryTab]);
  if (items.length === 0) return;
  const title = state.libraryTab === 'favorites' ? 'GitHub Radar 收藏' : 'GitHub Radar 稍后看';
  const lines = [`# ${title}`, ''];
  items.forEach(function(item) {
    lines.push(`## [${item.name}](${item.url})`, '', item.summary || '', '', `- ${item.language || 'Other'} · ★ ${item.stars || '0'}${item.date ? ` · 收录于 ${item.date}` : ''}`, '');
  });
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `github-radar-${state.libraryTab}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function initializeProjectCards() {
  const cards = document.querySelectorAll('.project-card');
  cards.forEach(function(card, index) {
    card.style.setProperty('--card-index', index);
    const toggle = card.querySelector('.detail-toggle');
    const details = card.querySelector('.project-details');
    if (!toggle || !details) return;

    toggle.addEventListener('click', function() {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isExpanded));
      toggle.setAttribute('aria-label', `${isExpanded ? '展开' : '收起'} ${card.dataset.projectName || '项目'} 的项目解读`);
      details.hidden = isExpanded;
    });
  });
}

function initializeRankingTabs() {
  document.querySelectorAll('[data-range]').forEach(function(button) {
    button.addEventListener('click', function() {
      state.range = button.dataset.range;
      document.querySelectorAll('[data-range]').forEach(function(item) {
        const isActive = item === button;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      updateRanking(state.range);
    });
  });
}

function updateRanking(timeRange) {
  const rankingList = document.getElementById('rankingList');
  const rankings = typeof rankingData === 'undefined' ? [] : (rankingData[timeRange] || []);
  rankingList.replaceChildren();

  if (rankings.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'ranking-empty';
    emptyItem.textContent = '暂无排行数据';
    rankingList.appendChild(emptyItem);
    return;
  }

  rankings.forEach(function(item) {
    const listItem = document.createElement('li');
    const project = document.createElement('div');
    project.className = 'ranking-project';
    const nameLink = document.createElement('a');
    nameLink.className = 'ranking-name';
    nameLink.textContent = item.name || '未知项目';
    nameLink.href = /^https?:\/\//i.test(item.url || '') ? item.url : '#';
    nameLink.target = '_blank';
    nameLink.rel = 'noopener noreferrer';

    const description = document.createElement('p');
    description.className = 'ranking-desc';
    description.textContent = (item.chineseDesc || item.description || '暂无简介').replace(/^📝\s*/, '');

    const count = document.createElement('span');
    count.className = 'ranking-count';
    count.textContent = `${item.count || 0} 次`;
    project.append(nameLink, description);
    listItem.append(project, count);
    rankingList.appendChild(listItem);
  });
}

function getAvailableDates() {
  const container = document.getElementById('availableDatesData');
  if (!container) return [];
  try {
    return JSON.parse(container.textContent);
  } catch (error) {
    return [];
  }
}

function initializeRandomHistory() {
  const button = document.getElementById('randomHistoryButton');
  const dateLabel = document.getElementById('randomHistoryDate');
  if (!button || !dateLabel) return;

  button.addEventListener('click', function() {
    const currentDate = document.body.dataset.reportDate;
    const lastDate = sessionStorage.getItem('github-radar-last-random-date');
    let dates = getAvailableDates().filter(function(date) {
      return date !== currentDate && date !== lastDate;
    });
    if (dates.length === 0) dates = getAvailableDates().filter(date => date !== currentDate);
    if (dates.length === 0) return;

    const targetDate = dates[Math.floor(Math.random() * dates.length)];
    const navigate = function() {
      sessionStorage.setItem('github-radar-last-random-date', targetDate);
      const reportBasePath = document.body.dataset.reportBasePath || '';
      window.location.href = `${reportBasePath}daily_${targetDate}.html`;
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate();
      return;
    }

    button.disabled = true;
    button.classList.add('is-shuffling');
    let ticks = 0;
    const timer = window.setInterval(function() {
      dateLabel.textContent = dates[Math.floor(Math.random() * dates.length)];
      ticks += 1;
      if (ticks < 6) return;
      window.clearInterval(timer);
      dateLabel.textContent = targetDate;
      window.setTimeout(navigate, 180);
    }, 65);
  });
}

function updateMonthOptions() {
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const daySelect = document.getElementById('daySelect');
  const previousMonth = monthSelect.value;
  const months = [...new Set(getAvailableDates()
    .filter(date => date.startsWith(yearSelect.value))
    .map(date => date.substring(5, 7)))].sort().reverse();

  monthSelect.replaceChildren(new Option('月', ''));
  daySelect.replaceChildren(new Option('日', ''));
  months.forEach(month => monthSelect.add(new Option(String(Number(month)), month)));
  if (months.includes(previousMonth)) {
    monthSelect.value = previousMonth;
    updateDayOptions();
  }
}

function updateDayOptions() {
  const year = document.getElementById('yearSelect').value;
  const month = document.getElementById('monthSelect').value;
  const daySelect = document.getElementById('daySelect');
  daySelect.replaceChildren(new Option('日', ''));
  getAvailableDates()
    .filter(date => date.startsWith(`${year}-${month}`))
    .sort().reverse()
    .forEach(date => daySelect.add(new Option(String(Number(date.substring(8, 10))), date)));
}

function goToHistoryReport() {
  const selectedDate = document.getElementById('daySelect').value;
  if (!selectedDate) return;
  const reportBasePath = document.body.dataset.reportBasePath || '';
  window.location.href = `${reportBasePath}daily_${selectedDate}.html`;
}
