const {
  getEvents,
  getDefaultEventId,
  getEventById,
  getFeaturedNews,
  getNewsByEvent,
} = require('../../data/index');

Page({
  data: {
    events: [],
    activeEventId: '',
    currentEvent: null,
    featuredNews: [],
    newsList: [],
  },

  onLoad() {
    const events = getEvents();
    const activeEventId = getDefaultEventId();
    this.setData({ events, activeEventId });
    this.syncEventContent(activeEventId);
  },

  syncEventContent(eventId) {
    const currentEvent = getEventById(eventId);
    const featuredNews = getFeaturedNews(eventId);
    const newsList = getNewsByEvent(eventId);

    this.setData({
      activeEventId: eventId,
      currentEvent,
      featuredNews,
      newsList,
    });
  },

  handleEventSwitch(event) {
    const { eventId } = event.currentTarget.dataset;
    if (!eventId || eventId === this.data.activeEventId) {
      return;
    }
    this.syncEventContent(eventId);
  },

  openNewsDetail(event) {
    const { newsId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/news-detail/news-detail?newsId=${newsId}`,
    });
  },
});
