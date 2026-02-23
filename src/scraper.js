/**
 * GitHub Trending 爬虫脚本
 * 功能：抓取 GitHub Trending 前 10 名项目
 */
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

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
    
    console.log(`成功提取 ${repositories.length} 个仓库信息`);
    return repositories;
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
  }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
  main();
}

module.exports = { fetchTrending, saveDataToFile };