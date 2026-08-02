const cloudConfig = require('../config/cloud');

const SESSION_KEY = 'adminSession';
const SESSION_DURATION = 24 * 60 * 60 * 1000;

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

function buildSession(adminRecord) {
  return {
    username: adminRecord.username || '',
    displayName: adminRecord.displayName || adminRecord.username || '管理员',
    loginExpireAt: Date.now() + SESSION_DURATION,
  };
}

function saveSession(session) {
  wx.setStorageSync(SESSION_KEY, session);
}

function clearSession() {
  wx.removeStorageSync(SESSION_KEY);
}

function getSession() {
  const session = wx.getStorageSync(SESSION_KEY);
  if (!session || !session.loginExpireAt) {
    return null;
  }

  if (Date.now() >= session.loginExpireAt) {
    clearSession();
    return null;
  }

  return session;
}

function isLoggedIn() {
  return !!getSession();
}

async function login(username, password) {
  const db = getDatabase();
  if (!db) {
    throw new Error('当前环境未连接云开发，暂时无法进行管理员登录。');
  }

  const result = await db.collection('admins').where({ username, password }).limit(1).get();
  const adminRecord = result.data && result.data[0];

  if (!adminRecord) {
    throw new Error('账号或密码错误，请重新输入。');
  }

  const session = buildSession(adminRecord);
  saveSession(session);
  return session;
}

module.exports = {
  login,
  getSession,
  isLoggedIn,
  clearSession,
  SESSION_DURATION,
};
