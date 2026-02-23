# GitHub Trending 日报生成器

自动抓取 GitHub Trending 热门项目，生成 AI 总结的中文日报。

## 快速开始

```bash
# 一键生成今日日报
npm start
```

## 详细步骤（可选）

```bash
# 步骤1: 爬取今日 Trending 数据
npm run scrape

# 步骤2: AI 生成 Markdown 日报
npm run summarize

# 步骤3: 生成 HTML 页面
npm run html
```

## 项目结构

```
github_report/
├── src/
│   ├── scraper.js         # 爬取 Trending 数据
│   ├── summarize.js       # AI 生成日报
│   └── html_generator.js  # 转 HTML
├── data/                  # 原始数据 (trending_YYYY-MM-DD.json)
├── reports/               # 生成的报告
│   ├── daily_YYYY-MM-DD.md
│   └── daily_YYYY-MM-DD.html
├── package.json
└── .env                   # API Key 配置
```

## 配置

在 `.env` 文件中设置：

```
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=your_base_url_here  # 可选
OPENAI_MODEL=gpt-3.5-turbo          # 可选，默认 gpt-3.5-turbo
```

## 查看报告

运行完成后，打开 `reports/daily_YYYY-MM-DD.html` 即可查看精美日报。