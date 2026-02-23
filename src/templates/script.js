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
  const x = event.pageX + TOOLTIP_OFFSET_X;
  const y = event.pageY + TOOLTIP_OFFSET_Y;

  // 获取视口尺寸，防止提示框超出边界
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const tooltipRect = tooltip.getBoundingClientRect();

  // 如果右侧空间不足，显示在左侧
  let finalX = x;
  if (x + tooltipRect.width > viewportWidth) {
    finalX = event.pageX - tooltipRect.width - TOOLTIP_OFFSET_X;
  }

  // 如果底部空间不足，显示在上方
  let finalY = y;
  if (y + tooltipRect.height > viewportHeight) {
    finalY = event.pageY - tooltipRect.height - TOOLTIP_OFFSET_Y;
  }

  tooltip.style.left = finalX + 'px';
  tooltip.style.top = finalY + 'px';
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

  if (typeof rankingData === 'undefined') {
    rankingList.innerHTML = '<li style="color: #6a8a6a; text-align: center;">数据加载中...</li>';
    return;
  }

  var rankings = rankingData[timeRange] || [];

  if (rankings.length === 0) {
    rankingList.innerHTML = '<li style="color: #6a8a6a; text-align: center;">暂无数据</li>';
    return;
  }

  let html = '';

  rankings.forEach(function(item, index) {
    var description = item.description || '暂无描述';
    var escapedDesc = description.replace(/'/g, '\\\'').replace(/"/g, '\\"');

    var count = item.count || 0;
    var stars = item.stars || '0';

    var tooltipContent = '📦 ' + item.name + '\n\n' +
                         '📝 ' + description + '\n\n' +
                         '⭐ ' + stars + ' | 📅 ' + count + ' 次';

    var escapedTooltipContent = tooltipContent.replace(/'/g, '\\\'').replace(/"/g, '\\"');

    html += '<li onmouseenter="showTooltip(\'' + escapedTooltipContent + '\', event)" onmouseleave="hideTooltip()">';
    html += '<div class="ranking-item">';
    html += '<div class="ranking-info">';
    html += '<a class="ranking-name" href="' + item.url + '" target="_blank">' + item.name + '</a>';
    html += '<div class="ranking-meta"><span class="ranking-stars">⭐ ' + stars + '</span> <span class="ranking-count">上榜 ' + count + ' 次</span></div>';
    html += '<div class="ranking-desc">' + description + '</div>';
    html += '</div>';
    html += '</div>';
    html += '</li>';
  });

  rankingList.innerHTML = html;
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
    window.location.href = 'daily_' + selectedDate + '.html';
  } else {
    alert('请先选择完整的日期！');
  }
}
