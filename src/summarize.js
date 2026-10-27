/**
 * AI 总结脚本
 * 功能：读取 GitHub Trending 数据并生成 AI 日报
 */
const { OpenAI } = require('openai');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * 读取数据文件
 * @param {string} filePath - 数据文件路径
 * @returns {Promise<Object>} 解析后的 JSON 数据
 */
async function readDataFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const jsonData = JSON.parse(data);
        resolve(jsonData);
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

/**
 * 初始化 OpenAI 客户端
 * @returns {OpenAI} OpenAI 客户端实例
 */
function initializeOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;

  if (!apiKey) {
    throw new Error('请在 .env 文件中设置 OPENAI_API_KEY');
  }

  const config = {
    apiKey: apiKey,
  };

  if (baseURL) {
    config.baseURL = baseURL;
  }

  return new OpenAI(config);
}

/**
 * 调用 AI 生成日报
 * @param {Object} openai - OpenAI 客户端实例
 * @param {Array} trendingData - Trending 数据
 * @returns {Promise<string>} AI 生成的日报内容
 */
async function generateDailyReport(openai, trendingData) {
  const systemPrompt = `你是一名严谨、简洁、有判断力的中文开源技术编辑。你的任务不是翻译榜单，而是帮助开发者在 3 分钟内判断项目是否值得关注。

只输出合法 JSON，不要输出 Markdown、代码围栏或解释。必须严格遵守以下结构：
{
  "title": "不超过28字的日报标题",
  "opening": "不超过90字的趋势导语",
  "signals": ["最多3条趋势观察，每条不超过45字"],
  "projects": [{
    "name": "必须与输入仓库全名完全一致",
    "summary": "一句话说明项目是什么，不超过35字",
    "problem": "它解决什么问题，不超过110字",
    "audience": "简短说明更适合哪类开发者，不超过25字"
  }],
  "closing": "不超过80字的今日结论"
}

事实约束：
1. 只能使用输入中的仓库名称、简介、语言、Star 和排名，不得虚构作者背景、性能、功能或采用情况。
2. 信息不足时明确写“仅凭榜单信息暂无法确认”。
3. 语气可以轻松，但避免段子堆砌、夸张营销和投资建议。
4. projects 必须覆盖输入中的所有项目，顺序与输入一致，不增不减。`;

  const userPrompt = `请分析以下 GitHub Trending 数据并生成结构化中文日报：

${JSON.stringify(trendingData, null, 2)}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.35,
      max_tokens: 4000
    });

    const choice = response.choices && response.choices[0];
    if (!choice) {
      throw new Error('AI 未返回可用的日报结果');
    }

    if (choice.finish_reason === 'length') {
      throw new Error('AI 返回内容被截断，请提高 max_tokens 或缩短提示词');
    }

    const content = choice.message && choice.message.content;
    if (!content || !content.trim()) {
      throw new Error('AI 返回了空日报内容');
    }

    return validateAndNormalizeReport(parseAIReportContent(content), trendingData);
  } catch (error) {
    console.error('调用 OpenAI API 时发生错误:', error.message);
    if (error.status === 400 || error.status === 404) {
      console.log('可能是模型不存在，请检查 OPENAI_MODEL 环境变量设置');
    }
    throw error;
  }
}

function parseAIReportContent(content) {
  const cleaned = content.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function validateAndNormalizeReport(report, trendingData) {
  if (!report || typeof report !== 'object' || !Array.isArray(report.projects)) {
    throw new Error('AI 日报 JSON 结构无效');
  }

  const aiProjects = new Map(
    report.projects
      .filter(project => project && typeof project.name === 'string')
      .map(project => [project.name.toLowerCase(), project])
  );

  const projects = trendingData.map(repo => {
    const analysis = aiProjects.get(repo.name.toLowerCase());
    if (!analysis) {
      throw new Error(`AI 日报缺少项目: ${repo.name}`);
    }

    return {
      ...repo,
      summary: String(analysis.summary || repo.description || '暂无摘要'),
      problem: String(analysis.problem || '仅凭榜单信息暂无法确认'),
      audience: String(analysis.audience || '关注该领域的开发者')
    };
  });

  return {
    title: String(report.title || '今日 GitHub Trending 技术雷达'),
    opening: String(report.opening || '快速浏览今天值得关注的开源项目。'),
    signals: Array.isArray(report.signals) ? report.signals.slice(0, 3).map(String) : [],
    projects,
    closing: String(report.closing || '以上判断基于当前公开榜单信息。')
  };
}

function reportToMarkdown(report) {
  const signalText = report.signals.length > 0
    ? `\n\n## 今日信号\n\n${report.signals.map(signal => `- ${signal}`).join('\n')}`
    : '';

  const projectText = report.projects.map(project => `
### ${project.name}

**一句话概括**：${project.summary}

**详细介绍**：${project.problem}

**适合人群**：${project.audience}

**项目网址**：${project.url}

**Star 数量**：${project.stars}
`).join('\n');

  return `# ${report.title}\n\n${report.opening}${signalText}\n\n${projectText}\n\n**今日总结**：${report.closing}\n`;
}

