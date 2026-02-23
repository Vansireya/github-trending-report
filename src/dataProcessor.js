/**
 * 数据处理模块
 * 负责所有数据处理逻辑：读取历史 JSON、计算排行榜、提取中文摘要等
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

// 项目摘要缓存（用于存储 Markdown 中的中文描述）
let projectSummariesCache = {};

// 翻译缓存
let translationCache = {};
const TRANSLATION_CACHE_FILE = 'translation_cache.json';

/**
 * 读取指定天数范围内的历史 Trending 数据
 * @param {number} days - 向前追溯的天数
 * @returns {Array} 历史数据数组，每项包含 date 和 data
 */
function readHistoryData(days) {
  const dataDir = config.directories.data;

  // 如果数据目录不存在，返回空数组
  if (!fs.existsSync(dataDir)) {
    console.warn('数据目录不存在:', dataDir);
    return [];
  }

  try {
    // 读取目录下所有 trending_*.json 文件
    const files = fs.readdirSync(dataDir).filter(file =>
      file.startsWith(config.filePatterns.trendingPrefix) &&
      file.endsWith(config.filePatterns.trendingExt)
    );

    if (files.length === 0) {
      console.warn('未找到任何 trending 数据文件');
      return [];
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // 筛选出在指定时间范围内的文件
    const recentFiles = files.filter(file => {
      const match = file.match(/trending_(\d{4}-\d{2}-\d{2})\.json/);
      if (!match) return false;
      const fileDate = new Date(match[1]);
      return fileDate >= cutoffDate && fileDate <= now;
    }).sort().reverse();

    // 读取并解析每个文件
    const historyData = [];
    for (const file of recentFiles) {
      try {
        const content = fs.readFileSync(path.join(dataDir, file), 'utf8');
        const data = JSON.parse(content);
        const dateMatch = file.match(/trending_(\d{4}-\d{2}-\d{2})\.json/);
        const date = dateMatch ? dateMatch[1] : '';
        historyData.push({ date, data });
      } catch (e) {
        console.error('读取历史数据文件失败:', file, e.message);
      }
    }

    return historyData;
  } catch (error) {
    console.error('读取历史数据时发生错误:', error.message);
    return [];
  }
}

/**
 * 计算排行榜数据
 * 根据历史数据统计项目的出现次数和获得的 star 数量
 * @param {Array} historyData - 历史数据数组
 * @returns {Array} 排行榜数组，按出现次数和 star 数量排序
 */
function calculateRanking(historyData) {
  // 使用 Map 存储项目信息，便于快速查找和去重
  const repoMap = new Map();

  // 遍历所有历史数据
  for (const { date, data } of historyData) {
    // 安全处理：确保 data 是数组
    if (!Array.isArray(data)) {
      continue;
    }

    for (const repo of data) {
      // 跳过无效的项目数据
      if (!repo || !repo.name) {
        continue;
      }

      const name = repo.name;

      // 如果是第一次遇到该项目，初始化其信息
      if (!repoMap.has(name)) {
        repoMap.set(name, {
          name: name,
          url: repo.url || '',
          description: repo.description || '',
          stars: repo.stars || '0',
          count: 0,
          dates: []
        });
      }

      const repoInfo = repoMap.get(name);

      // 更新出现次数
      repoInfo.count++;

      // 记录出现的日期（去重）
      if (!repoInfo.dates.includes(date)) {
        repoInfo.dates.push(date);
      }

      // 更新为最新的 star 数量
      if (repo.stars) {
        repoInfo.stars = repo.stars;
      }
    }
  }

  // 将 Map 转换为数组并排序
  const sorted = Array.from(repoMap.values()).sort((a, b) => {
    // 首先按出现次数降序排序
    if (a.count !== b.count) {
      return b.count - a.count;
    }
    // 如果出现次数相同，按 star 数量降序排序
    const aStars = parseInt(a.stars.replace(/,/g, '')) || 0;
    const bStars = parseInt(b.stars.replace(/,/g, '')) || 0;
    return bStars - aStars;
  });

  // 返回前 N 个项目
  return sorted.slice(0, config.ranking.maxItems);
}

/**
 * 加载项目摘要
 * 从 Markdown 内容中提取项目的中文描述（一句话概括）
 * @param {string} markdownContent - Markdown 文件内容
 * @returns {Object} 项目名称到中文描述的映射对象
 */
function loadProjectSummaries(markdownContent) {
  projectSummariesCache = {};

  // 正则表达式匹配 ### 项目名 后面的 一句话概括
  const projectRegex = /###\s+([^\n]+)\n[\s\S]*?\*\s+\*\*一句话概括\*\*[：:]\s*([^\n]+)/g;
  let match;

  while ((match = projectRegex.exec(markdownContent)) !== null) {
    const name = match[1].trim();
    const summary = match[2].trim();

    // 存储完整项目名（包含 owner）
    projectSummariesCache[name.toLowerCase()] = summary;

    // 同时存储简略项目名（仅仓库名部分）
    const nameParts = name.split('/');
    if (nameParts.length > 1) {
      projectSummariesCache[nameParts[nameParts.length - 1].toLowerCase()] = summary;
    }
  }

  return projectSummariesCache;
}

/**
 * 获取项目的中文摘要
 * 优先从缓存中查找，其次返回原始描述
 * @param {string} projectName - 项目名称
 * @param {string} originalDesc - 原始英文描述
 * @returns {string} 中文摘要或原始描述
 */
function getChineseSummary(projectName, originalDesc) {
  // 优先查找完整项目名
  const nameKey = projectName.toLowerCase();
  if (projectSummariesCache[nameKey]) {
    return projectSummariesCache[nameKey];
  }

  // 其次查找简略项目名
  const nameParts = projectName.split('/');
  if (nameParts.length > 1) {
    const shortName = nameParts[nameParts.length - 1].toLowerCase();
    if (projectSummariesCache[shortName]) {
      return projectSummariesCache[shortName];
    }
  }

  // 如果都找不到，使用简单的翻译回退机制
  if (originalDesc) {
    const translated = simpleTranslate(originalDesc);
    if (translated !== originalDesc) {
      return translated;
    }
  }

  // 如果都找不到，返回原始描述或默认文本
  return originalDesc || '暂无描述';
}

/**
 * 简单的英文到中文翻译回退
 * 当没有匹配到 Markdown 中的中文摘要时使用
 * @param {string} text - 英文文本
 * @returns {string} 翻译后的中文文本（如果识别到关键词）
 */
function simpleTranslate(text) {
  if (!text) return text;

  // 常见技术关键词翻译映射
  const keywordMap = {
    // AI/机器学习
    'ai': '人工智能',
    'artificial intelligence': '人工智能',
    'machine learning': '机器学习',
    'deep learning': '深度学习',
    'neural': '神经网络',
    'llm': '大语言模型',
    'language model': '语言模型',
    'gpt': 'GPT',
    'chatbot': '聊天机器人',

    // 开发工具
    'framework': '框架',
    'library': '库',
    'tool': '工具',
    'developer': '开发者',
    'development': '开发',
    'cli': '命令行工具',
    'sdk': '开发工具包',
    'api': '接口',

    // Web相关
    'web': 'Web',
    'frontend': '前端',
    'backend': '后端',
    'fullstack': '全栈',
    'react': 'React',
    'vue': 'Vue',
    'angular': 'Angular',
    'node': 'Node.js',
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',

    // 数据相关
    'database': '数据库',
    'data': '数据',
    'cache': '缓存',
    'server': '服务器',
    'cloud': '云',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',

    // 开源相关
    'open source': '开源',
    'opensource': '开源',
    'github': 'GitHub',
    'repository': '仓库',

    // 功能描述
    'build': '构建',
    'create': '创建',
    'manage': '管理',
    'deploy': '部署',
    'test': '测试',
    'monitor': '监控',
    'optimize': '优化',
    'automate': '自动化',
    'generate': '生成',
    'parse': '解析',
    'convert': '转换',

    // 常用形容词
    'fast': '快速',
    'simple': '简单',
    'easy': '易于',
    'powerful': '强大',
    'modern': '现代',
    'lightweight': '轻量级',
    'high-performance': '高性能',
    'real-time': '实时',
    'distributed': '分布式',

    // 应用领域
    'crypto': '加密货币',
    'blockchain': '区块链',
    'video': '视频',
    'audio': '音频',
    'image': '图像',
    'game': '游戏',
    'mobile': '移动',
    'desktop': '桌面',

    // 常用动词短语
    'self-hosted': '自托管',
    'open-source': '开源',
    'cross-platform': '跨平台',
    'real-time': '实时',
    'file': '文件',
    'system': '系统',
    'plugin': '插件',
    'extension': '扩展'
  };

  let result = text;

  // 如果文本很短，直接尝试匹配关键词
  if (text.length < 100) {
    const lowerText = text.toLowerCase();

    // 尝试从关键词映射中找到匹配
    for (const [eng, chi] of Object.entries(keywordMap)) {
      if (lowerText.includes(eng)) {
        // 简单替换，但保持原有大小写格式的某些特征
        result = result.replace(new RegExp(eng, 'gi'), chi);
      }
    }
  }

  // 如果没有发生任何变化，返回原文
  if (result === text && text.length > 20) {
    // 对于较长的描述，添加一个提示前缀
    return `📝 ${text}`;
  }

  return result;
}

/**
 * 生成排行榜数据并保存到文件
 * 同时生成近7天、近30天、近90天的排行榜
 * @returns {Object} 排行榜数据对象
 */
function generateRankingData() {
  // 加载翻译缓存
  loadTranslationCache();

  // 读取各时间范围的历史数据
  const weekData = readHistoryData(config.ranking.week);
  const monthData = readHistoryData(config.ranking.month);
  const quarterData = readHistoryData(config.ranking.quarter);

  // 计算各时间范围的排行榜
  const weekRanking = calculateRanking(weekData);
  const monthRanking = calculateRanking(monthData);
  const quarterRanking = calculateRanking(quarterData);

  // 为排行榜添加中文描述和详细信息（用于悬浮窗）
  const weekRankingWithCN = weekRanking.map(item => enrichRankingItem(item));
  const monthRankingWithCN = monthRanking.map(item => enrichRankingItem(item));
  const quarterRankingWithCN = quarterRanking.map(item => enrichRankingItem(item));

  // 保存翻译缓存
  saveTranslationCache();

  // 组装排行榜数据
  const rankingDataJSON = JSON.stringify({
    week: weekRankingWithCN,
    month: monthRankingWithCN,
    quarter: quarterRankingWithCN
  });

  // 写入文件
  const rankingFilePath = path.join(
    config.directories.data,
    config.filePatterns.rankingDataFile
  );

  try {
    fs.writeFileSync(rankingFilePath, 'var rankingData = ' + rankingDataJSON + ';');
    console.log('排行榜数据已生成:', rankingFilePath);
  } catch (error) {
    console.error('写入排行榜数据文件失败:', error.message);
  }

  return {
    week: weekRankingWithCN,
    month: monthRankingWithCN,
    quarter: quarterRankingWithCN
  };
}

/**
 * 丰富排行榜项目信息
 * 添加中文描述、详细信息等
 * @param {Object} item - 原始项目数据
 * @returns {Object} 丰富后的项目数据
 */
function enrichRankingItem(item) {
  // 获取中文摘要（简短版本，用于列表显示）
  const shortDesc = getChineseSummary(item.name, item.description);

  // 获取详细描述（用于悬浮窗）
  const detailedDesc = getDetailedDescription(item);

  return {
    ...item,
    chineseDesc: shortDesc,      // 简短描述，用于列表
    detailedDesc: detailedDesc   // 详细描述，用于悬浮窗
  };
}

/**
 * 获取项目的详细描述（用于悬浮窗）
 * @param {Object} item - 项目数据
 * @returns {string} 详细描述
 */
function getDetailedDescription(item) {
  // 如果有中文摘要，返回中文摘要
  const cnSummary = getChineseSummary(item.name, item.description);
  if (cnSummary && cnSummary !== item.description && cnSummary !== '暂无描述') {
    return cnSummary;
  }

  // 否则尝试 AI 翻译
  if (item.description) {
    const translated = translateWithCache(item.name, item.description);
    if (translated) {
      return translated;
    }
  }

  // 最后返回原始描述
  return item.description || '暂无描述';
}

/**
 * 加载翻译缓存
 */
function loadTranslationCache() {
  const cachePath = path.join(config.directories.data, TRANSLATION_CACHE_FILE);
  try {
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf8');
      translationCache = JSON.parse(content);
      console.log('已加载翻译缓存:', Object.keys(translationCache).length, '条');
    }
  } catch (error) {
    console.warn('加载翻译缓存失败:', error.message);
    translationCache = {};
  }
}

