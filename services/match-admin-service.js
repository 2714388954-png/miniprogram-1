const cloudConfig = require('../config/cloud');
const contentService = require('./content-service');

const STATUS_OPTIONS = [
  { value: 'not_started', label: '未开始' },
  { value: 'ongoing', label: '进行中' },
  { value: 'finished', label: '已结束' },
];


async function getMatchesByEvent(eventId) {
  return contentService.getGroupedMatchesByEvent(eventId);
}

async function saveMatch(formData) {
  if (!cloudConfig.enabled || typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('当前环境未连接云开发，暂时无法保存比赛数据。');
  }

  const result = await wx.cloud.callFunction({
    name: 'adminUpdateMatch',
    data: {
      formData,
    },
  });

  const payload = result && result.result ? result.result : null;
  if (!payload || !payload.success) {
    throw new Error((payload && payload.message) || '云函数保存失败，请稍后重试。');
  }

  contentService.clearCache();
  return payload.data || null;
}

module.exports = {
  STATUS_OPTIONS,
  getMatchesByEvent,
  saveMatch,
};
