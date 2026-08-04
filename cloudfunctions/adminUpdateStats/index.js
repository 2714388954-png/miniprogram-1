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

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'player';
}

function splitLine(line) {
  return String(line || '')
    .split(/[，,]/)
    .map((item) => item.trim());
}

function parseScorerValue(rawValue) {
  const normalized = String(rawValue || '').trim();
  const matched = normalized.match(/^(\d+)(?:\((\d+)\))?$/);

  if (!matched) {
    throw new Error('射手榜数值格式应为 5 或 5(1)');
  }

  return {
    displayValue: matched[2] !== undefined ? `${matched[1]}(${matched[2]})` : matched[1],
    totalGoals: Number(matched[1]) || 0,
    penaltyGoals: matched[2] !== undefined ? Number(matched[2]) || 0 : 0,
    hasPenalty: matched[2] !== undefined,
  };
}

function buildStatValue(rawValue, statType, lineIndex) {
  if (statType === 'scorers') {
    try {
      return parseScorerValue(rawValue).displayValue;
    } catch (error) {
      throw new Error(`第 ${lineIndex + 1} 行射手榜数值格式错误，请写成 5 或 5(1)。`);
    }
  }

  const numericValue = Number(rawValue);
  if (Number.isNaN(numericValue)) {
    throw new Error(`第 ${lineIndex + 1} 行格式不正确，请按“姓名，球队，数值”填写。`);
  }

  return numericValue;
}

function getSortMeta(item = {}, statType) {
  if (statType === 'scorers') {
    return parseScorerValue(item.value);
  }

  return {
    displayValue: item.value,
    totalGoals: Number(item.value) || 0,
    penaltyGoals: 0,
    hasPenalty: false,
  };
}

function isSameRankMeta(metaA, metaB, statType) {
  if (!metaA || !metaB) {
    return false;
  }

  if (metaA.totalGoals !== metaB.totalGoals) {
    return false;
  }

  if (statType === 'scorers') {
    return (
      metaA.hasPenalty === metaB.hasPenalty &&
      metaA.penaltyGoals === metaB.penaltyGoals
    );
  }

  return true;
}

function sortStatsList(list, statType) {
  const sortedRows = (list || [])
    .slice()
    .sort((a, b) => {
      const metaA = getSortMeta(a, statType);
      const metaB = getSortMeta(b, statType);

      const primaryDiff = metaB.totalGoals - metaA.totalGoals;
      if (primaryDiff !== 0) {
        return primaryDiff;
      }

      if (statType === 'scorers') {
        if (metaA.hasPenalty !== metaB.hasPenalty) {
          return metaA.hasPenalty ? 1 : -1;
        }

        const penaltyDiff = metaB.penaltyGoals - metaA.penaltyGoals;
        if (penaltyDiff !== 0) {
          return penaltyDiff;
        }
      }

      return (a.rank || 0) - (b.rank || 0);
    });

  let previousMeta = null;

  return sortedRows.map((item, index) => {
    const meta = getSortMeta(item, statType);
    const nextRank = index === 0 || !isSameRankMeta(meta, previousMeta, statType) ? index + 1 : previousMeta.rank;

    previousMeta = {
      ...meta,
      rank: nextRank,
    };

    return {
      ...item,
      rank: nextRank,
    };
  });
}