/**
 * 保存翻译缓存
 */
function saveTranslationCache() {
  const cachePath = path.join(config.directories.data, TRANSLATION_CACHE_FILE);
  try {
    fs.writeFileSync(cachePath, JSON.stringify(translationCache, null, 2), 'utf8');
    console.log('翻译缓存已保存');
  } catch (error) {
    console.warn('保存翻译缓存失败:', error.message);
  }
}

/**
 * 使用缓存进行翻译
 * @param {string} projectName - 项目名称
 * @param {string} text - 待翻译文本
 * @returns {string|null} 翻译后的文本
 */
const https = require('https');

function translateWithCache(projectName, text) {
  if (!text) return null;

  const cacheKey = projectName.toLowerCase();

  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }

  const simpleTranslated = simpleTranslate(text);
  if (simpleTranslated !== text) {
    translationCache[cacheKey] = simpleTranslated;
    return simpleTranslated;
  }

  if (text.length > 20) {
    const fallbackText = `📝 ${text}`;
    translationCache[cacheKey] = fallbackText;
  }

  if (config.openai.enabled && config.openai.apiKey) {
    translateWithOpenAI(text).then(translated => {
      if (translated) {
        translationCache[cacheKey] = translated;
        console.log(`[AI翻译] ${projectName}: ${translated}`);
      }
    }).catch(err => {});
  }

  return null;
}

