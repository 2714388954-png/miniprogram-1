const { getEvents, getDefaultEventId, getGroupedMatchesByEvent } = require('../../data/index');

Page({
  data: {
    events: [],
    activeEventId: '',
    stageGroups: [],
  },

  onLoad() {
    const events = getEvents();
    const activeEventId = getDefaultEventId();
    this.setData({
      events,
      activeEventId,
      stageGroups: getGroupedMatchesByEvent(activeEventId),
    });
  },

  handleEventSwitch(event) {
    const { eventId } = event.currentTarget.dataset;
    if (!eventId || eventId === this.data.activeEventId) {
      return;
    }

    this.setData({
      activeEventId: eventId,
      stageGroups: getGroupedMatchesByEvent(eventId),
    });
  },
});
