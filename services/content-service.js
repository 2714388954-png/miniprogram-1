const cloudConfig = require('../config/cloud');
const localContentService = require('./local-content-service');
const cloudContentService = require('./cloud-content-service');

function shouldUseCloud() {
  if (!cloudConfig.enabled || typeof getApp !== 'function') {
    return false;
  }

  const app = getApp();
  return app && app.globalData && app.globalData.dataSource === 'cloud';
}

async function call(methodName, ...args) {
  if (!shouldUseCloud()) {
    return localContentService[methodName](...args);
  }

  try {
    return await cloudContentService[methodName](...args);
  } catch (error) {
    console.warn(`Cloud content service failed: ${methodName}. Fallback to local data.`, error);
    return localContentService[methodName](...args);
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
};

module.exports = service;
