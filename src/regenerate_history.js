/**
 * 历史页面重构脚本
 * 功能：读取所有 daily_*.md 文件，使用新的模板引擎重新生成 HTML
 * 如果发现缺少 .md 文件但存在对应的 .json 文件，会自动调用 AI 生成 MD
 * 
 * 使用方法：node src/regenerate_history.js
 */

const fs = require('fs');
const path = require('path');

const config = require('./config');
const markdownParser = require('./markdownParser');
const dataProcessor = require('./dataProcessor');
const summarize = require('./summarize');

/**
 * 读取模板文件
 */
function readTemplateFile(fileName) {
  const templatePath = path.join(config.directories.templates, fileName);
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error('读取模板文件失败:', templatePath, error.message);
    return '';
  }
}

/**
 * 生成单个 HTML 页面
 * @param {string} markdownFilePath - Markdown 文件路径
 * @param {string} dateStr - 日期字符串 YYYY-MM-DD
 * @returns {string} 生成的 HTML 内容
 */
function generateSingleHTML(markdownFilePath, dateStr) {
  // 读取模板
  const baseTemplate = readTemplateFile('base.html');
  const styles = readTemplateFile('style.css');
  const scripts = readTemplateFile('script.js');

  if (!baseTemplate) {
    throw new Error('无法读取基础模板文件');
  }

  // 读取并解析 Markdown
  const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');
  const htmlContent = markdownParser.convertMarkdownToHTML(markdownContent);

  // 加载项目摘要
  dataProcessor.loadProjectSummaries(markdownContent);

  // 处理日期显示
  const date = new Date(dateStr);
  const dateCN = date.toLocaleDateString('zh-CN', config.page.dateFormat);

  // 获取历史日期数据
  const allAvailableDates = dataProcessor.getAllAvailableDates();
  const recentDates = dataProcessor.getRecentDates();

  // 生成侧边栏 HTML
  const historyDatesHTML = dataProcessor.generateHistoryDatesHTML(recentDates);
  const dateSelectorHTML = dataProcessor.generateDateSelectorHTML(allAvailableDates);

  // 生成排行榜数据
  dataProcessor.generateRankingData();

  // 替换模板占位符
  let resultHTML = baseTemplate;
  resultHTML = resultHTML.replace('{{TITLE}}', `${config.page.titlePrefix} - ${dateCN}`);
  resultHTML = resultHTML.replace('{{DATE_CN}}', dateCN);
  resultHTML = resultHTML.replace('{{RANKING_DATA_PATH}}', config.frontend.rankingDataPath);
  resultHTML = resultHTML.replace('{{STYLES}}', styles);
  resultHTML = resultHTML.replace('{{SCRIPTS}}', scripts);
  resultHTML = resultHTML.replace('{{SIDEBAR_HISTORY_TITLE}}', config.sidebar.historyTitle);
  resultHTML = resultHTML.replace('{{SIDEBAR_RANKING_TITLE}}', config.sidebar.rankingTitle);
  resultHTML = resultHTML.replace('{{TIME_RANGE_LABEL}}', config.sidebar.timeRangeLabel);
  resultHTML = resultHTML.replace('{{RANKING_SECTION_TITLE}}', config.sidebar.rankingTitle);
  resultHTML = resultHTML.replace('{{HISTORY_DATES_HTML}}', historyDatesHTML + '\n\n' + dateSelectorHTML);
  resultHTML = resultHTML.replace('{{CONTENT}}', htmlContent);

  return resultHTML;
}

/**
 * 获取今天的日期字符串
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取所有需要处理的日期
 * 扫描 data/ 目录下的所有 JSON 文件
 */
function getAllDatesToProcess() {
  const dataDir = config.directories.data;
  const reportsDir = config.directories.reports;

  const dates = new Set();

  if (fs.existsSync(dataDir)) {
    const jsonFiles = fs.readdirSync(dataDir).filter(file =>
      file.startsWith('trending_') && file.endsWith('.json')
    );

    for (const file of jsonFiles) {
      const match = file.match(/trending_(\d{4}-\d{2}-\d{2})\.json/);
      if (match) {
        dates.add(match[1]);
      }
    }
  }

  if (fs.existsSync(reportsDir)) {
    const mdFiles = fs.readdirSync(reportsDir).filter(file =>
      file.startsWith('daily_') && file.endsWith('.md')
    );

    for (const file of mdFiles) {
      const match = file.match(/daily_(\d{4}-\d{2}-\d{2})\.md/);
      if (match) {
        dates.add(match[1]);
      }
    }
  }

  return Array.from(dates).sort();
}

/**
 * 为主函数
 */
async function main() {
  console.log('='.repeat(50));
  console.log('   历史页面重构脚本');
  console.log('='.repeat(50));
  console.log();

  const reportsDir = config.directories.reports;
  const dataDir = config.directories.data;

  if (!fs.existsSync(reportsDir)) {
    console.error('错误: reports 目录不存在!');
    process.exit(1);
  }

  const allDates = getAllDatesToProcess();

  if (allDates.length === 0) {
    console.error('错误: 未找到任何数据文件!');
    process.exit(1);
  }

  console.log(`找到 ${allDates.length} 个日期需要处理`);
  console.log();

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const dateStr of allDates) {
    const mdFilePath = path.join(reportsDir, `daily_${dateStr}.md`);
    const jsonFilePath = path.join(dataDir, `trending_${dateStr}.json`);
    const htmlFilePath = path.join(reportsDir, `daily_${dateStr}.html`);

    try {
      console.log(`[处理] ${dateStr} ...`);

      if (!fs.existsSync(mdFilePath)) {
        if (fs.existsSync(jsonFilePath)) {
          console.log(`  - 缺少 MD 文件，正在调用 AI 生成...`);
          const markdown = await summarize.generateMarkdownFromJSON(jsonFilePath);
          summarize.saveMarkdown(markdown, `daily_${dateStr}.md`);
          console.log(`  ✓ MD 文件已生成`);
        } else {
          console.log(`  - 跳过: 无 MD 也无 JSON 文件`);
          skipCount++;
          continue;
        }
      }

      const htmlContent = generateSingleHTML(mdFilePath, dateStr);
      fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
      console.log(`  ✓ 已生成: daily_${dateStr}.html`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ 失败: ${dateStr} - ${error.message}`);
      failCount++;
    }
  }

  console.log();
  console.log('='.repeat(50));
  console.log(`完成! 成功: ${successCount}, 跳过: ${skipCount}, 失败: ${failCount}`);
  console.log('='.repeat(50));
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { generateSingleHTML };
