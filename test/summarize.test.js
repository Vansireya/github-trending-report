const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseAIReportContent,
  validateAndNormalizeReport,
  reportToMarkdown
} = require('../src/summarize');

const repositories = [{
  rank: 1,
  name: 'owner/repo',
  url: 'https://github.com/owner/repo',
  description: 'Source description',
  stars: '1,234',
  language: 'TypeScript',
  periodStars: '321'
}];

test('parses JSON wrapped in a model code fence', () => {
  const parsed = parseAIReportContent('```json\n{"projects":[]}\n```');
  assert.deepEqual(parsed, { projects: [] });
});

test('keeps scraped facts authoritative and normalizes model fields', () => {
  const report = validateAndNormalizeReport({
    title: '今日雷达',
    signals: ['TypeScript 项目活跃'],
    projects: [{
      name: 'owner/repo',
      url: 'https://example.com/fake',
      stars: '999,999',
      summary: '一句话',
      problem: '解决问题',
      audience: '开发者',
      whyTrending: '今日增长明显',
      risks: '早期项目',
      score: 9,
      scoreReason: '测试',
      confidence: 'unknown'
    }]
  }, repositories);

  assert.equal(report.projects[0].url, repositories[0].url);
  assert.equal(report.projects[0].stars, repositories[0].stars);
  assert.equal(report.projects[0].score, 5);
  assert.equal(report.projects[0].confidence, 'low');
});

test('fails when the model omits a trending repository', () => {
  assert.throws(
    () => validateAndNormalizeReport({ projects: [] }, repositories),
    /AI 日报缺少项目/
  );
});

test('renders normalized reports into backward-compatible Markdown', () => {
  const report = validateAndNormalizeReport({
    projects: [{ name: 'owner/repo', summary: '摘要', score: 4 }]
  }, repositories);
  const markdown = reportToMarkdown(report);

  assert.match(markdown, /### owner\/repo/);
  assert.match(markdown, /\*\*适合人群\*\*/);
  assert.match(markdown, /★★★★☆/);
});
