/**
 * GitHub Trending 简报前端交互脚本
 * 包含所有前端交互逻辑：Tooltip、排行榜切换、日期选择等
 */

// Tooltip 偏移量配置
const TOOLTIP_OFFSET_X = 15;
const TOOLTIP_OFFSET_Y = 15;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  // 为项目卡片添加点击效果
  const cards = document.querySelectorAll('.project-card');
  cards.forEach(card => {
    card.addEventListener('click', function(e) {
      if (e.target.tagName === 'A') {
        return;
      }
      this.style.transform = 'scale(0.98)';
      setTimeout(() => {
        this.style.transform = '';
      }, 150);
    });
  });

  // 初始化排行榜显示（默认显示近一周）
  if (typeof updateRanking === 'function') {
    updateRanking('week');
  }
});

/**
 * 显示悬浮提示框 - 跟随鼠标位置
 * @param {string} content - 提示内容
 * @param {Event} event - 鼠标事件对象
 */
function showTooltip(content, event) {
  const tooltip = document.getElementById('globalTooltip');
  const tooltipContent = document.getElementById('tooltipContent');
  tooltipContent.textContent = content;
  tooltip.style.display = 'block';

  // 跟随鼠标定位
  const x = event.clientX + TOOLTIP_OFFSET_X;
  const y = event.clientY + TOOLTIP_OFFSET_Y;

  // 获取视口尺寸，防止提示框超出边界
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const tooltipRect = tooltip.getBoundingClientRect();

  // 如果右侧空间不足，显示在左侧
  let finalX = x;
  if (x + tooltipRect.width > viewportWidth) {
    finalX = event.clientX - tooltipRect.width - TOOLTIP_OFFSET_X;
  }

  // 如果底部空间不足，显示在上方
  let finalY = y;
  if (y + tooltipRect.height > viewportHeight) {
    finalY = event.clientY - tooltipRect.height - TOOLTIP_OFFSET_Y;
  }

  tooltip.style.left = Math.max(8, finalX) + 'px';
  tooltip.style.top = Math.max(8, finalY) + 'px';
  tooltip.style.transform = 'none';
}

/**
 * 隐藏悬浮提示框
 */
function hideTooltip() {
  const tooltip = document.getElementById('globalTooltip');
  tooltip.style.display = 'none';
}

/**
 * 更新排行榜显示
 * @param {string} timeRange - 时间范围：'week'、'month'、'quarter'
 */
function updateRanking(timeRange) {
  var rankingList = document.getElementById('rankingList');

  function showEmptyState(message) {
    var emptyItem = document.createElement('li');
    emptyItem.className = 'ranking-empty';
    emptyItem.textContent = message;
    rankingList.replaceChildren(emptyItem);
  }

  if (typeof rankingData === 'undefined') {
    showEmptyState('数据加载中...');
    return;
  }

  var rankings = rankingData[timeRange] || [];

  if (rankings.length === 0) {
    showEmptyState('暂无数据');
    return;
  }

  rankingList.replaceChildren();

  rankings.forEach(function(item) {
    var description = item.chineseDesc || item.description || '暂无描述';
    var count = item.count || 0;
    var stars = item.stars || '0';

    var tooltipContent = '📦 ' + item.name + '\n\n' +
                         '📝 ' + description + '\n\n' +
                         '⭐ ' + stars + ' | 📅 ' + count + ' 次';

    var listItem = document.createElement('li');
    listItem.addEventListener('mouseenter', function(event) {
      showTooltip(tooltipContent, event);
    });
    listItem.addEventListener('mouseleave', hideTooltip);

    var rankingItem = document.createElement('div');
    rankingItem.className = 'ranking-item';

    var rankingInfo = document.createElement('div');
    rankingInfo.className = 'ranking-info';

    var nameLink = document.createElement('a');
    nameLink.className = 'ranking-name';
    nameLink.textContent = item.name || '未知项目';
    nameLink.target = '_blank';
    nameLink.rel = 'noopener noreferrer';
    nameLink.href = /^https?:\/\//i.test(item.url || '') ? item.url : '#';

    var meta = document.createElement('div');
    meta.className = 'ranking-meta';

    var starsElement = document.createElement('span');
    starsElement.className = 'ranking-stars';
    starsElement.textContent = '⭐ ' + stars;

    var countElement = document.createElement('span');
    countElement.className = 'ranking-count';
    countElement.textContent = '上榜 ' + count + ' 次';

    var descriptionElement = document.createElement('div');
    descriptionElement.className = 'ranking-desc';
    descriptionElement.textContent = description;

    meta.append(starsElement, ' ', countElement);
    rankingInfo.append(nameLink, meta, descriptionElement);
    rankingItem.appendChild(rankingInfo);
    listItem.appendChild(rankingItem);
    rankingList.appendChild(listItem);
  });
}

