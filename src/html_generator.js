/**
 * HTML 生成器 - 主入口文件
 * 负责调度各个模块，读取外部的前端模板文件并完成字符串替换和写入
 * 
 * 功能流程：
 * 1. 读取配置和模板文件
 * 2. 查找并读取 Markdown 源文件
 * 3. 解析 Markdown 为 HTML
 * 4. 生成排行榜数据
 * 5. 组装完整的 HTML 页面
 * 6. 写入输出文件
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 引入配置文件
const config = require('./config');

// 引入数据处理模块
const dataProcessor = require('./dataProcessor');

// 引入 Markdown 解析模块
const markdownParser = require('./markdownParser');

/**
 * 读取模板文件内容
 * @param {string} fileName - 模板文件名
 * @returns {string} 文件内容
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
 * 生成完整的 HTML 页面
 * 将模板与数据结合，生成最终的 HTML 文件
 * @param {string} htmlContent - 解析后的 Markdown HTML 内容
 * @param {string} dateStr - 日期字符串，格式：YYYY-MM-DD
 * @returns {string} 完整的 HTML 页面内容
 */
function generateHTMLTemplate(htmlContent, dateStr) {
  // ===== 1. 读取前端模板文件 =====
  const baseTemplate = readTemplateFile('base.html');
  const styles = readTemplateFile('style.css');
  const scripts = readTemplateFile('script.js');

  if (!baseTemplate) {
    throw new Error('无法读取基础模板文件');
  }

  // ===== 2. 处理日期显示 =====
  const date = new Date(dateStr);
  const dateCN = date.toLocaleDateString('zh-CN', config.page.dateFormat);

  // ===== 3. 获取历史日期数据（分别处理侧边栏和下拉框）=====
  // 【修复 Bug】这里必须将"侧边栏显示"和"下拉框可用"两个数组完全分开
  // 侧边栏只显示最近 7 天，下拉框使用完整的未截断日期数组
  const allAvailableDates = dataProcessor.getAllAvailableDates();  // 完整的日期列表（用于下拉框）
  const recentDates = dataProcessor.getRecentDates();             // 最近 7 天（用于侧边栏）

  // ===== 4. 生成侧边栏历史记录 HTML（仅显示最近7天）=====
  const historyDatesHTML = dataProcessor.generateHistoryDatesHTML(recentDates);

  // ===== 5. 生成日期选择器 HTML（使用完整日期列表）=====
  // 【修复 Bug】这里传入的是 allAvailableDates，而不是 recentDates
  const dateSelectorHTML = dataProcessor.generateDateSelectorHTML(allAvailableDates);

  // ===== 6. 读取并加载项目摘要（用于排行榜中文描述）=====
  // 先获取最新 Markdown 文件的摘要
  const latestMarkdownPath = findLatestMarkdownFile();
  if (latestMarkdownPath) {
    try {
      const markdownContent = fs.readFileSync(latestMarkdownPath, 'utf8');
      dataProcessor.loadProjectSummaries(markdownContent);
      console.log('已加载项目中文摘要');
    } catch (error) {
      console.warn('加载项目摘要失败:', error.message);
    }
  }

  // ===== 7. 生成排行榜数据并保存到文件 =====
  dataProcessor.generateRankingData();

  // ===== 8. 替换模板中的占位符 =====
  let resultHTML = baseTemplate;

  // 替换页面标题
  resultHTML = resultHTML.replace('{{TITLE}}', `${config.page.titlePrefix} - ${dateCN}`);

  // 替换日期显示
  resultHTML = resultHTML.replace('{{DATE_CN}}', dateCN);

  // 替换排行榜数据路径（移到 <head> 中解决加载时机问题）
  resultHTML = resultHTML.replace('{{RANKING_DATA_PATH}}', config.frontend.rankingDataPath);

  // 替换 CSS 样式
  resultHTML = resultHTML.replace('{{STYLES}}', styles);

  // 替换前端 JavaScript 脚本
  resultHTML = resultHTML.replace('{{SCRIPTS}}', scripts);

  // 替换侧边栏标题
  resultHTML = resultHTML.replace('{{SIDEBAR_HISTORY_TITLE}}', config.sidebar.historyTitle);
  resultHTML = resultHTML.replace('{{SIDEBAR_RANKING_TITLE}}', config.sidebar.rankingTitle);

  // 替换时间范围选择器标签
  resultHTML = resultHTML.replace('{{TIME_RANGE_LABEL}}', config.sidebar.timeRangeLabel);

  // 替换排行榜区域标题
  resultHTML = resultHTML.replace('{{RANKING_SECTION_TITLE}}', config.sidebar.rankingTitle);

  // 替换历史日期列表（包含日期选择器）
  // 这里需要将历史记录列表和日期选择器组合
  const sidebarHistoryHTML = historyDatesHTML + '\n\n' + dateSelectorHTML;
  resultHTML = resultHTML.replace('{{HISTORY_DATES_HTML}}', sidebarHistoryHTML);

  // 替换主内容区域
  resultHTML = resultHTML.replace('{{CONTENT}}', htmlContent);

  return resultHTML;
}

