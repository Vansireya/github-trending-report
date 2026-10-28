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

  assert.match(html, /class="project-card\b/);
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

  assert.match(html, /class="project-card\b/);
  assert.doesNotMatch(html, /<ul>\s*<\/ul>/);
});

test('converts legacy report fields whose punctuation is inside bold text', () => {
  const html = markdownParser.convertMarkdownToHTML(`
### owner/repo

**一句话概括：** 项目摘要

**详细介绍：** 项目详情

**项目网址：** https://github.com/owner/repo

**Star 数量：** 123

**推荐指数：** ★★★★★
`);

  assert.match(html, /class="project-card\b/);
  assert.match(html, /项目摘要/);
  assert.doesNotMatch(html, /<strong>一句话概括/);
  assert.doesNotMatch(html, /<strong>详细介绍/);
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

  assert.match(html, /class="rank-badge">2<\/div>/);
  assert.match(html, /TypeScript/);
  assert.match(html, /class="star-pill"[^>]*>★ 9,999/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /project-card--featured/);
  assert.match(html, /class="[^"]*favorite-action/);
  assert.doesNotMatch(html, /later-action|repo-link|展开项目解读|收起项目解读/);
  assert.match(html, /class="detail-toggle-label">它解决什么/);
  assert.match(html, /data-project-stars="9,999"/);
  assert.match(html, /id="project-owner-repo">/);
  assert.doesNotMatch(html, /本期增长|Fork|编辑评分/);
  assert.doesNotMatch(html, /适合：|为什么上榜|使用提醒/);
});

test('keeps the daily feed to a balanced top nine', () => {
  const html = markdownParser.convertMarkdownToHTML(`
### owner/repo

**一句话概括**：项目摘要

**项目网址**：https://github.com/owner/repo

**今日总结**：总结仍然保留。
`, [{ name: 'owner/repo', rank: 10 }]);

  assert.doesNotMatch(html, /project-card/);
  assert.match(html, /总结仍然保留/);
});

test('gives the first project a distinct editorial layout', () => {
  const html = markdownParser.generateProjectCard({
    name: 'owner/repo',
    summary: '摘要',
    repository: { rank: 1, url: 'https://github.com/owner/repo', stars: '1,234' }
  });

  assert.match(html, /project-card--rank-1/);
  assert.match(html, /aria-expanded="true"/);
});

test('matches legacy short project names to scraped repository facts', () => {
  const html = markdownParser.convertMarkdownToHTML(`
### repo

**一句话概括**：项目摘要
`, [{ name: 'owner/repo', rank: 3, stars: '321' }]);

  assert.match(html, /class="rank-badge">3<\/div>/);
  assert.match(html, /project-card--featured/);
});

test('moves the report heading and opening out of the project feed', () => {
  const lead = markdownParser.extractReportLead('<h1>当日标题</h1>\n<p>当日导语</p>\n<article>项目</article>');

  assert.equal(lead.title, '当日标题');
  assert.equal(lead.opening, '当日导语');
  assert.equal(lead.content, '<article>项目</article>');
});

test('moves a legacy blockquote opening out of the project feed', () => {
  const lead = markdownParser.extractReportLead('<h1>当日标题</h1>\n<blockquote>\n<p>旧版导语</p>\n</blockquote>\n<article>项目</article>');

  assert.equal(lead.title, '当日标题');
  assert.equal(lead.opening, '旧版导语');
  assert.equal(lead.content, '<article>项目</article>');
});

test('wraps the daily takeaway as a full-width summary panel', () => {
  const html = markdownParser.convertMarkdownToHTML('**今日总结**：保持判断。');
  assert.match(html, /class="summary-section"/);
  assert.match(html, /今日结论/);
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

test('renders legacy encoded punctuation without exposing HTML', () => {
  const html = markdownParser.generateProjectCard({
    name: 'owner/repo',
    summary: '让 AI 拥有&quot;记忆&quot;与 &lt;script&gt; 标签'
  });

  assert.match(html, /拥有&quot;记忆&quot;/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /&amp;amp;quot;|<script>/);
});
