/**
 * Markdown 解析模块
 * 负责将 Markdown 内容转换为特定的 HTML 卡片格式
 */

const { marked } = require('marked');

/**
 * 将 Markdown 内容转换为 HTML 卡片格式
 * 主要功能：
 * 1. 使用 marked 库将 Markdown 转换为基本 HTML
 * 2. 提取项目信息并转换为美观的卡片样式
 * 3. 处理"狠活播报完毕"等特殊段落
 * @param {string} markdown - Markdown 格式的原始内容
 * @returns {string} 转换后的 HTML 内容
 */
function convertMarkdownToHTML(markdown) {
  // 首先使用 marked 将 Markdown 转换为基本 HTML
  let html = marked.parse(markdown);

  // 提取项目信息并转换为卡片格式
  // 匹配 ### 项目名 后跟包含各项信息的无序列表
  const projectRegex = /<h3>([^<]+)<\/h3>\s*<ul>([\s\S]*?)<\/ul>/g;

  let result = html;
  let match;
  let projects = [];

  // 遍历所有匹配的项目块
  while ((match = projectRegex.exec(result)) !== null) {
    const projectName = match[1];
    const listContent = match[0];

    // 解析列表中的各项信息
    const liRegex = /<li><strong>([^<]+)<\/strong>：([\s\S]*?)<\/li>/g;
    let liMatch;
    const projectData = {
      name: projectName,
      summary: '',
      details: '',
      url: '',
      stars: '',
      rating: ''
    };

    // 提取每项信息
    while ((liMatch = liRegex.exec(listContent)) !== null) {
      const key = liMatch[1];
      let value = liMatch[2].trim();

      // 根据不同的键名提取对应的值
      if (key === '一句话概括') {
        // 去除 HTML 标签，只保留纯文本
        projectData.summary = value.replace(/<[^>]+>/g, '');
      } else if (key === '详细介绍') {
        // 处理代码标签
        projectData.details = value.replace(/<code>/g, '`').replace(/<\/code>/g, '`');
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

    // 将原始 HTML 块和解析后的数据一起存储
    projects.push({ original: match[0], data: projectData });
  }

  // 将每个项目转换为卡片 HTML
  for (const p of projects) {
    const cardHTML = generateProjectCard(p.data);
    result = result.replace(p.original, cardHTML);
  }

  // 处理"狠活播报完毕"等特殊段落
  // 将其包装成总结区域
  result = result.replace(
    /<hr>\s*<p>([^<]+狠活播报完毕[\s\S]*?)<\/p>/g,
    '<div class="summary-section"><p>$1</p></div>'
  );

  return result;
}

/**
 * 生成单个项目卡片的 HTML
 * @param {Object} projectData - 项目数据对象
 * @returns {string} 项目卡片的 HTML 字符串
 */
function generateProjectCard(projectData) {
  // 安全处理：确保所有字段都有值
  const name = escapeHTML(projectData.name || '未知项目');
  const summary = escapeHTML(projectData.summary || '暂无');
  const details = escapeHTML(projectData.details || '暂无');
  const url = escapeHTML(projectData.url || '#');
  const stars = escapeHTML(projectData.stars || '0');
  const rating = escapeHTML(projectData.rating || '暂无');

  return `
<div class="project-card">
  <h3 class="project-name">${name}</h3>
  <div class="summary">
    <strong>🎯 一句话概括:</strong> ${summary}
  </div>
  <div class="details">
    <strong>💡 详细介绍:</strong> ${details}
  </div>
  <div class="link">
    <strong>🔗 项目网址:</strong> <a href="${url}" target="_blank">${url}</a>
  </div>
  <div class="stars">
    <strong>✨ Star 数量:</strong> <span>${stars}</span>
  </div>
  <div class="rating">
    <strong>⭐ 推荐指数:</strong> <span>${rating}</span>
  </div>
</div>`;
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
  generateProjectCard,
  escapeHTML,
  parseMarkdownFile
};
