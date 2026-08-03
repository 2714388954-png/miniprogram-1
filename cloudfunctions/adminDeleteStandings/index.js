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

async function findExistingRecord(eventId, tableType, groupName) {
  const query = {
    eventId,
    tableType,
  };

  if (tableType === 'group') {
    query.groupName = groupName;
  }

  const result = await db.collection('standings').where(query).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

exports.main = async (event) => {
  const recordId = normalizeOptionalValue(event && event.recordId);
  const eventId = normalizeOptionalValue(event && event.eventId);
  const tableType = normalizeOptionalValue(event && event.tableType);
  const groupName = normalizeOptionalValue(event && event.groupName);

  try {
    let target = await getRecordById(recordId);
    if (!target && eventId && tableType) {
      target = await findExistingRecord(eventId, tableType, groupName);
    }

    if (!target || !target._id) {
      return {
        success: false,
        message: '未找到要删除的积分榜记录。',
      };
    }

    await db.collection('standings').doc(target._id).remove();

    return {
      success: true,
      message: '积分榜已删除',
      data: {
        recordId: target._id,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error && error.message ? error.message : '删除积分榜失败，请稍后重试。',
    };
  }
};
