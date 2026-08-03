const contentService = require('../../services/content-service');

const knockoutStageKeywords = ['16进8', '8进4', '半决赛', '三四名决赛', '决赛'];

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

Page({
  data: {
    events: [],
    activeEventId: '',
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
      const activeEventId = await contentService.getDefaultEventId();
      await this.syncPage(events, activeEventId);
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
    const activeEventId = this.data.activeEventId || await contentService.getDefaultEventId();
    await this.syncPage(events, activeEventId);
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
});
