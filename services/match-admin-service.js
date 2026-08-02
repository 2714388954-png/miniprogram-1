const cloudConfig = require('../config/cloud');
const contentService = require('./content-service');

const STATUS_OPTIONS = [
  { value: 'not_started', label: '未开始' },
  { value: 'ongoing', label: '进行中' },
  { value: 'finished', label: '已结束' },
];

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

function normalizeOptionalValue(value) {
  return value ? String(value).trim() : '';
}

function normalizeScore(value, status) {
  if (status !== 'finished' && status !== 'ongoing') {
    return null;
  }

  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeScorers(scorersText) {
  return String(scorersText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [player = '', team = '', minute = ''] = line.split('|').map((item) => item.trim());
      return {
        player,
        team,
        minute,
      };
    })
    .filter((item) => item.player);
}

function buildMatchPayload(formData) {
  const status = formData.status || 'not_started';
  return {
    eventId: normalizeOptionalValue(formData.eventId),
    matchId: normalizeOptionalValue(formData.matchId),
    stage: normalizeOptionalValue(formData.stage),
    groupName: normalizeOptionalValue(formData.groupName),
    homeTeam: normalizeOptionalValue(formData.homeTeam),
    awayTeam: normalizeOptionalValue(formData.awayTeam),
    homeScore: normalizeScore(formData.homeScore, status),
    awayScore: normalizeScore(formData.awayScore, status),
    matchTime: normalizeOptionalValue(formData.matchTime),
    location: normalizeOptionalValue(formData.location),
    status,
    reportNewsId: normalizeOptionalValue(formData.reportNewsId),
    reportTitle: normalizeOptionalValue(formData.reportTitle),
    scorers: normalizeScorers(formData.scorersText),
    report: normalizeOptionalValue(formData.report),
  };
}

async function getMatchesByEvent(eventId) {
  return contentService.getGroupedMatchesByEvent(eventId);
}

async function getMatchByRecordId(db, recordId) {
  if (!recordId) {
    return null;
  }

  try {
    const result = await db.collection('matches').doc(recordId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

async function findExistingMatch(db, payload) {
  const result = await db.collection('matches').where({
    eventId: payload.eventId,
    matchId: payload.matchId,
  }).limit(1).get();

  return result.data && result.data[0] ? result.data[0] : null;
}

async function updateMatchByRecordId(db, recordId, payload) {
  if (!recordId) {
    return {
      updated: 0,
    };
  }

  const updateResult = await db.collection('matches').doc(recordId).update({
    data: payload,
  });

  return {
    updated: updateResult && updateResult.stats ? updateResult.stats.updated : 0,
  };
}

async function saveMatch(formData) {
  const db = getDatabase();
  if (!db) {
    throw new Error('当前环境未连接云开发，暂时无法保存比赛数据。');
  }

  const payload = buildMatchPayload(formData);
  let recordId = normalizeOptionalValue(formData.recordId);

  if (recordId) {
    const originalRecord = await getMatchByRecordId(db, recordId);
    const primaryUpdate = await updateMatchByRecordId(db, recordId, payload);

    if (!primaryUpdate.updated) {
      const existing = await findExistingMatch(db, payload);
      if (!existing || !existing._id) {
        throw new Error(
          `未找到可更新记录。编辑记录ID：${recordId || '[空]'}；原记录：${originalRecord ? '存在' : '不存在'}；赛事：${payload.eventId}；比赛编号：${payload.matchId}`
        );
      }

      recordId = existing._id;
      const fallbackUpdate = await updateMatchByRecordId(db, recordId, payload);
      if (!fallbackUpdate.updated) {
        throw new Error(
          `记录已定位但更新失败。编辑记录ID：${normalizeOptionalValue(formData.recordId) || '[空]'}；回退记录ID：${recordId}；赛事：${payload.eventId}；比赛编号：${payload.matchId}`
        );
      }
    }
  } else {
    const existing = await findExistingMatch(db, payload);

    if (existing && existing._id) {
      recordId = existing._id;
      const updateResult = await updateMatchByRecordId(db, existing._id, payload);
      if (!updateResult.updated) {
        throw new Error(
          `通过赛事+比赛编号定位到记录，但更新失败。记录ID：${recordId}；赛事：${payload.eventId}；比赛编号：${payload.matchId}`
        );
      }
    } else {
      const addResult = await db.collection('matches').add({
        data: payload,
      });
      recordId = addResult && addResult._id ? addResult._id : '';
    }
  }

  const savedRecord = await getMatchByRecordId(db, recordId);
  if (!savedRecord) {
    throw new Error('保存后未能重新读取到比赛记录，请稍后重试。');
  }

  if ((savedRecord.report || '') !== payload.report) {
    const expected = payload.report || '[空]';
    const actual = savedRecord.report || '[空]';
    throw new Error(`简短战报写入校验失败。提交值：${expected}；数据库值：${actual}`);
  }

  contentService.clearCache();
  return {
    ...payload,
    _id: recordId,
  };
}

module.exports = {
  STATUS_OPTIONS,
  getMatchesByEvent,
  saveMatch,
};
