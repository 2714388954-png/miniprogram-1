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

function getStatusLabel(status) {
  const map = {
    upcoming: '未开始',
    ongoing: '进行中',
    finished: '已结束',
  };

  return map[status] || '待定';
}

function getEventTypeLabel(eventType) {
  const map = {
    league: '联赛制',
    cup: '杯赛制',
  };

  return map[eventType] || '综合赛事';
}

function getNewsByEvent(eventId) {
  return news
    .filter((item) => item.eventId === eventId)
    .sort((a, b) => {
      if (!!a.isPinned !== !!b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      const sortOrderA = typeof a.sortOrder === 'number' ? a.sortOrder : 999;
      const sortOrderB = typeof b.sortOrder === 'number' ? b.sortOrder : 999;
      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
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

function getEventOverview(eventId) {
  const eventInfo = getEventById(eventId);
  const eventMatches = getMatchesByEvent(eventId);
  const eventNews = getNewsByEvent(eventId);
  const eventStandings = getStandingsByEvent(eventId);
  const eventStats = getStatsByEvent(eventId);

  const finishedMatches = eventMatches.filter((item) => item.status === 'finished').length;
  const pendingMatches = eventMatches.filter((item) => item.status !== 'finished').length;
  const featuredCount = eventNews.filter((item) => item.isFeatured).length;
  const pinnedCount = eventNews.filter((item) => item.isPinned).length;
  const standingsModeLabel =
    eventStandings && eventStandings.type === 'group' ? '小组积分榜' : '总积分榜';

  return {
    statusLabel: eventInfo ? getStatusLabel(eventInfo.status) : '待定',
    eventTypeLabel: eventInfo ? getEventTypeLabel(eventInfo.eventType) : '综合赛事',
    totalMatches: eventMatches.length,
    finishedMatches,
    pendingMatches,
    newsCount: eventNews.length,
    featuredCount,
    pinnedCount,
    standingsModeLabel,
    topScorer:
      eventStats.scorers && eventStats.scorers.length
        ? `${eventStats.scorers[0].playerName} ${eventStats.scorers[0].value}球`
        : '待更新',
  };
}

module.exports = {
  getEvents,
  getDefaultEventId,
  getEventById,
  getEventOverview,
  getNewsByEvent,
  getFeaturedNews,
  getNewsById,
  getMatchesByEvent,
  getGroupedMatchesByEvent,
  getStandingsByEvent,
  getStatsByEvent,
};
