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

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeSortOrder(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildNewsPayload(formData) {
  const now = new Date().toISOString();
  return {
    eventId: normalizeOptionalValue(formData.eventId),
    newsId: normalizeOptionalValue(formData.newsId),
    title: normalizeOptionalValue(formData.title),
    summary: normalizeOptionalValue(formData.summary),
    coverImage: normalizeOptionalValue(formData.coverImage),
    publishTime: normalizeOptionalValue(formData.publishTime),
    category: normalizeOptionalValue(formData.category),
    isFeatured: normalizeBoolean(formData.isFeatured),
    isPinned: normalizeBoolean(formData.isPinned),
    sortOrder: normalizeSortOrder(formData.sortOrder),
    content: normalizeOptionalValue(formData.content),
    relatedMatchId: normalizeOptionalValue(formData.relatedMatchId),
    updatedAt: now,
  };
}

function buildComparablePayload(payload) {
  return {
    eventId: payload.eventId || '',
    newsId: payload.newsId || '',
    title: payload.title || '',
    summary: payload.summary || '',
    coverImage: payload.coverImage || '',
    publishTime: payload.publishTime || '',
    category: payload.category || '',
    isFeatured: !!payload.isFeatured,
    isPinned: !!payload.isPinned,
    sortOrder:
      typeof payload.sortOrder === 'number' ? payload.sortOrder : normalizeSortOrder(payload.sortOrder),
    content: payload.content || '',
    relatedMatchId: payload.relatedMatchId || '',
  };
}

function isSameNewsContent(currentRecord, payload) {
  return JSON.stringify(buildComparablePayload(currentRecord || {})) === JSON.stringify(buildComparablePayload(payload));
}

async function getNewsByRecordId(recordId) {
  if (!recordId) {
    return null;
  }

  try {
    const result = await db.collection('news').doc(recordId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

async function findExistingNewsByNewsId(newsId) {
  const result = await db.collection('news').where({ newsId }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function getRelatedMatch(matchId, eventId) {
  if (!matchId) {
    return null;
  }

  const result = await db.collection('matches').where({
    eventId,
    matchId,
  }).limit(1).get();

  return result.data && result.data[0] ? result.data[0] : null;
}

async function updateNewsByRecordId(recordId, payload) {
  if (!recordId) {
    return { updated: 0 };
  }

  const result = await db.collection('news').doc(recordId).update({
    data: payload,
  });

  return {
    updated: result && result.stats ? result.stats.updated : 0,
  };
}

exports.main = async (event) => {
  const formData = event && event.formData ? event.formData : {};
  const payload = buildNewsPayload(formData);
  const recordId = normalizeOptionalValue(formData.recordId);
  const expectedUpdatedAt = normalizeOptionalValue(formData.updatedAt);

  if (!payload.eventId || !payload.newsId || !payload.title || !payload.summary || !payload.publishTime || !payload.category || !payload.content) {
    return {
      success: false,
      message: '请先填写新闻编号、标题、摘要、发布时间、分类和正文。',
    };
  }

  try {
    if (payload.relatedMatchId) {
      const relatedMatch = await getRelatedMatch(payload.relatedMatchId, payload.eventId);
      if (!relatedMatch) {
        return {
          success: false,
          message: '所选关联比赛不存在，请重新选择后再保存。',
        };
      }
    }

    const existingByNewsId = await findExistingNewsByNewsId(payload.newsId);

    if (recordId) {
      const currentRecord = await getNewsByRecordId(recordId);
      if (!currentRecord) {
        return {
          success: false,
          message: '这条新闻不存在或已被删除，请重新进入后再编辑。',
        };
      }

      if (existingByNewsId && existingByNewsId._id !== recordId) {
        return {
          success: false,
          message: `新闻编号重复：${payload.newsId} 已被另一篇新闻使用，请更换编号。`,
        };
      }

      if (isSameNewsContent(currentRecord, payload)) {
        return {
          success: false,
          message: '内容未发生修改。',
        };
      }

      const currentUpdatedAt = normalizeOptionalValue(currentRecord.updatedAt);
      if (expectedUpdatedAt && currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
        return {
          success: false,
          message: '这条新闻已被其他管理员更新，请重新打开后再编辑。',
        };
      }

      const updateResult = await updateNewsByRecordId(recordId, payload);
      if (!updateResult.updated) {
        return {
          success: false,
          message: '新闻记录未能更新，请稍后重试。',
        };
      }
    } else {
      if (existingByNewsId) {
        return {
          success: false,
          message: `新闻编号重复：${payload.newsId} 已存在，请使用新的新闻编号。`,
        };
      }

      const addResult = await db.collection('news').add({
        data: payload,
      });

      if (!addResult || !addResult._id) {
        return {
          success: false,
          message: '新闻新增失败，请稍后重试。',
        };
      }

      const savedRecord = await getNewsByRecordId(addResult._id);
      return {
        success: true,
        message: '新闻保存成功',
        data: savedRecord || {
          ...payload,
          _id: addResult._id,
        },
      };
    }

    const savedRecord = await getNewsByRecordId(recordId);
    if (!savedRecord) {
      return {
        success: false,
        message: '保存后未能重新读取到新闻记录。',
      };
    }

    if ((savedRecord.content || '') !== payload.content) {
      return {
        success: false,
        message: '新闻正文写入校验失败，请稍后重试。',
      };
    }

    return {
      success: true,
      message: '新闻保存成功',
      data: savedRecord,
    };
  } catch (error) {
    return {
      success: false,
      message: error && error.message ? error.message : '云函数执行失败，请稍后重试。',
    };
  }
};