async function translateWithOpenAI(text) {
  const maxRetries = 2;
  const timeout = 10000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        callOpenAI(text),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
      ]);
      return result;
    } catch (error) {
      console.warn(`翻译重试 ${attempt + 1}/${maxRetries}:`, error.message);
      if (attempt === maxRetries - 1) {
        console.error('OpenAI 翻译最终失败:', error.message);
      }
    }
  }
  return null;
}

function callOpenAI(text) {
  return new Promise((resolve, reject) => {
    const apiKey = config.openai.apiKey;
    const model = config.openai.model || 'gpt-3.5-turbo';

    const postData = JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: '你是一个技术翻译助手。请将以下英文技术项目描述翻译成简洁的中文（50字以内），只保留核心信息，去除冗余词汇。直接返回翻译结果，不要添加任何解释或额外内容。'
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 200,
      temperature: 0.3
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            resolve(parsed.choices[0].message.content.trim());
          } else if (parsed.error) {
            reject(new Error(parsed.error.message));
          } else {
            reject(new Error('Unknown API response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 获取所有可用的历史日期
 * 用于生成日期选择器的下拉框选项
 * @returns {Array} 按日期字符串降序排列的数组
 */
function getAllAvailableDates() {
  const reportsDir = config.directories.reports;

  // 如果报告目录不存在，返回空数组
  if (!fs.existsSync(reportsDir)) {
    console.warn('报告目录不存在:', reportsDir);
    return [];
  }

  try {
    // 读取所有 HTML 报告文件
    const files = fs.readdirSync(reportsDir).filter(file =>
      file.startsWith(config.filePatterns.htmlPrefix) &&
      file.endsWith('.html')
    );

    // 提取日期并去重、排序
    const dates = files
      .map(file => {
        const match = file.match(/daily_(\d{4}-\d{2}-\d{2})\.html/);
        return match ? match[1] : null;
      })
      .filter(date => date !== null)
      .sort()
      .reverse();

    return dates;
  } catch (error) {
    console.error('获取可用日期列表时发生错误:', error.message);
    return [];
  }
}

/**
 * 获取侧边栏显示的历史日期列表
 * 仅返回最近 N 天的日期用于侧边栏展示
 * @returns {Array} 最近 N 天的日期数组
 */
function getRecentDates() {
  const allDates = getAllAvailableDates();
  // 只取最近的天数用于侧边栏展示
  return allDates.slice(0, config.sidebar.recentDays);
}

/**
 * 生成日期选择器所需的年份选项 HTML
 * @param {Array} dates - 可用的日期数组
 * @returns {string} 年份选择器的 HTML 选项
 */
function getYearOptions(dates) {
  if (!dates || dates.length === 0) {
    return '<option value="">年</option>';
  }

  const years = [...new Set(dates.map(d => d.substring(0, 4)))].sort().reverse();

  let options = '<option value="">年</option>';
  for (const year of years) {
    options += '<option value="' + year + '">' + year + '</option>';
  }

  return options;
}

/**
 * 生成侧边栏历史记录 HTML
 * @param {Array} recentDates - 最近的历史日期数组
 * @returns {string} 历史记录列表的 HTML
 */
function generateHistoryDatesHTML(recentDates) {
  if (!recentDates || recentDates.length === 0) {
    return '<li style="color: #6a8a6a;">暂无历史记录</li>';
  }

  let html = '';
  for (const date of recentDates) {
    const parts = date.split('-');
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const displayDate = `${year}年${month}月${day}日`;
    html += `<li><a href="daily_${date}.html">${displayDate}</a></li>`;
  }

  return html;
}

/**
 * 生成日期选择器的 HTML（包含年份、月份、日期三个下拉框）
 * 注意：这里传入的是完整的可用日期数组，用于下拉框选择
 * @param {Array} allAvailableDates - 所有可用的日期数组（不截断）
 * @returns {string} 日期选择器的 HTML
 */
function generateDateSelectorHTML(allAvailableDates) {
  const yearOptions = getYearOptions(allAvailableDates);

  const availableDatesData = JSON.stringify(allAvailableDates || []);

  return `
    <div class="date-filter-container">
      <select id="yearSelect" class="date-select" onchange="updateMonthOptions()">
        ${yearOptions}
      </select>
      <select id="monthSelect" class="date-select" onchange="updateDayOptions()">
        <option value="">月</option>
      </select>
      <select id="daySelect" class="date-select">
        <option value="">日</option>
      </select>
      <button class="view-history-btn" onclick="goToHistoryReport()">✓</button>
    </div>
    <div id="availableDatesData" style="display:none;">${availableDatesData}</div>
  `;
}

/**
 * 安全读取 JSON 文件
 * 包含容错处理，如果文件不存在或损坏则返回默认值
 * @param {string} filePath - 文件路径
 * @param {any} defaultValue - 读取失败时返回的默认值
 * @returns {any} 解析后的数据或默认值
 */
function safeReadJSON(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取 JSON 文件失败:', filePath, error.message);
    return defaultValue;
  }
}

module.exports = {
  readHistoryData,
  calculateRanking,
  loadProjectSummaries,
  getChineseSummary,
  generateRankingData,
  getAllAvailableDates,
  getRecentDates,
  getYearOptions,
  generateHistoryDatesHTML,
  generateDateSelectorHTML,
  safeReadJSON
};
