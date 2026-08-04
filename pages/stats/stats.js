const contentService = require('../../services/content-service');

const statTabs = [
  { key: 'scorers', label: '进球榜', unit: '球', columnLabel: '进球数' },
  { key: 'assists', label: '助攻榜', unit: '次', columnLabel: '助攻数' },
  { key: 'yellowCards', label: '黄牌榜', unit: '张', columnLabel: '黄牌数' },
  { key: 'redCards', label: '红牌榜', unit: '张', columnLabel: '红牌数' },
];

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
    currentEvent: null,
    overview: null,
    activeStatKey: 'scorers',
    statTabs,
    statRows: [],
    statUnit: '球',
    statColumnLabel: '进球数',
    currentEventIndex: 0,
    historyEventIndex: 0,
    eventGroupType: 'current',
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
        await this.syncStats(activeEventId, 'scorers');
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
    const eventGroupType =
      historyEvents.some((item) => item.eventId === activeEventId) && !currentEvents.some((item) => item.eventId === activeEventId)
        ? 'history'
        : 'current';

    this.setData({
      allEvents: events,
      currentEvents,
      historyEvents,
      activeEventId,
      currentEventIndex: findEventIndex(currentEvents, activeEventId),
      historyEventIndex: findEventIndex(historyEvents, activeEventId),
      eventGroupType,
    });

    if (activeEventId) {
      await this.syncStats(activeEventId, this.data.activeStatKey || 'scorers');
    }
  },

  async syncStats(eventId, statKey) {
    this.setData({ isLoading: true });
    try {
      const stats = await contentService.getStatsByEvent(eventId);
      const activeTab = statTabs.find((item) => item.key === statKey) || statTabs[0];
      const [currentEvent, overview] = await Promise.all([
        contentService.getEventById(eventId),
        contentService.getEventOverview(eventId),
      ]);

      this.setData({
        activeEventId: eventId,
        currentEvent,
        overview,
        activeStatKey: activeTab.key,
        statRows: stats[activeTab.key] || [],
        statUnit: activeTab.unit,
        statColumnLabel: activeTab.columnLabel,
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
    await this.syncStats(targetEvent.eventId, this.data.activeStatKey);
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
    await this.syncStats(targetEvent.eventId, this.data.activeStatKey);
  },

  async handleStatSwitch(event) {
    const { statKey } = event.currentTarget.dataset;
    if (!statKey || statKey === this.data.activeStatKey) {
      return;
    }

    await this.syncStats(this.data.activeEventId, statKey);
  },
});