/**
 * 更新月份选择下拉框
 * 修复：保留已选择的月份，重新选择时正确更新
 */
function updateMonthOptions() {
  var yearSelect = document.getElementById('yearSelect');
  var monthSelect = document.getElementById('monthSelect');
  var daySelect = document.getElementById('daySelect');
  var availableDatesContainer = document.getElementById('availableDatesData');

  if (!availableDatesContainer) {
    console.error('找不到可用日期容器');
    return;
  }

  var availableDates = JSON.parse(availableDatesContainer.textContent);
  var selectedYear = yearSelect.value;
  var previouslySelectedMonth = monthSelect.value;

  monthSelect.innerHTML = '<option value="">月</option>';
  daySelect.innerHTML = '<option value="">日</option>';

  if (!selectedYear) {
    return;
  }

  var months = [...new Set(
    availableDates
      .filter(function(d) { return d.startsWith(selectedYear); })
      .map(function(d) { return d.substring(5, 7); })
  )].sort().reverse();

  for (var i = 0; i < months.length; i++) {
    var month = months[i];
    var monthNum = parseInt(month, 10);
    var selected = (month === previouslySelectedMonth) ? ' selected' : '';
    monthSelect.innerHTML += '<option value="' + month + '"' + selected + '>' + monthNum + '</option>';
  }

  if (previouslySelectedMonth && months.includes(previouslySelectedMonth)) {
    updateDayOptions();
  }
}

/**
 * 更新日期选择下拉框
 * 修复：保留已选择的日期，正确处理状态
 */
function updateDayOptions() {
  var yearSelect = document.getElementById('yearSelect');
  var monthSelect = document.getElementById('monthSelect');
  var daySelect = document.getElementById('daySelect');
  var availableDatesContainer = document.getElementById('availableDatesData');

  if (!availableDatesContainer) {
    return;
  }

  var availableDates = JSON.parse(availableDatesContainer.textContent);
  var selectedYear = yearSelect.value;
  var selectedMonth = monthSelect.value;
  var previouslySelectedDay = daySelect.value;

  daySelect.innerHTML = '<option value="">日</option>';

  if (!selectedYear || !selectedMonth) {
    return;
  }

  var days = availableDates
    .filter(function(d) { return d.startsWith(selectedYear + '-' + selectedMonth); })
    .sort().reverse();

  for (var i = 0; i < days.length; i++) {
    var day = days[i];
    var dayNum = parseInt(day.substring(8, 10), 10);
    var selected = (day === previouslySelectedDay) ? ' selected' : '';
    daySelect.innerHTML += '<option value="' + day + '"' + selected + '>' + dayNum + '</option>';
  }
}

/**
 * 跳转到历史报告页面
 */
function goToHistoryReport() {
  var daySelect = document.getElementById('daySelect');
  var selectedDate = daySelect.value;

  if (selectedDate) {
    var reportBasePath = document.body.dataset.reportBasePath || '';
    window.location.href = reportBasePath + 'daily_' + selectedDate + '.html';
  } else {
    alert('请先选择完整的日期！');
  }
}
