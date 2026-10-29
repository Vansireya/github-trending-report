const test = require('node:test');
const assert = require('node:assert/strict');

const dataProcessor = require('../src/dataProcessor');

test('calculateRanking keeps the latest repository data and counts each date once', () => {
  const ranking = dataProcessor.calculateRanking([
    {
      date: '2026-10-01',
      data: [
        { name: 'owner/repo', url: 'https://github.com/owner/repo', description: 'old', stars: '100' },
        { name: 'owner/repo', url: 'https://github.com/owner/repo', description: 'duplicate', stars: '101' }
      ]
    },
    {
      date: '2026-10-03',
      data: [
        { name: 'owner/repo', url: 'https://github.com/owner/repo', description: 'latest', stars: '300' }
      ]
    }
  ]);

  assert.equal(ranking[0].count, 2);
  assert.deepEqual(ranking[0].dates, ['2026-10-01', '2026-10-03']);
  assert.equal(ranking[0].description, 'latest');
  assert.equal(ranking[0].stars, '300');
  assert.equal('latestDate' in ranking[0], false);
});

test('loadProjectSummaries supports paragraph and list report formats', () => {
  dataProcessor.loadProjectSummaries(`
### owner/paragraph

**一句话概括**：段落摘要

### owner/list

- **一句话概括**：列表摘要
`);

  assert.equal(dataProcessor.getChineseSummary('owner/paragraph', ''), '段落摘要');
  assert.equal(dataProcessor.getChineseSummary('owner/list', ''), '列表摘要');
});

test('calculateDiscoveries favors recent projects outside the latest top nine', () => {
  const discoveries = dataProcessor.calculateDiscoveries([
    {
      date: '2026-10-03',
      data: [
        { rank: 1, name: 'owner/main', description: 'Main project' },
        { rank: 10, name: 'owner/near-miss', description: 'A useful developer tool' }
      ]
    },
    {
      date: '2026-10-02',
      data: [
        { rank: 1, name: 'owner/main', description: 'Main project' },
        { rank: 2, name: 'owner/older', description: 'An interesting older project' },
        { rank: 3, name: 'owner/empty', description: 'No description' }
      ]
    }
  ]);

  assert.deepEqual(discoveries.map(item => item.name), ['owner/near-miss', 'owner/older']);
  assert.equal(discoveries[0].badge, '今日候选');
  assert.equal(discoveries[1].badge, '刚刚出现');
  assert.equal(discoveries.some(item => item.name === 'owner/main'), false);
});
