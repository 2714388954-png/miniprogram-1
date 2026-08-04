const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

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
      const [player = '', team = '', minute = ''] = line.split(/[，,]/).map((item) => item.trim());
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
  const now = new Date().toISOString();
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
    updatedAt: now,
  };
}

function buildComparablePayload(payload) {
  return {
    eventId: payload.eventId || '',
    matchId: payload.matchId || '',
    stage: payload.stage || '',
    groupName: payload.groupName || '',
    homeTeam: payload.homeTeam || '',
    awayTeam: payload.awayTeam || '',
    homeScore: payload.homeScore === null || payload.homeScore === undefined ? null : payload.homeScore,
    awayScore: payload.awayScore === null || payload.awayScore === undefined ? null : payload.awayScore,
    matchTime: payload.matchTime || '',
    location: payload.location || '',
    status: payload.status || '',
    reportNewsId: payload.reportNewsId || '',
    reportTitle: payload.reportTitle || '',
    scorers: payload.scorers || [],
    report: payload.report || '',
  };
}

function isSameMatchContent(currentRecord, payload) {
  return JSON.stringify(buildComparablePayload(currentRecord || {})) === JSON.stringify(buildComparablePayload(payload));
}

async function getMatchByRecordId(recordId) {
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

async function findExistingMatch(payload) {
  const result = await db.collection('matches').where({
    eventId: payload.eventId,
    matchId: payload.matchId,
  }).limit(1).get();

  return result.data && result.data[0] ? result.data[0] : null;
}

async function getRelatedNews(newsId) {
  if (!newsId) {
    return null;
  }

  const result = await db.collection('news').where({ newsId }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function updateMatchByRecordId(recordId, payload) {
  if (!recordId) {
    return {
      updated: 0,
    };
  }

  const result = await db.collection('matches').doc(recordId).update({
    data: payload,
  });

  return {
    updated: result && result.stats ? result.stats.updated : 0,
  };
}

exports.main = async (event) => {
  const formData = event && event.formData ? event.formData : {};
  const payload = buildMatchPayload(formData);
  const recordId = normalizeOptionalValue(formData.recordId);
  const expectedUpdatedAt = normalizeOptionalValue(formData.updatedAt);

  if (!payload.eventId || !payload.matchId || !payload.stage || !payload.homeTeam || !payload.awayTeam) {
    return {
      success: false,
      message: '缺少必要比赛字段，无法保存。',
    };
  }

  if (!payload.matchTime || !payload.location) {
    return {
      success: false,
      message: '缺少比赛时间或地点，无法保存。',
    };
  }

  try {
    if (payload.reportNewsId) {
      const relatedNews = await getRelatedNews(payload.reportNewsId);
      if (!relatedNews) {
        return {
          success: false,
          message: '所选关联新闻不存在，请重新选择后再保存。',
        };
      }
    }

    const existingMatch = await findExistingMatch(payload);

    if (recordId) {
      const currentRecord = await getMatchByRecordId(recordId);
      if (!currentRecord) {
        return {
          success: false,
          message: '这条比赛记录不存在或已被删除，请重新进入后再编辑。',
        };
      }

      if (existingMatch && existingMatch._id !== recordId) {
        return {
          success: false,
          message: `比赛编号重复：${payload.matchId} 在当前赛事中已存在，请更换编号。`,
        };
      }

      if (isSameMatchContent(currentRecord, payload)) {
        return {
          success: false,
          message: '内容未发生修改。',
        };
      }

      const currentUpdatedAt = normalizeOptionalValue(currentRecord.updatedAt);
      if (expectedUpdatedAt && currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
        return {
          success: false,
          message: '这场比赛已被其他管理员更新，请重新打开后再编辑。',
        };
      }

      const updateResult = await updateMatchByRecordId(recordId, payload);
      if (!updateResult.updated) {
        return {
          success: false,
          message: '比赛记录未能更新，请稍后重试。',
        };
      }
    } else {
      if (existingMatch) {
        return {
          success: false,
          message: `比赛编号重复：${payload.matchId} 在当前赛事中已存在，请使用新的比赛编号。`,
        };
      }

      const addResult = await db.collection('matches').add({
        data: payload,
      });

      if (!addResult || !addResult._id) {
        return {
          success: false,
          message: '比赛新增失败，请稍后重试。',
        };
      }

      const savedRecord = await getMatchByRecordId(addResult._id);
      return {
        success: true,
        message: '比赛保存成功',
        data: savedRecord || {
          ...payload,
          _id: addResult._id,
        },
      };
    }

    const savedRecord = await getMatchByRecordId(recordId);
    if (!savedRecord) {
      return {
        success: false,
        message: '保存后未能重新读取到比赛记录。',
      };
    }

    if ((savedRecord.report || '') !== payload.report) {
      return {
        success: false,
        message: '简短战报写入校验失败，请稍后重试。',
      };
    }

    return {
      success: true,
      message: '比赛保存成功',
      data: savedRecord,
    };
  } catch (error) {
    return {
      success: false,
      message: error && error.message ? error.message : '云函数执行失败，请稍后重试。',
    };
  }
};
