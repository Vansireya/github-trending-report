const test = require('node:test');
const assert = require('node:assert/strict');

const markdownParser = require('../src/markdownParser');

test('converts the current paragraph report format into a project card', () => {
  const html = markdownParser.convertMarkdownToHTML(`
# 今日简报

### owner/repo

**一句话概括**：项目摘要

**详细介绍**：项目详情

**项目网址**：https://github.com/owner/repo

**Star 数量**：123

**推荐指数**：★★★★★

**今日总结**：总结仍应保留。
`);

  assert.match(html, /class="project-card"/);
  assert.match(html, /项目摘要/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /总结仍应保留/);
});

test('converts the legacy list report format into a project card', () => {
  const html = markdownParser.convertMarkdownToHTML(`
### owner/repo

- **一句话概括**：项目摘要
- **详细介绍**：项目详情
- **项目网址**：https://github.com/owner/repo
- **Star 数量**：123
- **推荐指数**：★★★★☆
`);

  assert.match(html, /class="project-card"/);
  assert.doesNotMatch(html, /<ul>\s*<\/ul>/);
});

test('rejects unsafe project links', () => {
  const html = markdownParser.generateProjectCard({
    name: 'owner/repo',
    url: 'javascript:alert(1)'
  });

  assert.match(html, /href="#"/);
  assert.doesNotMatch(html, /javascript:/);
});

test('shows the authoritative scraped star count beside the project name', () => {
  const html = markdownParser.convertMarkdownToHTML(`
### owner/repo

**一句话概括**：项目摘要

**项目网址**：https://github.com/owner/repo

**Star 数量**：123

**推荐指数**：★★★★☆
`, [{ name: 'owner/repo', rank: 2, language: 'TypeScript', stars: '9,999', forks: '42', periodStars: '321' }]);

  assert.match(html, /#2/);
  assert.match(html, /TypeScript/);
  assert.match(html, /class="star-pill"[^>]*>★ 9,999/);
  assert.doesNotMatch(html, /本期增长|Fork|编辑评分/);
  assert.doesNotMatch(html, /为什么上榜|使用提醒/);
});

test('wraps the daily takeaway as a full-width summary panel', () => {
  const html = markdownParser.convertMarkdownToHTML('**今日总结**：保持判断。');
  assert.match(html, /class="summary-section"/);
  assert.match(html, /保持判断/);
});

test('escapes raw HTML and rejects unsafe Markdown links', () => {
  const html = markdownParser.convertMarkdownToHTML(`
<script>alert('xss')</script>

[危险链接](javascript:alert('xss'))
`);

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /href="#"/);
});
