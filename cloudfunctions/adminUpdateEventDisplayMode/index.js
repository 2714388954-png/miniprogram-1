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

function normalizeDisplayMode(value) {
  return value === 'knockout' ? 'knockout' : 'group';
}

function buildComparablePayload(record) {
  return {
    cupDisplayMode: normalizeDisplayMode(record && record.cupDisplayMode),
  };
}

function isSameDisplayMode(currentRecord, nextPayload) {
  return JSON.stringify(buildComparablePayload(currentRecord)) === JSON.stringify(buildComparablePayload(nextPayload));
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

async function getEventByEventId(eventId) {
  const result = await db.collection('events').where({ eventId }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

exports.main = async (event) => {
  const eventId = normalizeOptionalValue(event && event.eventId);
  const recordId = normalizeOptionalValue(event && event.recordId);
  const expectedUpdatedAt = normalizeOptionalValue(event && event.updatedAt);
  const cupDisplayMode = normalizeDisplayMode(event && event.cupDisplayMode);

  if (!eventId) {
    return {
      success: false,
      message: '缺少赛事编号，无法保存显示顺序。',
    };
  }

  try {
    let currentRecord = await getEventByRecordId(recordId);
    if (!currentRecord) {
      currentRecord = await getEventByEventId(eventId);
    }

    if (!currentRecord || !currentRecord._id) {
      return {
        success: false,
        message: '未找到该赛事记录，请稍后重试。',
      };
    }

    if (isSameDisplayMode(currentRecord, { cupDisplayMode })) {
      return {
        success: false,
        message: '内容未发生修改。',
      };
    }

    const currentUpdatedAt = normalizeOptionalValue(currentRecord.updatedAt);
    if (expectedUpdatedAt && currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
      return {
        success: false,
        message: '该赛事已被其他管理员更新，请重新打开后再设置。',
      };
    }

    const updatedAt = new Date().toISOString();
    const updateResult = await db.collection('events').doc(currentRecord._id).update({
      data: {
        cupDisplayMode,
        updatedAt,
      },
    });

    if (!updateResult || !updateResult.stats || !updateResult.stats.updated) {
      return {
        success: false,
        message: '赛事显示顺序更新失败，请稍后重试。',
      };
    }

    const savedRecord = await getEventByRecordId(currentRecord._id);
    if (!savedRecord || normalizeDisplayMode(savedRecord.cupDisplayMode) !== cupDisplayMode) {
      return {
        success: false,
        message: '显示顺序写入校验失败，请稍后重试。',
      };
    }

    return {
      success: true,
      message: '显示顺序保存成功',
      data: savedRecord,
    };
  } catch (error) {
    return {
      success: false,
      message: error && error.message ? error.message : '云函数执行失败，请稍后重试。',
    };
  }
};