/**
 * 在默认浏览器中打开文件
 * @param {string} filePath - 文件完整路径
 */
function openInBrowser(filePath) {
  const platform = process.platform;
  let command;

  if (platform === 'win32') {
    // Windows: 使用 start 命令
    command = `start "" "${filePath}"`;
  } else if (platform === 'darwin') {
    // macOS: 使用 open 命令
    command = `open "${filePath}"`;
  } else {
    // Linux: 尝试使用 xdg-open
    command = `xdg-open "${filePath}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.warn('无法自动打开浏览器:', error.message);
    } else {
      console.log('已在浏览器中打开报告');
    }
  });
}

/**
 * 查找最新的 Markdown 文件
 * @returns {string|null} 最新 Markdown 文件的完整路径
 */
function findLatestMarkdownFile() {
  const reportsDir = config.directories.reports;

  if (!fs.existsSync(reportsDir)) {
    return null;
  }

  try {
    const files = fs.readdirSync(reportsDir).filter(file =>
      file.startsWith(config.filePatterns.markdownPrefix) &&
      file.endsWith('.md')
    );

    if (files.length > 0) {
      files.sort().reverse();
      return path.join(reportsDir, files[0]);
    }
  } catch (error) {
    console.error('查找 Markdown 文件失败:', error.message);
  }

  return null;
}

/**
 * 根据日期字符串查找对应的 Markdown 文件
 * @param {string} dateStr - 日期字符串，格式：YYYY-MM-DD
 * @returns {string|null} Markdown 文件路径
 */
function findMarkdownFileByDate(dateStr) {
  const reportsDir = config.directories.reports;
  const fileName = `daily_${dateStr}.md`;
  const filePath = path.join(reportsDir, fileName);

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  return null;
}

/**
 * 保存 HTML 文件到指定路径
 * @param {string} content - HTML 文件内容
 * @param {string} outputPath - 输出文件路径
 */
function saveHTMLFile(content, outputPath) {
  try {
    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content, 'utf8');
    console.log('HTML 文件已保存至:', outputPath);
  } catch (error) {
    console.error('保存 HTML 文件失败:', error.message);
    throw error;
  }
}

/**
 * 主函数 - 程序入口
 */
async function main() {
  console.log('='.repeat(50));
  console.log('GitHub Trending HTML 简报生成器');
  console.log('='.repeat(50));

  try {
    // ===== 1. 确定要处理的日期 =====
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    console.log(`\n目标日期: ${today}`);

    // ===== 2. 查找 Markdown 文件 =====
    // 首先尝试当天的文件
    let markdownFilePath = findMarkdownFileByDate(today);

    // 如果当天没有，查找最新的
    if (!markdownFilePath) {
      console.log(`未找到 ${today} 的 Markdown 文件，查找最新文件...`);
      markdownFilePath = findLatestMarkdownFile();

      if (markdownFilePath) {
        const fileName = path.basename(markdownFilePath);
        const match = fileName.match(/daily_(\d{4}-\d{2}-\d{2})\.md/);
        if (match) {
          console.log(`找到最新文件: ${fileName}`);
        }
      }
    }

    if (!markdownFilePath) {
      throw new Error('未找到任何 Markdown 报告文件');
    }

    // ===== 3. 读取 Markdown 文件内容 =====
    console.log(`读取 Markdown 文件: ${markdownFilePath}`);
    const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');

    // ===== 4. 解析 Markdown 为 HTML =====
    console.log('正在解析 Markdown 为 HTML...');
    const htmlContent = markdownParser.convertMarkdownToHTML(markdownContent);

    // ===== 5. 提取日期用于文件名 =====
    const fileName = path.basename(markdownFilePath);
    const dateMatch = fileName.match(/daily_(\d{4}-\d{2}-\d{2})\.md/);
    const reportDate = dateMatch ? dateMatch[1] : today;

    // ===== 6. 生成完整的 HTML 页面 =====
    console.log('正在生成完整 HTML 页面...');
    const fullHTML = generateHTMLTemplate(htmlContent, reportDate);

    // ===== 7. 保存 HTML 文件 =====
    const htmlFileName = `daily_${reportDate}.html`;
    const htmlOutputPath = path.join(config.directories.reports, htmlFileName);
    saveHTMLFile(fullHTML, htmlOutputPath);

    // ===== 8. 自动在浏览器中打开生成的 HTML 文件 =====
    openInBrowser(htmlOutputPath);

    console.log('\n' + '='.repeat(50));
    console.log('✅ HTML 简报生成成功！');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ 生成 HTML 简报时发生错误:', error.message);
    console.error('错误详情:', error.stack);
    process.exit(1);
  }
}

// 判断是否直接运行此脚本
if (require.main === module) {
  main();
}

// 导出模块供外部调用
module.exports = {
  generateHTMLTemplate,
  saveHTMLFile,
  main
};
