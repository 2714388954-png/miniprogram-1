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
    });
  },

  handleEventSwitch(event) {
    const { eventId } = event.currentTarget.dataset;
    if (!eventId || eventId === this.data.activeEventId) {
      return;
    }

    this.syncPage(this.data.events, eventId);
  },
});
