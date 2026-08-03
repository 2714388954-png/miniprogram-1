const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

function normalizeOptionalValue(value) {
  if (value === undefined || value === null) {
    return '';
  }
  const normalized = String(value).trim();
  return normalized === 'none' ? '' : normalized;
}

function normalizeSortOrder(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'team';
}

function parseTableText(tableText, tableType, groupName) {
  return String(tableText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const columns = line.split('|').map((item) => item.trim());
      if (columns.length < 9) {
        throw new Error(`第 ${index + 1} 行格式不完整，请按“队名 | 赛 | 胜 | 平 | 负 | 进 | 失 | 净胜 | 积分”填写。`);
      }

      const [
        teamName,
        played,
        win,
        draw,
        lose,
        goalsFor,
        goalsAgainst,
        goalDiff,
        points,
      ] = columns;

      return {
        teamId: `${tableType}-${slugify(groupName || 'league')}-${slugify(teamName)}-${index + 1}`,
        teamName,
        played: Number(played) || 0,
        win: Number(win) || 0,
        draw: Number(draw) || 0,
        lose: Number(lose) || 0,
        goalsFor: Number(goalsFor) || 0,
        goalsAgainst: Number(goalsAgainst) || 0,
        goalDiff: Number(goalDiff) || 0,
        points: Number(points) || 0,
        rank: index + 1,
      };
    });
}

function buildStandingsPayload(formData) {
  const tableType = normalizeOptionalValue(formData.tableType) || 'league';
  const groupName = tableType === 'group' ? normalizeOptionalValue(formData.groupName) : '';
  const table = parseTableText(formData.tableText, tableType, groupName);

  return {
    eventId: normalizeOptionalValue(formData.eventId),
    tableType,
    groupName,
    sortOrder: normalizeSortOrder(formData.sortOrder),
    table,
    updatedAt: new Date().toISOString(),
  };
}

function buildComparablePayload(payload) {
  return {
    eventId: payload.eventId || '',
    tableType: payload.tableType || '',
    groupName: payload.groupName || '',
    sortOrder: typeof payload.sortOrder === 'number' ? payload.sortOrder : normalizeSortOrder(payload.sortOrder),
    table: payload.table || [],
  };
}

function isSameStandingsContent(currentRecord, payload) {
  return JSON.stringify(buildComparablePayload(currentRecord || {})) === JSON.stringify(buildComparablePayload(payload));
}

async function getRecordById(recordId) {
  if (!recordId) {
    return null;
  }

  try {
    const result = await db.collection('standings').doc(recordId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

async function findExistingRecord(payload) {
  const query = {
    eventId: payload.eventId,
    tableType: payload.tableType,
  };

  if (payload.tableType === 'group') {
    query.groupName = payload.groupName;
  }

  const result = await db.collection('standings').where(query).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function updateById(recordId, payload) {
  if (!recordId) {
    return { updated: 0 };
  }

  const result = await db.collection('standings').doc(recordId).update({
    data: payload,
  });

  return {
    updated: result && result.stats ? result.stats.updated : 0,
  };
}

exports.main = async (event) => {
  const formData = event && event.formData ? event.formData : {};
  const recordIdFromForm = normalizeOptionalValue(formData.recordId);
  const expectedUpdatedAt = normalizeOptionalValue(formData.updatedAt);

  let payload;
  try {
    payload = buildStandingsPayload(formData);
  } catch (error) {
    return {
      success: false,
      message: error.message || '积分榜格式解析失败。',
    };
  }

  if (!payload.eventId || !payload.tableType || !payload.table.length) {
    return {
      success: false,
      message: '请先填写赛事、榜单类型和积分榜内容。',
    };
  }

  if (payload.tableType === 'group' && !payload.groupName) {
    return {
      success: false,
      message: '小组积分榜必须填写小组名称。',
    };
  }

  let recordId = recordIdFromForm;

  try {
    if (recordId) {
      const currentRecord = await getRecordById(recordId);
      if (!currentRecord) {
        return {
          success: false,
          message: '这条积分榜不存在或已被删除，请重新进入后再编辑。',
        };
      }

      if (isSameStandingsContent(currentRecord, payload)) {
        return {
          success: false,
          message: '内容未发生修改。',
        };
      }

      const currentUpdatedAt = normalizeOptionalValue(currentRecord.updatedAt);
      if (expectedUpdatedAt && currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
        return {
          success: false,
          message: '这条积分榜已被其他管理员更新，请重新打开后再编辑。',
        };
      }

      const updateResult = await updateById(recordId, payload);
      if (!updateResult.updated) {
        const existing = await findExistingRecord(payload);
        if (!existing || !existing._id) {
          return {
            success: false,
            message: `未找到可更新积分榜。编辑记录ID：${recordId || '[空]'}；赛事：${payload.eventId}`,
          };
        }

        recordId = existing._id;
        const fallbackUpdatedAt = normalizeOptionalValue(existing.updatedAt);
        if (expectedUpdatedAt && fallbackUpdatedAt && expectedUpdatedAt !== fallbackUpdatedAt) {
          return {
            success: false,
            message: '这条积分榜已被其他管理员更新，请重新打开后再编辑。',
          };
        }

        if (isSameStandingsContent(existing, payload)) {
          return {
            success: false,
            message: '内容未发生修改。',
          };
        }

        const fallbackResult = await updateById(recordId, payload);
        if (!fallbackResult.updated) {
          return {
            success: false,
            message: `积分榜已定位但更新失败。编辑记录ID：${recordIdFromForm || '[空]'}；回退记录ID：${recordId}`,
          };
        }
      }
    } else {
      const existing = await findExistingRecord(payload);
      if (existing && existing._id) {
        if (isSameStandingsContent(existing, payload)) {
          return {
            success: false,
            message: '内容未发生修改。',
          };
        }

        recordId = existing._id;
        const updateResult = await updateById(recordId, payload);
        if (!updateResult.updated) {
          return {
            success: false,
            message: `通过赛事与榜单类型定位到记录，但更新失败。记录ID：${recordId}`,
          };
        }
      } else {
        const addResult = await db.collection('standings').add({
          data: payload,
        });
        recordId = addResult && addResult._id ? addResult._id : '';
      }
    }

    const savedRecord = await getRecordById(recordId);
    if (!savedRecord) {
      return {
        success: false,
        message: '保存后未能重新读取到积分榜记录。',
      };
    }

    if (!isSameStandingsContent(savedRecord, payload)) {
      return {
        success: false,
        message: '积分榜写入校验失败，请稍后重试。',
      };
    }

    return {
      success: true,
      message: '积分榜保存成功',
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
