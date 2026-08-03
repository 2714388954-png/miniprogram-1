const cloudConfig = require('../config/cloud');
const contentService = require('./content-service');

const DEFAULT_FORM = {
  recordId: '',
  updatedAt: '',
  newsId: '',
  eventId: '',
  title: '',
  summary: '',
  coverImage: '',
  publishTime: '',
  category: '',
  isFeatured: false,
  isPinned: false,
  sortOrder: '0',
  content: '',
  relatedMatchId: '',
};

async function getNewsByEvent(eventId) {
  return contentService.getNewsByEvent(eventId);
}

function createEmptyNewsForm(eventId) {
  return {
    ...DEFAULT_FORM,
    eventId: eventId || '',
  };
}

async function saveNews(formData) {
  if (!cloudConfig.enabled || typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('当前环境未连接云开发，暂时无法保存新闻数据。');
  }

  const result = await wx.cloud.callFunction({
    name: 'adminUpdateNews',
    data: {
      formData,
    },
  });

  const payload = result && result.result ? result.result : null;
  if (!payload || !payload.success) {
    throw new Error((payload && payload.message) || '云函数保存新闻失败，请稍后重试。');
  }

  contentService.clearCache();
  return payload.data || null;
}

async function uploadCoverImage(filePath, newsId) {
  if (!cloudConfig.enabled || typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('当前环境未连接云开发，暂时无法上传封面图。');
  }

  const timestamp = Date.now();
  const safeNewsId = normalizeFileSegment(newsId || 'news');
  const extension = getFileExtension(filePath);
  const cloudPath = `news-covers/${safeNewsId}-${timestamp}${extension}`;

  const result = await wx.cloud.uploadFile({
    cloudPath,
    filePath,
  });

  if (!result || !result.fileID) {
    throw new Error('封面图上传失败，请稍后重试。');
  }

  return result.fileID;
}

async function deleteNews(payload) {
  if (!cloudConfig.enabled || typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('当前环境未连接云开发，暂时无法删除新闻数据。');
  }

  const result = await wx.cloud.callFunction({
    name: 'adminDeleteNews',
    data: payload,
  });

  const body = result && result.result ? result.result : null;
  if (!body || !body.success) {
    throw new Error((body && body.message) || '云函数删除新闻失败，请稍后重试。');
  }

  contentService.clearCache();
  return body;
}

function getFileExtension(filePath) {
  const matched = String(filePath || '').match(/\.[^./\\]+$/);
  return matched ? matched[0] : '.jpg';
}

function normalizeFileSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'news';
}

module.exports = {
  getNewsByEvent,
  createEmptyNewsForm,
  saveNews,
  uploadCoverImage,
  deleteNews,
};
