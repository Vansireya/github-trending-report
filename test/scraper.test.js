const test = require('node:test');
const assert = require('node:assert/strict');

const { extractReadmeExcerpt } = require('../src/scraper');

test('extractReadmeExcerpt removes README decoration and keeps useful prose', () => {
  const excerpt = extractReadmeExcerpt(`# Project Name

![badge](https://example.com/badge.svg)

A useful tool for coding agents.

[Read the guide](https://example.com/guide)

\`\`\`sh
npm install
\`\`\`
`);

  assert.match(excerpt, /A useful tool for coding agents/);
  assert.match(excerpt, /Read the guide/);
  assert.doesNotMatch(excerpt, /badge\.svg|npm install|```/);
});
