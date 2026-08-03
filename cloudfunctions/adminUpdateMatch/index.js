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
  let recordId = normalizeOptionalValue(formData.recordId);
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
    if (recordId) {
      const currentRecord = await getMatchByRecordId(recordId);
      if (!currentRecord) {
        return {
          success: false,
          message: '这条比赛记录不存在或已被删除，请重新进入后再编辑。',
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

      const primaryUpdate = await updateMatchByRecordId(recordId, payload);

      if (!primaryUpdate.updated) {
        const existing = await findExistingMatch(payload);
        if (!existing || !existing._id) {
          return {
            success: false,
            message: `未找到可更新记录。编辑记录ID：${recordId || '[空]'}；赛事：${payload.eventId}；比赛编号：${payload.matchId}`,
          };
        }

        recordId = existing._id;
        const fallbackUpdatedAt = normalizeOptionalValue(existing.updatedAt);
        if (expectedUpdatedAt && fallbackUpdatedAt && expectedUpdatedAt !== fallbackUpdatedAt) {
          return {
            success: false,
            message: '这场比赛已被其他管理员更新，请重新打开后再编辑。',
          };
        }

        const fallbackUpdate = await updateMatchByRecordId(recordId, payload);
        if (!fallbackUpdate.updated) {
          return {
            success: false,
            message: `记录已定位但更新失败。编辑记录ID：${normalizeOptionalValue(formData.recordId) || '[空]'}；回退记录ID：${recordId}`,
          };
        }
      }
    } else {
      const existing = await findExistingMatch(payload);

      if (existing && existing._id) {
        if (isSameMatchContent(existing, payload)) {
          return {
            success: false,
            message: '内容未发生修改。',
          };
        }

        recordId = existing._id;
        const updateResult = await updateMatchByRecordId(recordId, payload);
        if (!updateResult.updated) {
          return {
            success: false,
            message: `通过赛事+比赛编号定位到记录，但更新失败。记录ID：${recordId}`,
          };
        }
      } else {
        const addResult = await db.collection('matches').add({
          data: payload,
        });
        recordId = addResult && addResult._id ? addResult._id : '';
      }
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
        message: `简短战报写入校验失败。提交值：${payload.report || '[空]'}；数据库值：${savedRecord.report || '[空]'}`,
      };
    }

    return {
      success: true,
      message: '比赛保存成功',
      data: {
        ...payload,
        _id: recordId,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error && error.message ? error.message : '云函数执行失败，请稍后重试。',
    };
  }
};
