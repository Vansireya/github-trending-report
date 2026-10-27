/**
 * 配置文件
 * 集中存储项目中使用的各种路径和配置参数
 */

const path = require('path');

const config = {
  // 目录路径配置（相对于项目根目录）
  directories: {
    // 项目根目录
    root: path.join(__dirname, '..'),
    // 数据目录（存放 trending JSON 和 ranking_data.js）
    data: path.join(__dirname, '../data'),
    // 报告目录（存放 Markdown 和生成的 HTML 文件）
    reports: path.join(__dirname, '../reports'),
    // 模板目录
    templates: path.join(__dirname, 'templates')
  },

  // 排行榜统计天数配置
  ranking: {
    // 近7天（周排行）
    week: 7,
    // 近30天（月排行）
    month: 30,
    // 近90天（季度排行）
    quarter: 90,
    // 排行榜显示的最多项目数量
    maxItems: 10
  },

  // 历史文件保留配置
  history: {
    // 保留最近 30 个自然日的数据和报告
    retentionDays: 30
  },

  // 侧边栏显示配置
  sidebar: {
    // 侧边栏历史记录显示的最近天数
    recentDays: 7,
    // 侧边栏标题
    historyTitle: '📅 历史报告',
    // 排行榜标题
    rankingTitle: '🔥 热门项目排行榜',
    // 时间范围选择器标签
    timeRangeLabel: '选择时间范围：'
  },

  // 文件命名模式
  filePatterns: {
    // Markdown 文件名前缀
    markdownPrefix: 'daily_',
    // HTML 文件名前缀
    htmlPrefix: 'daily_',
    // Trending 数据文件名前缀
    trendingPrefix: 'trending_',
    // Trending 数据文件扩展名
    trendingExt: '.json',
    // 排行榜数据文件名
    rankingDataFile: 'ranking_data.js'
  },

  // 页面标题配置
  page: {
    // 页面标题前缀
    titlePrefix: 'GitHub 简报',
    // 副标题
    subtitle: '每日精选热门开源项目，发现最新技术趋势',
    // 日期格式显示
    dateFormat: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }
  },

  // 前端资源路径（相对于生成的 HTML 文件位置）
  frontend: {
    rankingDataPath: '../data/ranking_data.js',
    stylesheetPath: '../src/templates/style-v2.css',
    scriptPath: '../src/templates/script-v2.js',
    defaultHomeDate: 'daily_2026-02-22.html'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-3.5-turbo',
    enabled: false
  }
};

module.exports = config;
