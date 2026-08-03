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

async function findExistingNews(eventId, newsId) {
  const result = await db.collection('news').where({
    eventId,
    newsId,
  }).limit(1).get();

  return result.data && result.data[0] ? result.data[0] : null;
}

exports.main = async (event) => {
  const recordId = normalizeOptionalValue(event && event.recordId);
  const eventId = normalizeOptionalValue(event && event.eventId);
  const newsId = normalizeOptionalValue(event && event.newsId);

  try {
    let target = await getNewsByRecordId(recordId);
    if (!target && eventId && newsId) {
      target = await findExistingNews(eventId, newsId);
    }

    if (!target || !target._id) {
      return {
        success: false,
        message: '未找到要删除的新闻记录。',
      };
    }

    await db.collection('news').doc(target._id).remove();

    return {
      success: true,
      message: '新闻已删除',
      data: {
        recordId: target._id,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error && error.message ? error.message : '删除新闻失败，请稍后重试。',
    };
  }
};
