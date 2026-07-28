const contentService = require('../../services/content-service');

Page({
  data: {
    events: [],
    activeEventId: '',
    currentEvent: null,
    overview: null,
    standings: null,
  },

  async onLoad() {
    const events = await contentService.getEvents();
    const activeEventId = await contentService.getDefaultEventId();
    await this.syncPage(events, activeEventId);
  },

  async syncPage(events, eventId) {
    const [currentEvent, overview, standings] = await Promise.all([
      contentService.getEventById(eventId),
      contentService.getEventOverview(eventId),
      contentService.getStandingsByEvent(eventId),
    ]);

    this.setData({
      events,
      activeEventId: eventId,
      currentEvent,
      overview,
      standings,
    });
  },

  async handleEventSwitch(event) {
    const { eventId } = event.currentTarget.dataset;
    if (!eventId || eventId === this.data.activeEventId) {
      return;
    }

    await this.syncPage(this.data.events, eventId);
  },
});
