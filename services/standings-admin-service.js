const cloudConfig = require('../config/cloud');
const { standings } = require('../data/standings');

const TABLE_TYPE_OPTIONS = [
  { value: 'league', label: '联赛总榜' },
  { value: 'group', label: '杯赛小组榜' },
];

const CUP_DISPLAY_MODE_OPTIONS = [
  { value: 'group', label: '小组赛优先' },
  { value: 'knockout', label: '淘汰赛优先' },
];

function createEmptyStandingsForm(eventId) {
  return {
    recordId: '',
    updatedAt: '',
    eventId: eventId || '',
    tableType: 'league',
    groupName: '',
    sortOrder: '0',
    tableText: '',
  };
}

function formatTableText(table) {
  return (table || [])
    .map((item) => [
      item.teamName || '',
      item.played ?? '',
      item.win ?? '',
      item.draw ?? '',
      item.lose ?? '',
      item.goalsFor ?? '',
      item.goalsAgainst ?? '',
      item.goalDiff ?? '',
      item.points ?? '',
    ].join('，'))
    .join('\n');
}

function buildLocalRows(eventId) {
  const payload = standings[eventId];
  if (!payload) {
    return [];
  }

  if (payload.type === 'league') {
    return [{
      _id: `local-${eventId}-league`,
      recordKey: `local-${eventId}-league`,
      eventId,
      tableType: 'league',
      groupName: '',
      sortOrder: 0,
      table: payload.table || [],
      updatedAt: '',
    }];
  }

  return (payload.groups || []).map((group, index) => ({
    _id: `local-${eventId}-group-${index}`,
    recordKey: `local-${eventId}-group-${index}`,
    eventId,
    tableType: 'group',
    groupName: group.groupName || '',
    sortOrder: index,
    table: group.table || [],
    updatedAt: '',
  }));
}

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

function normalizeRecord(item) {
  return {
    ...item,
    recordKey: item._id || `${item.tableType}-${item.groupName || 'league'}`,
    groupName: item.groupName === 'none' ? '' : (item.groupName || ''),
    updatedAt: item.updatedAt || '',
    table: item.table || [],
  };
}

async function getStandingsRecordsByEvent(eventId) {
  const db = getDatabase();
  if (!db) {
    return buildLocalRows(eventId);
  }

  const result = await db.collection('standings').where({ eventId }).get();
  return (result.data || [])
    .map(normalizeRecord)
    .sort((a, b) => {
      const typeWeightA = a.tableType === 'league' ? 0 : 1;
      const typeWeightB = b.tableType === 'league' ? 0 : 1;
      if (typeWeightA !== typeWeightB) {
        return typeWeightA - typeWeightB;
      }
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
}

async function saveStandings(formData) {
  if (!cloudConfig.enabled || typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('当前环境未连接云开发，暂时无法保存积分榜。');
  }

  const result = await wx.cloud.callFunction({
    name: 'adminUpdateStandings',
    data: {
      formData,
    },
  });

  const payload = result && result.result ? result.result : null;
  if (!payload || !payload.success) {
    throw new Error((payload && payload.message) || '云函数保存积分榜失败，请稍后重试。');
  }

  return payload.data || null;
}

async function deleteStandings(payload) {
  if (!cloudConfig.enabled || typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('当前环境未连接云开发，暂时无法删除积分榜。');
  }

  const result = await wx.cloud.callFunction({
    name: 'adminDeleteStandings',
    data: payload,
  });

  const body = result && result.result ? result.result : null;
  if (!body || !body.success) {
    throw new Error((body && body.message) || '云函数删除积分榜失败，请稍后重试。');
  }

  return body;
}

async function saveCupDisplayMode(payload) {
  if (!cloudConfig.enabled || typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('当前环境未连接云开发，暂时无法保存显示顺序。');
  }

  const result = await wx.cloud.callFunction({
    name: 'adminUpdateEventDisplayMode',
    data: payload,
  });

  const body = result && result.result ? result.result : null;
  if (!body || !body.success) {
    throw new Error((body && body.message) || '云函数保存显示顺序失败，请稍后重试。');
  }

  return body.data || null;
}

module.exports = {
  TABLE_TYPE_OPTIONS,
  CUP_DISPLAY_MODE_OPTIONS,
  createEmptyStandingsForm,
  formatTableText,
  getStandingsRecordsByEvent,
  saveStandings,
  deleteStandings,
  saveCupDisplayMode,
};
