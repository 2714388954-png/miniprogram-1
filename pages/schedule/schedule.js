const contentService = require('../../services/content-service');

Page({
  data: {
    events: [],
    activeEventId: '',
    currentEvent: null,
    overview: null,
    stageGroups: [],
    selectedMatch: null,
    showMatchDetail: false,
    isLoading: true,
  },

  async onLoad() {
    this.setData({ isLoading: true });
    try {
      const events = await contentService.getEvents();
      const activeEventId = await contentService.getDefaultEventId();
      await this.syncPage(events, activeEventId);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async syncPage(events, eventId) {
    this.setData({ isLoading: true });
    try {
      const [currentEvent, overview, stageGroups] = await Promise.all([
        contentService.getEventById(eventId),
        contentService.getEventOverview(eventId),
        contentService.getGroupedMatchesByEvent(eventId),
      ]);

      this.setData({
        events,
        activeEventId: eventId,
        currentEvent,
        overview,
        stageGroups,
        selectedMatch: null,
        showMatchDetail: false,
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

    await this.syncPage(this.data.events, eventId);
  },

  handleMatchOpen(event) {
    const { matchId } = event.currentTarget.dataset;
    const match = this.findMatchById(matchId);
    if (!match) {
      return;
    }

    this.setData({
      selectedMatch: match,
      showMatchDetail: true,
    });
  },

  handleMatchClose() {
    this.setData({
      showMatchDetail: false,
    });
  },

  handleReportOpen() {
    const { selectedMatch } = this.data;
    if (!selectedMatch || !selectedMatch.reportNewsId) {
      return;
    }

    wx.navigateTo({
      url: `/pages/news-detail/news-detail?newsId=${selectedMatch.reportNewsId}`,
    });
  },

  stopOverlayScroll() {},

  findMatchById(matchId) {
    const { stageGroups } = this.data;
    for (let i = 0; i < stageGroups.length; i += 1) {
      const target = stageGroups[i].matches.find((item) => item.matchId === matchId);
      if (target) {
        return target;
      }
    }
    return null;
  },
});
