const contentService = require('../../services/content-service');

function splitEvents(events) {
  const currentEvents = [];
  const historyEvents = [];

  (events || []).forEach((item) => {
    if (item.status === 'finished') {
      historyEvents.push(item);
      return;
    }

    currentEvents.push(item);
  });

  return {
    currentEvents,
    historyEvents,
  };
}

function findEventIndex(events, eventId) {
  const index = (events || []).findIndex((item) => item.eventId === eventId);
  return index >= 0 ? index : 0;
}

function getInitialEventId(currentEvents, historyEvents) {
  if (currentEvents[0]) {
    return currentEvents[0].eventId;
  }

  return historyEvents[0] ? historyEvents[0].eventId : '';
}

Page({
  data: {
    allEvents: [],
    currentEvents: [],
    historyEvents: [],
    activeEventId: '',
    currentEventIndex: 0,
    historyEventIndex: 0,
    eventGroupType: 'current',
    currentEvent: null,
    overview: null,
    stageGroups: [],
    selectedMatch: null,
    showMatchDetail: false,
    isLoading: true,
  },

  hasLoaded: false,

  async onLoad() {
    this.setData({ isLoading: true });
    try {
      const events = await contentService.getEvents();
      const { currentEvents, historyEvents } = splitEvents(events);
      const activeEventId = getInitialEventId(currentEvents, historyEvents);

      this.setData({
        allEvents: events,
        currentEvents,
        historyEvents,
        activeEventId,
        currentEventIndex: 0,
        historyEventIndex: 0,
        eventGroupType: currentEvents.length ? 'current' : 'history',
      });

      if (activeEventId) {
        await this.syncPage(events, activeEventId);
      }

      this.hasLoaded = true;
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async onShow() {
    if (!this.hasLoaded) {
      return;
    }

    contentService.clearCache();
    const events = await contentService.getEvents();
    const { currentEvents, historyEvents } = splitEvents(events);
    const stillExists = events.some((item) => item.eventId === this.data.activeEventId);
    const activeEventId = stillExists
      ? this.data.activeEventId
      : getInitialEventId(currentEvents, historyEvents);

    this.setData({
      allEvents: events,
      currentEvents,
      historyEvents,
      activeEventId,
      currentEventIndex: findEventIndex(currentEvents, activeEventId),
      historyEventIndex: findEventIndex(historyEvents, activeEventId),
      eventGroupType: historyEvents.some((item) => item.eventId === activeEventId) ? 'history' : 'current',
    });

    if (activeEventId) {
      await this.syncPage(events, activeEventId);
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
        allEvents: events,
        activeEventId: eventId,
        currentEvent,
        overview,
        stageGroups,
        selectedMatch: null,
        showMatchDetail: false,
        currentEventIndex: findEventIndex(this.data.currentEvents, eventId),
        historyEventIndex: findEventIndex(this.data.historyEvents, eventId),
        eventGroupType: currentEvent && currentEvent.status === 'finished' ? 'history' : 'current',
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async handleCurrentEventChange(event) {
    const nextIndex = Number(event.detail.value);
    const targetEvent = this.data.currentEvents[nextIndex];
    if (!targetEvent || targetEvent.eventId === this.data.activeEventId) {
      return;
    }

    this.setData({
      currentEventIndex: nextIndex,
      eventGroupType: 'current',
    });
    await this.syncPage(this.data.allEvents, targetEvent.eventId);
  },

  async handleHistoryEventChange(event) {
    const nextIndex = Number(event.detail.value);
    const targetEvent = this.data.historyEvents[nextIndex];
    if (!targetEvent || targetEvent.eventId === this.data.activeEventId) {
      return;
    }

    this.setData({
      historyEventIndex: nextIndex,
      eventGroupType: 'history',
    });
    await this.syncPage(this.data.allEvents, targetEvent.eventId);
  },

  handleMatchOpen(event) {
    const { matchId, recordId } = event.currentTarget.dataset;
    const match = this.findMatch(recordId, matchId);
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

  findMatch(recordId, matchId) {
    const { stageGroups } = this.data;
    for (let i = 0; i < stageGroups.length; i += 1) {
      const target = stageGroups[i].matches.find((item) => {
        if (recordId && item._id) {
          return item._id === recordId;
        }
        return item.matchId === matchId;
      });
      if (target) {
        return target;
      }
    }
    return null;
  },
});
