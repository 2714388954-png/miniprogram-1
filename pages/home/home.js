const contentService = require('../../services/content-service');

Page({
  data: {
    events: [],
    activeEventId: '',
    currentEvent: null,
    overview: null,
    featuredNews: [],
    newsList: [],
  },

  async onLoad() {
    const events = await contentService.getEvents();
    const activeEventId = await contentService.getDefaultEventId();
    this.setData({ events, activeEventId });
    await this.syncEventContent(activeEventId);
  },

  async syncEventContent(eventId) {
    const [currentEvent, overview, featuredNews, newsList] = await Promise.all([
      contentService.getEventById(eventId),
      contentService.getEventOverview(eventId),
      contentService.getFeaturedNews(eventId),
      contentService.getNewsByEvent(eventId),
    ]);

    this.setData({
      activeEventId: eventId,
      currentEvent,
      overview,
      featuredNews,
      newsList,
    });
  },

  async handleEventSwitch(event) {
    const { eventId } = event.currentTarget.dataset;
    if (!eventId || eventId === this.data.activeEventId) {
      return;
    }
    await this.syncEventContent(eventId);
  },

  openNewsDetail(event) {
    const { newsId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/news-detail/news-detail?newsId=${newsId}`,
    });
  },
});
