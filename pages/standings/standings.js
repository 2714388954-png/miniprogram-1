const { getEvents, getDefaultEventId, getStandingsByEvent } = require('../../data/index');

Page({
  data: {
    events: [],
    activeEventId: '',
    standings: null,
    tableColumns: ['排名', '球队', '赛', '胜', '平', '负', '进/失', '积分'],
  },

  onLoad() {
    const events = getEvents();
    const activeEventId = getDefaultEventId();
    this.setData({
      events,
      activeEventId,
      standings: getStandingsByEvent(activeEventId),
    });
  },

  handleEventSwitch(event) {
    const { eventId } = event.currentTarget.dataset;
    if (!eventId || eventId === this.data.activeEventId) {
      return;
    }

    this.setData({
      activeEventId: eventId,
      standings: getStandingsByEvent(eventId),
    });
  },
});
