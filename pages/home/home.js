const contentService = require('../../services/content-service');
const adminService = require('../../services/admin-service');

Page({
  data: {
    events: [],
    activeEventId: '',
    currentEvent: null,
    overview: null,
    featuredNews: [],
    newsList: [],
    isLoading: true,
  },

  hasLoaded: false,

  async onLoad() {
    await this.reloadPageData();
    this.hasLoaded = true;
  },

  async onShow() {
    if (!this.hasLoaded) {
      return;
    }

    contentService.clearCache();
    await this.reloadCurrentEvent();
  },

  async onPullDownRefresh() {
    try {
      contentService.clearCache();
      await this.reloadPageData();
      wx.showToast({
        title: '内容已刷新',
        icon: 'success',
      });
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async reloadPageData() {
    this.setData({ isLoading: true });
    try {
      const events = await contentService.getEvents();
      const activeEventId = await contentService.getDefaultEventId();
      this.setData({ events, activeEventId });
      await this.syncEventContent(activeEventId);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async reloadCurrentEvent() {
    const eventId = this.data.activeEventId || await contentService.getDefaultEventId();
    const events = this.data.events && this.data.events.length
      ? this.data.events
      : await contentService.getEvents();

    this.setData({ events });
    await this.syncEventContent(eventId);
  },

  async syncEventContent(eventId) {
    this.setData({ isLoading: true });
    try {
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
    } finally {
      this.setData({ isLoading: false });
    }
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

  openAdminEntry() {
    const target = adminService.isLoggedIn() ? '/pages/admin-home/admin-home' : '/pages/admin-login/admin-login';
    wx.navigateTo({ url: target });
  },
});
