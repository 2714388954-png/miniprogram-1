const localContentService = require('./local-content-service');

const service = {
  async getEvents() {
    return localContentService.getEvents();
  },

  async getDefaultEventId() {
    return localContentService.getDefaultEventId();
  },

  async getEventById(eventId) {
    return localContentService.getEventById(eventId);
  },

  async getEventOverview(eventId) {
    return localContentService.getEventOverview(eventId);
  },

  async getFeaturedNews(eventId) {
    return localContentService.getFeaturedNews(eventId);
  },

  async getNewsByEvent(eventId) {
    return localContentService.getNewsByEvent(eventId);
  },

  async getNewsById(newsId) {
    return localContentService.getNewsById(newsId);
  },

  async getGroupedMatchesByEvent(eventId) {
    return localContentService.getGroupedMatchesByEvent(eventId);
  },

  async getStandingsByEvent(eventId) {
    return localContentService.getStandingsByEvent(eventId);
  },

  async getStatsByEvent(eventId) {
    return localContentService.getStatsByEvent(eventId);
  },
};

module.exports = service;
