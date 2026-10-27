const state = {
  search: '',
  language: 'all',
  range: 'week'
};

document.addEventListener('DOMContentLoaded', function() {
  initializeTheme();
  initializeProjectCards();
  initializeFilters();
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
      toggle.querySelector('span:first-child').textContent = isExpanded ? '查看编辑解读' : '收起编辑解读';
      details.hidden = isExpanded;
    });
  });
}

function initializeFilters() {
  const searchInput = document.getElementById('projectSearch');
  const languageFilter = document.getElementById('languageFilter');
  const cards = Array.from(document.querySelectorAll('.project-card'));
  const languages = [...new Set(cards.map(card => card.dataset.language).filter(Boolean))].sort();

  languages.forEach(function(language) {
    const option = document.createElement('option');
    option.value = language;
    option.textContent = language;
    languageFilter.appendChild(option);
  });

  searchInput.addEventListener('input', function() {
    state.search = searchInput.value.trim().toLowerCase();
    applyProjectFilters();
  });

  languageFilter.addEventListener('change', function() {
    state.language = languageFilter.value;
    applyProjectFilters();
  });

  applyProjectFilters();
}

function applyProjectFilters() {
  const cards = Array.from(document.querySelectorAll('.project-card'));
  let visibleCount = 0;

  cards.forEach(function(card) {
    const matchesSearch = !state.search || card.textContent.toLowerCase().includes(state.search);
    const matchesLanguage = state.language === 'all' || card.dataset.language === state.language;
    const visible = matchesSearch && matchesLanguage;
    card.classList.toggle('is-hidden', !visible);
    if (visible) visibleCount++;
  });

  document.getElementById('resultCount').textContent = `${visibleCount} / ${cards.length}`;
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
    const nameLink = document.createElement('a');
    nameLink.className = 'ranking-name';
    nameLink.textContent = item.name || '未知项目';
    nameLink.href = /^https?:\/\//i.test(item.url || '') ? item.url : '#';
    nameLink.target = '_blank';
    nameLink.rel = 'noopener noreferrer';

    const count = document.createElement('span');
    count.className = 'ranking-count';
    count.textContent = `${item.count || 0} 次`;
    listItem.append(nameLink, count);
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
