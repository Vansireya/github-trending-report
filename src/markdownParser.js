/**
 * Markdown 解析模块
 * 负责将 Markdown 内容转换为特定的 HTML 卡片格式
 */

const { marked, Renderer } = require('marked');

/**
 * 将 Markdown 内容转换为 HTML 卡片格式
 * 主要功能：
 * 1. 使用 marked 库将 Markdown 转换为基本 HTML
 * 2. 提取项目信息并转换为美观的卡片样式
 * 3. 处理"狠活播报完毕"等特殊段落
 * @param {string} markdown - Markdown 格式的原始内容
 * @param {Array} repositories - 当日抓取的仓库事实数据
 * @returns {string} 转换后的 HTML 内容
 */
function convertMarkdownToHTML(markdown, repositories = []) {
  const repositoryMap = new Map();
  repositories.forEach(function(repository) {
    const name = String(repository.name || '').toLowerCase();
    if (!name) return;
    repositoryMap.set(name, repository);
    repositoryMap.set(name.split('/').pop(), repository);
  });
  const renderer = new Renderer();
  renderer.html = function(token) {
    return escapeHTML(token.text);
  };
  renderer.link = function(token) {
    const rawHref = token.href || '';
    const href = /^https?:\/\//i.test(rawHref) ? escapeHTML(rawHref) : '#';
    const text = escapeHTML(token.text || rawHref);
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  // 首先使用 marked 将 Markdown 转换为基本 HTML
  let html = marked.parse(markdown, { renderer });

  // 提取项目信息并转换为卡片格式
  // 同时兼容 AI 生成的段落格式和旧版无序列表格式
  const projectRegex = /<h3>([^<]+)<\/h3>\s*([\s\S]*?)(?=<h3>|$)/g;
  const projectFieldNames = new Set([
    '一句话概括',
    '详细介绍',
    '适合人群',
    '走红原因',
    '风险提示',
    '信息置信度',
    '项目网址',
    'Star 数量',
    '推荐指数'
  ]);

  let result = html;
  let match;
  let projects = [];

  // 遍历所有匹配的项目块
  while ((match = projectRegex.exec(result)) !== null) {
    const projectName = match[1];
    const projectContent = match[2];

    // 解析列表中的各项信息
    // 兼容新格式 **字段**：内容，以及旧格式 **字段：** 内容。
    const fieldRegex = /<(p|li)><strong>([^<：:]+)(?:[：:])?<\/strong>\s*(?:[：:]\s*)?([\s\S]*?)<\/\1>/g;
    let fieldMatch;
    const projectData = {
      name: projectName,
      summary: '',
      details: '',
      audience: '',
      whyTrending: '',
      risks: '',
      confidence: '',
      url: '',
      stars: '',
      rating: ''
    };

    // 提取每项信息
    while ((fieldMatch = fieldRegex.exec(projectContent)) !== null) {
      const key = fieldMatch[2];
      let value = fieldMatch[3].trim();

      // 根据不同的键名提取对应的值
      if (key === '一句话概括') {
        // 去除 HTML 标签，只保留纯文本
        projectData.summary = value.replace(/<[^>]+>/g, '');
      } else if (key === '详细介绍') {
        // 处理代码标签
        projectData.details = value.replace(/<code>/g, '`').replace(/<\/code>/g, '`');
      } else if (key === '适合人群') {
        projectData.audience = value.replace(/<[^>]+>/g, '');
      } else if (key === '走红原因') {
        projectData.whyTrending = value.replace(/<[^>]+>/g, '');
      } else if (key === '风险提示') {
        projectData.risks = value.replace(/<[^>]+>/g, '');
      } else if (key === '信息置信度') {
        projectData.confidence = value.replace(/<[^>]+>/g, '');
      } else if (key === '项目网址') {
        // 尝试提取 href 属性
        const linkMatch = value.match(/href="([^"]+)"/);
        if (linkMatch) {
          projectData.url = linkMatch[1];
        } else {
          // 如果没有链接标签，尝试提取纯 URL
          const urlMatch = value.match(/https?:\/\/[^\s<]+/);
          projectData.url = urlMatch ? urlMatch[0] : value.replace(/<[^>]+>/g, '');
        }
      } else if (key === 'Star 数量') {
        projectData.stars = value.replace(/<[^>]+>/g, '');
      } else if (key === '推荐指数') {
        projectData.rating = value.replace(/<[^>]+>/g, '');
      }
    }

    // 至少识别出核心字段后才转换，避免误伤普通三级标题
    if (projectData.summary || projectData.url) {
      const remainingContent = projectContent
        .replace(fieldRegex, (fieldHTML, tagName, key) =>
          projectFieldNames.has(key) ? '' : fieldHTML
        )
        .replace(/<ul>\s*<\/ul>/g, '')
        .trim();

      projects.push({
        original: match[0],
        data: projectData,
        remainingContent
      });
    }
  }

  // 将每个项目转换为卡片 HTML
  for (const p of projects) {
    const repository = repositoryMap.get(p.data.name.toLowerCase()) || {};
    if (Number(repository.rank) > 9) {
      result = result.replace(p.original, p.remainingContent);
      continue;
    }
    const cardHTML = generateProjectCard({ ...p.data, repository }) + (p.remainingContent ? `\n${p.remainingContent}` : '');
    result = result.replace(p.original, cardHTML);
  }

  // 处理"狠活播报完毕"等特殊段落
  // 将其包装成总结区域
  result = result.replace(
    /<hr>\s*<p>([^<]+狠活播报完毕[\s\S]*?)<\/p>/g,
    '<div class="summary-section"><p>$1</p></div>'
  );

  result = result.replace(
    /<p><strong>今日总结<\/strong>[：:]\s*([\s\S]*?)<\/p>/g,
    '<div class="summary-section"><span class="eyebrow">今日结论</span><p>$1</p></div>'
  );

  return result;
}

