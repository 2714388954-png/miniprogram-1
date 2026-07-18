const { events } = require('./events');
const { news } = require('./news');
const { matches } = require('./matches');
const { standings } = require('./standings');
const { stats } = require('./stats');

function getEvents() {
  return events.slice();
}

function getDefaultEventId() {
  return events[0] ? events[0].eventId : '';
}

function getEventById(eventId) {
  return events.find((item) => item.eventId === eventId) || null;
}

function getNewsByEvent(eventId) {
  return news
    .filter((item) => item.eventId === eventId)
    .sort((a, b) => {
      if (!!a.isPinned !== !!b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      const priorityA = typeof a.priority === 'number' ? a.priority : 0;
      const priorityB = typeof b.priority === 'number' ? b.priority : 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      const viewsA = typeof a.views === 'number' ? a.views : 0;
      const viewsB = typeof b.views === 'number' ? b.views : 0;
      if (viewsA !== viewsB) {
        return viewsB - viewsA;
      }

      return a.publishTime < b.publishTime ? 1 : -1;
    });
}

function getFeaturedNews(eventId) {
  return getNewsByEvent(eventId).filter((item) => item.isFeatured);
}

function getNewsById(newsId) {
  return news.find((item) => item.newsId === newsId) || null;
}

function getMatchesByEvent(eventId) {
  return matches.filter((item) => item.eventId === eventId);
}

function getGroupedMatchesByEvent(eventId) {
  const grouped = {};
  getMatchesByEvent(eventId).forEach((match) => {
    if (!grouped[match.stage]) {
      grouped[match.stage] = [];
    }
    grouped[match.stage].push(match);
  });

  return Object.keys(grouped).map((stageName) => ({
    stageName,
    matches: grouped[stageName],
  }));
}

function getStandingsByEvent(eventId) {
  return standings[eventId] || null;
}

function getStatsByEvent(eventId) {
  return stats[eventId] || {
    scorers: [],
    assists: [],
    yellowCards: [],
    redCards: [],
  };
}

module.exports = {
  getEvents,
  getDefaultEventId,
  getEventById,
  getNewsByEvent,
  getFeaturedNews,
  getNewsById,
  getMatchesByEvent,
  getGroupedMatchesByEvent,
  getStandingsByEvent,
  getStatsByEvent,
};
