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
  const systemPrompt = `你是一名熟悉开源生态、有判断力也有表达欲的中文技术编辑，正在给一位开发者写私人每日简报。你不是在翻译榜单，也不是在写产品目录；你要像一个见多识广的朋友，直接讲清今天出现了什么、哪里有意思、为什么值得多看一眼。

只输出合法 JSON，不要输出 Markdown、代码围栏或解释。必须严格遵守以下结构：
{
  "title": "直接写今天最明显的开源主题，不超过32字，不加栏目式前缀",
  "opening": "2至3句概括今天发生了什么，并点出最值得注意的1至2个项目；有明确判断和节奏，不写寒暄或串场",
  "projects": [{
    "name": "必须与输入仓库全名完全一致",
    "summary": "一句有画面感的中文说明：它是什么、最特别的点是什么，20至50字",
    "problem": "用2至3句讲清具体使用场景、做法或局限，不超过150字"
  }],
  "closing": "不超过80字的今日个人判断"
}

事实约束：
1. 只能使用输入中的仓库名称、简介、README 摘要、主题、语言、Star 和排名，不得虚构作者背景、性能、功能或采用情况。
2. 优先从 README 摘要提取具体功能。确实信息不足时，summary 写“资料不足，先保留观察”，problem 留空；不要把缺失信息扩写成两段废话。
3. 不寒暄，不写“大家好”“各位打工人”“欢迎收看”“话不多说”“开整”“上菜”等串场话术。
4. 标题直接写主题本身，不以“今日”“GitHub 狠活”“GitHub 热榜”“GitHub 日报”等栏目名开头，并禁止使用“狠活”“炸裂”“颠覆”等营销词。
5. 句式要有变化，少用“用于……”“围绕……构建”“一个近期受到关注的……”这类产品目录腔。可以偶尔使用贴切的比喻或轻微幽默，但每个项目最多一次，不硬玩梗。
6. 写出编辑判断：具体指出真正值得看的设计、意外之处或现实限制；不要只复述仓库简介。
7. projects 必须覆盖输入中的所有项目，顺序与输入一致，不增不减。`;

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

    const sourceDescription = String(repo.description || '').trim();
    const fallbackSummary = /^(?:no description|暂无描述)?$/i.test(sourceDescription)
      ? '资料不足，先保留观察'
      : sourceDescription;

    return {
      ...repo,
      summary: String(analysis.summary || fallbackSummary),
      problem: String(analysis.problem || '')
    };
  });

  return {
    title: normalizeReportTitle(report.title || '开源项目趋势更新'),
    opening: normalizeReportOpening(report.opening || '今天值得关注的开源项目集中在以下方向。'),
    projects,
    closing: String(report.closing || '以上判断基于当前公开榜单信息。')
  };
}

function normalizeReportTitle(title) {
  return String(title)
    .replace(/^(?:今日\s*)?GitHub(?:\s+Trending)?\s*(?:狠活|狼活|整活|热榜|日报|雷达)?\s*[：:]\s*/i, '')
    .trim();
}

function normalizeReportOpening(opening) {
  return String(opening)
    .replace(/^各位[^，。！？!?]{0,80}[，,]\s*/, '')
    .replace(/^(?:(?:早上|中午|晚上)好)+[。！？!?\s]*/, '')
    .replace(/^各位[^。！？!?]{0,80}(?:早上好|中午好|晚上好)[。！？!?\s]*/, '')
    .replace(/^欢迎收看(?:今天的|今日)?\s*GitHub(?:\s+Trending)?(?:\s*日报|\s*热榜|\s*整活现场)?[，,。：:\s—-]*/i, '')
    .replace(/(?:废?话不多说[，,]\s*(?:直接)?(?:开始)?(?:今天的)?(?:狠活)?(?:盘点|开整|上菜|开扒)|下面(?:开始)?(?:逐个)?(?:开扒|盘))[。！!\s]*$/i, '')
    .trim();
}

function reportToMarkdown(report) {
  const projectText = report.projects.map(project => `
### ${project.name}

**一句话概括**：${project.summary}

**详细介绍**：${project.problem}

**项目网址**：${project.url}

**Star 数量**：${project.stars}
`).join('\n');

  return `# ${report.title}\n\n${report.opening}\n\n${projectText}\n\n**今日总结**：${report.closing}\n`;
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
  normalizeReportTitle,
  normalizeReportOpening,
  reportToMarkdown,
  saveReport,
  saveStructuredReport,
  generateMarkdownFromJSON,
  saveMarkdown
};
