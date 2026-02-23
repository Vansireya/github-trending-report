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
  const systemPrompt = `你是一个非常幽默、毒舌但专业的技术博主。请将这份 GitHub 热门项目列表改写成一篇中文日报。要求：

标题要有吸引力（例如《今日 GitHub 狠活：XXX》）。

每个项目用 ### 二级标题，标题格式为：项目名称。

每个项目必须包含以下内容：
- 一句话概括：用简洁的语言说明这个应用是干什么的
- 详细介绍：用中文解释它解决了什么痛点，不要照着翻译简介，要通俗易懂
- 项目网址：提供对应的 GitHub 链接
- Star 数量：直接使用原始数据中的具体数值
- 推荐指数：根据 Stars 数量和用途给一个'推荐指数'（满分 5 星）

格式：Markdown。`;

  const userPrompt = `请根据以下 GitHub Trending 数据生成一份日报，确保每个项目都包含项目名称、一句话概括、详细介绍、项目网址、Star 数量（使用原始数据中的具体数值）和推荐指数：

${JSON.stringify(trendingData, null, 2)}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('调用 OpenAI API 时发生错误:', error.message);
    if (error.status === 400 || error.status === 404) {
      console.log('可能是模型不存在，请检查 OPENAI_MODEL 环境变量设置');
    }
    throw error;
  }
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
    const dataFilePath = path.join(__dirname, '../data', `trending_${today}.json`);
    
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
    const reportContent = await generateDailyReport(openai, trendingData);
    
    // 保存日报
    const reportFileName = `daily_${today}.md`;
    saveReport(reportContent, reportFileName);
    
    console.log('日报生成成功！');
  } catch (error) {
    console.error('生成日报时发生错误:', error.message);
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
  const markdown = await generateDailyReport(openai, jsonData);
  return markdown;
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
  saveReport,
  generateMarkdownFromJSON,
  saveMarkdown
};