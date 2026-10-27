/**
 * 历史文件清理脚本
 * 仅保留最近指定自然日内的 Trending 数据、Markdown 和 HTML 报告
 */

const fs = require('fs');
const path = require('path');

const config = require('./config');

const fileGroups = [
  {
    directory: config.directories.data,
    pattern: /^trending_(\d{4}-\d{2}-\d{2})\.json$/
  },
  {
    directory: config.directories.reports,
    pattern: /^daily_(\d{4}-\d{2}-\d{2})\.(?:md|html)$/
  }
];

/**
 * 将 YYYY-MM-DD 转换为 UTC 日期，避免运行环境时区影响保留边界
 */
function parseDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * 查找仓库中最新的历史文件日期
 */
function findLatestDate() {
  let latestDate = null;

  for (const group of fileGroups) {
    if (!fs.existsSync(group.directory)) {
      continue;
    }

    for (const fileName of fs.readdirSync(group.directory)) {
      const match = fileName.match(group.pattern);
      if (!match) {
        continue;
      }

      const fileDate = parseDate(match[1]);
      if (!latestDate || fileDate > latestDate) {
        latestDate = fileDate;
      }
    }
  }

  return latestDate;
}

/**
 * 清理保留窗口以前的历史文件
 */
function cleanupHistory() {
  const retentionDays = config.history.retentionDays;
  const latestDate = findLatestDate();

  if (!latestDate) {
    console.log('未找到可清理的历史文件');
    return { removedFiles: 0, removedBytes: 0 };
  }

  const cutoffDate = new Date(latestDate);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - retentionDays + 1);

  let removedFiles = 0;
  let removedBytes = 0;

  for (const group of fileGroups) {
    if (!fs.existsSync(group.directory)) {
      continue;
    }

    for (const fileName of fs.readdirSync(group.directory)) {
      const match = fileName.match(group.pattern);
      if (!match || parseDate(match[1]) >= cutoffDate) {
        continue;
      }

      const filePath = path.join(group.directory, fileName);
      const fileSize = fs.statSync(filePath).size;
      fs.unlinkSync(filePath);
      removedFiles++;
      removedBytes += fileSize;
    }
  }

  console.log(`历史文件保留范围: ${cutoffDate.toISOString().slice(0, 10)} 至 ${latestDate.toISOString().slice(0, 10)}`);
  console.log(`已删除 ${removedFiles} 个历史文件，释放 ${(removedBytes / 1024 / 1024).toFixed(2)} MB`);

  return { removedFiles, removedBytes };
}

if (require.main === module) {
  try {
    cleanupHistory();
  } catch (error) {
    console.error('清理历史文件失败:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { cleanupHistory, findLatestDate, parseDate };