function parseStatsText(listText, statType) {
  const rows = String(listText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const parsedRows = rows.map((line, index) => {
    const columns = splitLine(line);
    if (columns.length < 3) {
      throw new Error(`第 ${index + 1} 行格式不完整，请按“姓名，球队，数值”填写。`);
    }

    const [playerName, teamName, rawValue] = columns;
    if (!playerName || !teamName) {
      throw new Error(`第 ${index + 1} 行格式不正确，请按“姓名，球队，数值”填写。`);
    }

    return {
      playerId: `${statType}-${slugify(teamName)}-${slugify(playerName)}-${index + 1}`,
      playerName,
      teamName,
      value: buildStatValue(rawValue, statType, index),
      rank: index + 1,
    };
  });

  return sortStatsList(parsedRows, statType);
}

function buildStatsPayload(formData) {
  const eventId = normalizeOptionalValue(formData.eventId);
  const statType = normalizeOptionalValue(formData.statType) || 'scorers';
  const listText = normalizeOptionalValue(formData.listText);
  const list = parseStatsText(listText, statType);

  return {
    eventId,
    statType,
    list,
    updatedAt: new Date().toISOString(),
  };
}

function buildComparablePayload(payload) {
  return {
    eventId: payload.eventId || '',
    statType: payload.statType || '',
    list: payload.list || [],
  };
}

function isSameStatsContent(currentRecord, payload) {
  return JSON.stringify(buildComparablePayload(currentRecord || {})) === JSON.stringify(buildComparablePayload(payload));
}

async function getRecordById(recordId) {
  if (!recordId) {
    return null;
  }

  try {
    const result = await db.collection('stats').doc(recordId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

async function findExistingRecord(payload) {
  const result = await db
    .collection('stats')
    .where({
      eventId: payload.eventId,
      statType: payload.statType,
    })
    .limit(1)
    .get();

  return result.data && result.data[0] ? result.data[0] : null;
}

async function updateById(recordId, payload) {
  if (!recordId) {
    return { updated: 0 };
  }

  const result = await db.collection('stats').doc(recordId).update({
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
    payload = buildStatsPayload(formData);
  } catch (error) {
    return {
      success: false,
      message: error.message || '数据榜格式解析失败。',
    };
  }

  if (!payload.eventId || !payload.statType) {
    return {
      success: false,
      message: '请先选择赛事和榜单类型。',
    };
  }

  let recordId = recordIdFromForm;

  try {
    if (recordId) {
      const currentRecord = await getRecordById(recordId);
      if (!currentRecord) {
        return {
          success: false,
          message: '这条数据榜记录不存在或已被删除，请重新进入编辑后再试一次。',
        };
      }

      if (isSameStatsContent(currentRecord, payload)) {
        return {
          success: false,
          message: '内容未发生修改',
        };
      }

      const currentUpdatedAt = normalizeOptionalValue(currentRecord.updatedAt);
      if (expectedUpdatedAt && currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
        return {
          success: false,
          message: '这条数据榜已被其他管理员更新，请重新打开后再编辑。',
        };
      }

      const updateResult = await updateById(recordId, payload);
      if (!updateResult.updated) {
        const existing = await findExistingRecord(payload);
        if (!existing || !existing._id) {
          return {
            success: false,
            message: '未找到可更新的数据榜记录，请稍后重试。',
          };
        }

        recordId = existing._id;
        if (isSameStatsContent(existing, payload)) {
          return {
            success: false,
            message: '内容未发生修改',
          };
        }

        const fallbackUpdatedAt = normalizeOptionalValue(existing.updatedAt);
        if (expectedUpdatedAt && fallbackUpdatedAt && expectedUpdatedAt !== fallbackUpdatedAt) {
          return {
            success: false,
            message: '这条数据榜已被其他管理员更新，请重新打开后再编辑。',
          };
        }

        const fallbackResult = await updateById(recordId, payload);
        if (!fallbackResult.updated) {
          return {
            success: false,
            message: '数据榜定位成功，但更新失败，请稍后重试。',
          };
        }
      }
    } else {
      const existing = await findExistingRecord(payload);
      if (existing && existing._id) {
        if (isSameStatsContent(existing, payload)) {
          return {
            success: false,
            message: '内容未发生修改',
          };
        }

        recordId = existing._id;
        const updateResult = await updateById(recordId, payload);
        if (!updateResult.updated) {
          return {
            success: false,
            message: '已找到原有数据榜，但更新失败，请稍后重试。',
          };
        }
      } else {
        const addResult = await db.collection('stats').add({
          data: payload,
        });
        recordId = addResult && addResult._id ? addResult._id : '';
      }
    }

    const savedRecord = await getRecordById(recordId);
    if (!savedRecord) {
      return {
        success: false,
        message: '保存后未能重新读取到数据榜记录。',
      };
    }

    if (!isSameStatsContent(savedRecord, payload)) {
      return {
        success: false,
        message: '数据榜写入校验失败，请稍后重试。',
      };
    }

    return {
      success: true,
      message: '数据榜保存成功',
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
