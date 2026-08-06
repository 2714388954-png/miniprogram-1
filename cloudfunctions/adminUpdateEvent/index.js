const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

function normalizeOptionalValue(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function normalizeSortOrder(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeEventType(value) {
  return value === 'cup' ? 'cup' : 'league';
}

function normalizeEventStatus(value) {
  if (value === 'ongoing' || value === 'finished') {
    return value;
  }
  return 'upcoming';
}

function normalizeDisplayMode(value) {
  return value === 'knockout' ? 'knockout' : 'group';
}

function buildEventPayload(formData) {
  const now = new Date().toISOString();
  const eventType = normalizeEventType(formData.eventType);
  return {
    eventId: normalizeOptionalValue(formData.eventId),
    eventName: normalizeOptionalValue(formData.eventName),
    fullName: normalizeOptionalValue(formData.fullName),
    eventType,
    season: normalizeOptionalValue(formData.season),
    coverImage: normalizeOptionalValue(formData.coverImage),
    description: normalizeOptionalValue(formData.description),
    status: normalizeEventStatus(formData.status),
    sortOrder: normalizeSortOrder(formData.sortOrder),
    cupDisplayMode: eventType === 'cup' ? normalizeDisplayMode(formData.cupDisplayMode) : 'group',
    updatedAt: now,
  };
}

function buildComparablePayload(payload) {
  return {
    eventId: payload.eventId || '',
    eventName: payload.eventName || '',
    fullName: payload.fullName || '',
    eventType: normalizeEventType(payload.eventType),
    season: payload.season || '',
    coverImage: payload.coverImage || '',
    description: payload.description || '',
    status: normalizeEventStatus(payload.status),
    sortOrder: typeof payload.sortOrder === 'number' ? payload.sortOrder : normalizeSortOrder(payload.sortOrder),
    cupDisplayMode: normalizeDisplayMode(payload.cupDisplayMode),
  };
}

function isSameEventContent(currentRecord, payload) {
  return JSON.stringify(buildComparablePayload(currentRecord || {})) === JSON.stringify(buildComparablePayload(payload));
}

async function getEventByRecordId(recordId) {
  if (!recordId) {
    return null;
  }

  try {
    const result = await db.collection('events').doc(recordId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

async function findExistingEventByEventId(eventId) {
  const result = await db.collection('events').where({ eventId }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function updateEventByRecordId(recordId, payload) {
  const result = await db.collection('events').doc(recordId).update({
    data: payload,
  });

  return {
    updated: result && result.stats ? result.stats.updated : 0,
  };
}

exports.main = async (event) => {
  const formData = event && event.formData ? event.formData : {};
  const payload = buildEventPayload(formData);
  const recordId = normalizeOptionalValue(formData.recordId);
  const expectedUpdatedAt = normalizeOptionalValue(formData.updatedAt);

  if (!payload.eventId || !payload.eventName || !payload.fullName || !payload.season) {
    return {
      success: false,
      message: '请先填写赛事编号、赛事简称、赛事全称和赛季。',
    };
  }

  try {
    const existingByEventId = await findExistingEventByEventId(payload.eventId);

    if (recordId) {
      const currentRecord = await getEventByRecordId(recordId);
      if (!currentRecord) {
        return {
          success: false,
          message: '这条赛事记录不存在或已被删除，请重新进入后再编辑。',
        };
      }

      if (existingByEventId && existingByEventId._id !== recordId) {
        return {
          success: false,
          message: `赛事编号重复：${payload.eventId} 已被另一条赛事使用，请更换编号。`,
        };
      }

      if (isSameEventContent(currentRecord, payload)) {
        return {
          success: false,
          message: '内容未发生修改。',
        };
      }

      const currentUpdatedAt = normalizeOptionalValue(currentRecord.updatedAt);
      if (expectedUpdatedAt && currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
        return {
          success: false,
          message: '这条赛事已被其他管理员更新，请重新打开后再编辑。',
        };
      }

      const updateResult = await updateEventByRecordId(recordId, payload);
      if (!updateResult.updated) {
        return {
          success: false,
          message: '赛事记录未能更新，请稍后重试。',
        };
      }
    } else {
      if (existingByEventId) {
        return {
          success: false,
          message: `赛事编号重复：${payload.eventId} 已存在，请使用新的赛事编号。`,
        };
      }

      const addResult = await db.collection('events').add({
        data: payload,
      });

      if (!addResult || !addResult._id) {
        return {
          success: false,
          message: '赛事新增失败，请稍后重试。',
        };
      }

      const savedRecord = await getEventByRecordId(addResult._id);
      return {
        success: true,
        message: '赛事保存成功',
        data: savedRecord || {
          ...payload,
          _id: addResult._id,
        },
      };
    }

    const savedRecord = await getEventByRecordId(recordId);
    if (!savedRecord) {
      return {
        success: false,
        message: '保存后未能重新读取到赛事记录。',
      };
    }

    if ((savedRecord.eventName || '') !== payload.eventName) {
      return {
        success: false,
        message: '赛事名称写入校验失败，请稍后重试。',
      };
    }

    return {
      success: true,
      message: '赛事保存成功',
      data: savedRecord,
    };
  } catch (error) {
    return {
      success: false,
      message: error && error.message ? error.message : '云函数执行失败，请稍后重试。',
    };
  }
};