function extractReportLead(html) {
  const titleMatch = html.match(/<h1>([\s\S]*?)<\/h1>/);
  const title = titleMatch ? titleMatch[1].trim() : '今日 GitHub Trending';
  let content = titleMatch ? html.replace(titleMatch[0], '') : html;
  const openingMatch = content.match(/^\s*<p>([\s\S]*?)<\/p>/);
  const opening = openingMatch ? openingMatch[1].trim() : '';

  if (openingMatch) {
    content = content.replace(openingMatch[0], '');
  }

  return { title, opening, content: content.trim() };
}

/**
 * 生成单个项目卡片的 HTML
 * @param {Object} projectData - 项目数据对象
 * @returns {string} 项目卡片的 HTML 字符串
 */
function generateProjectCard(projectData) {
  // 安全处理：确保所有字段都有值
  const repository = projectData.repository || {};
  const name = escapeHTML(projectData.name || '未知项目');
  const summary = escapeHTML(projectData.summary || '暂无');
  const details = escapeHTML(projectData.details || '暂无');
  const rawUrl = repository.url || projectData.url || '';
  const url = /^https?:\/\//i.test(rawUrl) ? escapeHTML(rawUrl) : '#';
  const stars = escapeHTML(repository.stars || projectData.stars || '0');
  const rank = Number(repository.rank) || 0;
  const language = escapeHTML(repository.language || 'Other');
  const cardId = `project-${String(projectData.name || 'unknown').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const layoutClass = rank === 1
    ? ' project-card--rank-1'
    : rank > 1 && rank <= 3
      ? ' project-card--featured'
      : ' project-card--compact';
  const isExpanded = rank > 0 && rank <= 3;

  return `
<article class="project-card${layoutClass}" data-project-name="${name}" data-project-url="${url}" data-project-summary="${summary}" data-project-stars="${stars}" data-language="${language}">
  <div class="project-card-header">
    <div class="rank-badge">${rank || 'NEW'}</div>
    <div class="project-identity">
      <div class="project-title-line">
        <a class="project-name" href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>
        <span class="star-pill" aria-label="${stars} stars">★ ${stars}</span>
      </div>
      <div class="project-tags">
        <span class="language-tag"><i></i>${language}</span>
        <span class="appearance-tag" hidden></span>
      </div>
    </div>
    <div class="project-actions">
      <button class="card-action favorite-action" type="button" aria-label="收藏 ${name}" aria-pressed="false" title="收藏">♡</button>
    </div>
  </div>
  <p class="project-summary">${summary}</p>
  <button class="detail-toggle" type="button" aria-label="${isExpanded ? '收起' : '展开'} ${name} 的项目解读" aria-expanded="${isExpanded}" aria-controls="${cardId}">
    <span class="detail-toggle-label">它解决什么</span><span class="detail-chevron" aria-hidden="true">⌄</span>
  </button>
  <div class="project-details" id="${cardId}"${isExpanded ? '' : ' hidden'}>
    <p>${details}</p>
  </div>
</article>`;
}

/**
 * HTML 实体转义
 * 防止 XSS 攻击和数据展示问题
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHTML(str) {
  if (!str) return '';
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return str.replace(/[&<>"']/g, char => htmlEntities[char]);
}

/**
 * 读取并解析 Markdown 文件
 * @param {string} filePath - Markdown 文件的完整路径
 * @returns {Promise<string>} 解析后的 HTML 内容
 */
function parseMarkdownFile(filePath) {
  const fs = require('fs');

  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const htmlContent = convertMarkdownToHTML(data);
        resolve(htmlContent);
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

module.exports = {
  convertMarkdownToHTML,
  extractReportLead,
  generateProjectCard,
  escapeHTML,
  parseMarkdownFile
};
