/**
 * GitHub Trending 爬虫脚本
 * 功能：抓取 GitHub Trending 前 10 名项目
 */
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const githubHeaders = {
  'User-Agent': 'github-trending-report',
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
};
if (process.env.GITHUB_TOKEN) {
  githubHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

function extractReadmeExcerpt(content) {
  return String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/^\s*[-|: ]{3,}\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

async function enrichRepository(repo) {
  try {
    const metadataResponse = await axios.get(`https://api.github.com/repos/${repo.name}`, {
      headers: githubHeaders
    });
    const metadata = metadataResponse.data || {};
    const defaultBranch = metadata.default_branch || 'main';
    let readmeExcerpt = '';

    try {
      const readmeResponse = await axios.get(
        `https://raw.githubusercontent.com/${repo.name}/${encodeURIComponent(defaultBranch)}/README.md`,
        { responseType: 'text', timeout: 10000 }
      );
      readmeExcerpt = extractReadmeExcerpt(readmeResponse.data);
    } catch (error) {
      console.warn(`未能读取 ${repo.name} 的 README:`, error.message);
    }

    return {
      ...repo,
      description: /^(?:no description)?$/i.test(String(repo.description || '').trim())
        ? metadata.description || repo.description
        : repo.description,
      language: /^(?:unknown)?$/i.test(String(repo.language || '').trim())
        ? metadata.language || repo.language
        : repo.language,
      topics: Array.isArray(metadata.topics) ? metadata.topics.slice(0, 8) : [],
      readmeExcerpt
    };
  } catch (error) {
    console.warn(`未能补全 ${repo.name} 的仓库资料:`, error.message);
    return repo;
  }
}

async function enrichRepositories(repositories) {
  const enriched = [];
  for (const repo of repositories) {
    enriched.push(await enrichRepository(repo));
  }
  return enriched;
}

/**
 * 获取 GitHub Trending 项目数据
 * @returns {Promise<Array>} 包含前 10 个 Trending 项目信息的数组
 */
async function fetchTrending() {
  console.log('正在访问 GitHub Trending 页面...');
  
  const url = 'https://github.com/trending';
  
  // 设置请求头，模拟浏览器访问
  const config = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  };

  try {
    const response = await axios.get(url, config);
    console.log('成功获取页面内容');
    
    const $ = cheerio.load(response.data);
    const repositories = [];
    
    // 选择 GitHub 上的仓库列表项
    $('.Box article.Box-row').each((index, element) => {
      // 只处理前 10 个项目
      if (index >= 10) return false; // 跳出循环
      
      // 提取项目名称
      const nameElement = $(element).find('h2.h3 a');
      let name = nameElement.text().replace(/\s+/g, '').trim();
      
      // 提取URL
      let url = nameElement.attr('href');
      if (url && !url.startsWith('http')) {
        url = 'https://github.com' + url;
      }
      
      // 提取描述
      const descriptionElement = $(element).find('p.col-9');
      let description = 'No description';
      if (descriptionElement.length > 0) {
        description = descriptionElement.text().trim();
      }
      
      // 提取编程语言
      let language = 'Unknown';
      const languageElement = $(element).find('[itemprop="programmingLanguage"]');
      if (languageElement.length > 0) {
        language = languageElement.text().trim();
      }
      
      // 提取 Star 数量
      let stars = '0';
      const starLink = $(element).find('a[href*="/stargazers"]');
      if (starLink.length > 0) {
        stars = starLink.text().trim().replace(/\s+/g, '');
      }

      // 构建项目对象
      const repo = {
        rank: index + 1,
        name: name,
        url: url,
        description: description,
        stars: stars,
        language: language
      };
      
      repositories.push(repo);
    });

    if (repositories.length === 0) {
      throw new Error('未从 GitHub Trending 页面解析到任何项目，页面结构可能已变化');
    }
    
    console.log(`成功提取 ${repositories.length} 个仓库信息`);
    console.log('正在补全仓库资料与 README 摘要...');
    return enrichRepositories(repositories);
  } catch (error) {
    console.error('获取 Trending 数据时发生错误:', error.message);
    throw error;
  }
}

/**
 * 保存数据到文件
 * @param {Array} data - 要保存的数据
 * @param {string} filename - 文件名
 */
function saveDataToFile(data, filename) {
  const filePath = path.join(__dirname, '../data', filename);
  
  // 确保目录存在
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 写入文件
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`数据已保存到 ${filePath}`);
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('开始抓取 GitHub Trending 前 10 名项目...');
    
    // 获取 Trending 数据
    const trendingRepos = await fetchTrending();
    
    // 打印到控制台
    console.log('\n=== GitHub Trending Top 10 ===');
    console.log(JSON.stringify(trendingRepos, null, 2));
    
    // 获取今天的日期（本地时间，中国时区）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    const filename = `trending_${today}.json`;
    saveDataToFile(trendingRepos, filename);
    
    console.log('\n任务完成！');
  } catch (error) {
    console.error('程序执行出错:', error.message);
    process.exitCode = 1;
  }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
  main();
}

module.exports = {
  fetchTrending,
  saveDataToFile,
  extractReadmeExcerpt,
  enrichRepository,
  enrichRepositories
};
