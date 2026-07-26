const {
  getEvents,
  getDefaultEventId,
  getEventById,
  getEventOverview,
  getGroupedMatchesByEvent,
} = require('../../data/index');

Page({
  data: {
    events: [],
    activeEventId: '',
    currentEvent: null,
    overview: null,
    stageGroups: [],
    selectedMatch: null,
    showMatchDetail: false,
  },

  onLoad() {
    const events = getEvents();
    const activeEventId = getDefaultEventId();
    this.syncPage(events, activeEventId);
  },

  syncPage(events, eventId) {
    this.setData({
      events,
      activeEventId: eventId,
      currentEvent: getEventById(eventId),
      overview: getEventOverview(eventId),
      stageGroups: getGroupedMatchesByEvent(eventId),
      selectedMatch: null,
      showMatchDetail: false,
    });
  },

  handleEventSwitch(event) {
    const { eventId } = event.currentTarget.dataset;
    if (!eventId || eventId === this.data.activeEventId) {
      return;
    }

    this.syncPage(this.data.events, eventId);
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
