const contentService = require('../../services/content-service');

const knockoutStageKeywords = ['16进', '8进', '半决赛', '三四名决赛', '决赛'];

function isKnockoutStage(stageName = '') {
  return knockoutStageKeywords.some((keyword) => stageName.indexOf(keyword) !== -1);
}

function getCupDisplayMode(currentEvent, knockoutStages) {
  if (currentEvent && (currentEvent.cupDisplayMode === 'group' || currentEvent.cupDisplayMode === 'knockout')) {
    return currentEvent.cupDisplayMode;
  }

  const hasStartedKnockout = knockoutStages.some((stage) =>
    (stage.matches || []).some((match) => match.status !== 'not_started'),
  );

  return hasStartedKnockout ? 'knockout' : 'group';
}

function buildCupSections(currentEvent, standings, stageGroups) {
  if (!currentEvent || currentEvent.eventType !== 'cup') {
    return {
      cupDisplayMode: 'group',
      cupSections: [],
    };
  }

  const groupSections = standings && standings.type === 'group' ? standings.groups || [] : [];
  const knockoutStages = (stageGroups || []).filter((stage) => isKnockoutStage(stage.stageName));
  const cupDisplayMode = getCupDisplayMode(currentEvent, knockoutStages);

  const sections = [
    {
      sectionType: 'group',
      title: '小组赛积分',
      subtitle: '用于展示各小组当前排名与出线形势。',
      groups: groupSections,
    },
    {
      sectionType: 'knockout',
      title: '淘汰赛阶段',
      subtitle: '按阶段列出对阵关系，便于查看当前杯赛进程。',
      stages: knockoutStages,
    },
  ];

  return {
    cupDisplayMode,
    cupSections:
      cupDisplayMode === 'knockout'
        ? [sections[1], sections[0]]
        : [sections[0], sections[1]],
  };
}

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
    standings: null,
    cupDisplayMode: 'group',
    cupSections: [],
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
      const [currentEvent, overview, standings, stageGroups] = await Promise.all([
        contentService.getEventById(eventId),
        contentService.getEventOverview(eventId),
        contentService.getStandingsByEvent(eventId),
        contentService.getGroupedMatchesByEvent(eventId),
      ]);

      const { cupDisplayMode, cupSections } = buildCupSections(currentEvent, standings, stageGroups);

      this.setData({
        events,
        activeEventId: eventId,
        currentEvent,
        overview,
        standings,
        cupDisplayMode,
        cupSections,
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
});
