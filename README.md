# GitHub Trending 日报生成器

自动抓取 GitHub Trending 热门项目，生成便于快速决策的中文技术雷达。仓库仅保留最近 30 个自然日的数据和报告，避免历史文件无限增长。

页面支持深浅主题、项目搜索、语言筛选、解读展开与多周期热度排行。AI 首先生成结构化 JSON，程序校验后再输出 Markdown/HTML；仓库名、链接、Star 等事实字段始终以抓取数据为准。

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

# 清理 30 天以前的历史文件
npm run cleanup

# 使用当前模板重建保留期内的历史页面（不会调用 AI）
npm run rebuild-history
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
│   ├── daily_YYYY-MM-DD.json
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