/**
 * 保存日报到文件
 * @param {string} content - 日报内容
 * @param {string} fileName - 文件名
 */
function saveReport(content, fileName) {
  const reportsDir = path.join(__dirname, '../reports');
  
  // 确保目录存在
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const filePath = path.join(reportsDir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`日报已保存至: ${filePath}`);
}

function saveStructuredReport(report, fileName) {
  saveReport(JSON.stringify(report, null, 2), fileName);
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('正在读取 Trending 数据...');
    
    // 获取今天的日期（本地时间，中国时区）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    let dataFilePath = path.join(__dirname, '../data', `trending_${today}.json`);
    
    // 检查数据文件是否存在
    if (!fs.existsSync(dataFilePath)) {
      console.error(`数据文件不存在: ${dataFilePath}`);
      console.log('尝试查找最新的 trending 数据文件...');
      
      // 查找最新的 trending 文件
      const dataDir = path.join(__dirname, '../data');
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir).filter(file => 
          file.startsWith('trending_') && file.endsWith('.json')
        );
        
        if (files.length > 0) {
          // 按文件名排序，取最新文件
          files.sort().reverse();
          dataFilePath = path.join(dataDir, files[0]);
          console.log(`找到最新数据文件: ${dataFilePath}`);
        } else {
          throw new Error('未找到任何 trending 数据文件');
        }
      } else {
        throw new Error('数据目录不存在');
      }
    }
    
    // 读取数据文件
    const trendingData = await readDataFile(dataFilePath);
    
    console.log('正在初始化 OpenAI 客户端...');
    const openai = initializeOpenAIClient();
    
    console.log('正在生成日报...');
    const report = await generateDailyReport(openai, trendingData);

    const dataDateMatch = path.basename(dataFilePath).match(/trending_(\d{4}-\d{2}-\d{2})\.json/);
    const reportDate = dataDateMatch ? dataDateMatch[1] : today;
    
    // 保存结构化日报和兼容现有生成器的 Markdown
    saveStructuredReport(report, `daily_${reportDate}.json`);
    saveReport(reportToMarkdown(report), `daily_${reportDate}.md`);
    
    console.log('日报生成成功！');
  } catch (error) {
    console.error('生成日报时发生错误:', error.message);
    process.exitCode = 1;
  }
}

/**
 * 从 JSON 数据生成 Markdown 简报
 * 用于补全缺失日期的 Markdown 文件
 * @param {string} jsonFilePath - JSON 文件路径
 * @returns {Promise<string>} 生成的 Markdown 内容
 */
async function generateMarkdownFromJSON(jsonFilePath) {
  const jsonData = await readDataFile(jsonFilePath);
  const openai = initializeOpenAIClient();
  const report = await generateDailyReport(openai, jsonData);
  return reportToMarkdown(report);
}

/**
 * 保存 Markdown 报告
 * @param {string} content - Markdown 内容
 * @param {string} fileName - 文件名
 */
function saveMarkdown(content, fileName) {
  return saveReport(content, fileName);
}

if (require.main === module) {
  main();
}

module.exports = { 
  readDataFile, 
  initializeOpenAIClient, 
  generateDailyReport, 
  parseAIReportContent,
  validateAndNormalizeReport,
  reportToMarkdown,
  saveReport,
  saveStructuredReport,
  generateMarkdownFromJSON,
  saveMarkdown
};
