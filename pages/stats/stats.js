const contentService = require('../../services/content-service');

const statTabs = [
  { key: 'scorers', label: '进球榜', unit: '球' },
  { key: 'assists', label: '助攻榜', unit: '次' },
  { key: 'yellowCards', label: '黄牌榜', unit: '张' },
  { key: 'redCards', label: '红牌榜', unit: '张' },
];

Page({
  data: {
    events: [],
    activeEventId: '',
    currentEvent: null,
    overview: null,
    activeStatKey: 'scorers',
    statTabs,
    statRows: [],
    statUnit: '球',
  },

  async onLoad() {
    const events = await contentService.getEvents();
    const activeEventId = await contentService.getDefaultEventId();
    this.setData({ events, activeEventId });
    await this.syncStats(activeEventId, 'scorers');
  },

  async syncStats(eventId, statKey) {
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
    });
  },

  async handleEventSwitch(event) {
    const { eventId } = event.currentTarget.dataset;
    if (!eventId || eventId === this.data.activeEventId) {
      return;
    }
    await this.syncStats(eventId, this.data.activeStatKey);
  },

  async handleStatSwitch(event) {
    const { statKey } = event.currentTarget.dataset;
    if (!statKey || statKey === this.data.activeStatKey) {
      return;
    }
    await this.syncStats(this.data.activeEventId, statKey);
  },
});
