const cloudConfig = require('../config/cloud');
const localContentService = require('./local-content-service');
const cloudContentService = require('./cloud-content-service');

const cacheStore = new Map();

function shouldUseCloud() {
  if (!cloudConfig.enabled || typeof getApp !== 'function') {
    return false;
  }

  const app = getApp();
  return app && app.globalData && app.globalData.dataSource === 'cloud';
}

function getDataSourceKey() {
  return shouldUseCloud() ? 'cloud' : 'local';
}

function buildCacheKey(methodName, args) {
  return `${getDataSourceKey()}:${methodName}:${JSON.stringify(args || [])}`;
}

async function call(methodName, ...args) {
  const cacheKey = buildCacheKey(methodName, args);
  if (cacheStore.has(cacheKey)) {
    return cacheStore.get(cacheKey);
  }

  const pendingRequest = (async () => {
    if (!shouldUseCloud()) {
      return localContentService[methodName](...args);
    }

    try {
      return await cloudContentService[methodName](...args);
    } catch (error) {
      console.warn(`Cloud content service failed: ${methodName}. Fallback to local data.`, error);
      return localContentService[methodName](...args);
    }
  })();

  cacheStore.set(cacheKey, pendingRequest);

  try {
    const result = await pendingRequest;
    cacheStore.set(cacheKey, Promise.resolve(result));
    return result;
  } catch (error) {
    cacheStore.delete(cacheKey);
    throw error;
  }
}

const service = {
  getEvents() {
    return call('getEvents');
  },

  getDefaultEventId() {
    return call('getDefaultEventId');
  },

  getEventById(eventId) {
    return call('getEventById', eventId);
  },

  getEventOverview(eventId) {
    return call('getEventOverview', eventId);
  },

  getFeaturedNews(eventId) {
    return call('getFeaturedNews', eventId);
  },

  getNewsByEvent(eventId) {
    return call('getNewsByEvent', eventId);
  },

  getNewsById(newsId) {
    return call('getNewsById', newsId);
  },

  getGroupedMatchesByEvent(eventId) {
    return call('getGroupedMatchesByEvent', eventId);
  },

  getStandingsByEvent(eventId) {
    return call('getStandingsByEvent', eventId);
  },

  getStatsByEvent(eventId) {
    return call('getStatsByEvent', eventId);
  },

  clearCache() {
    cacheStore.clear();
  },
};

module.exports = service;
