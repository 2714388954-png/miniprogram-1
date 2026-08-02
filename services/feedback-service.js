const cloudConfig = require('../config/cloud');

const LOCAL_KEY = 'localFeedbackRecords';

function getDatabase() {
  if (!cloudConfig.enabled || typeof wx === 'undefined' || !wx.cloud) {
    return null;
  }

  try {
    return wx.cloud.database();
  } catch (error) {
    return null;
  }
}

function buildPayload(payload) {
  return {
    nickname: payload.nickname || '',
    contact: payload.contact || '',
    content: payload.content || '',
    createTime: new Date().toISOString(),
  };
}

async function submitFeedback(payload) {
  const record = buildPayload(payload);
  const db = getDatabase();

  if (!db) {
    const rows = wx.getStorageSync(LOCAL_KEY) || [];
    rows.unshift(record);
    wx.setStorageSync(LOCAL_KEY, rows);
    return record;
  }

  await db.collection('feedback').add({
    data: record,
  });

  return record;
}

async function getFeedbackList() {
  const db = getDatabase();

  if (!db) {
    return wx.getStorageSync(LOCAL_KEY) || [];
  }

  const result = await db.collection('feedback').get();
  return (result.data || []).sort((a, b) => (a.createTime < b.createTime ? 1 : -1));
}

module.exports = {
  submitFeedback,
  getFeedbackList,
};
