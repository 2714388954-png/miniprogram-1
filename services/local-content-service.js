const { events } = require('../data/events');
const { news } = require('../data/news');
const { matches } = require('../data/matches');
const { standings } = require('../data/standings');
const { stats } = require('../data/stats');

const knockoutStageKeywords = ['16进8', '8进4', '半决赛', '三四名决赛', '决赛'];

function normalizeMaybeEmpty(value) {
  return value === 'none' ? '' : value;
}

function normalizeMatch(match) {
  if (!match) {
    return match;
  }

  return {
    ...match,
    recordKey: match._id || match.matchId,
    groupName: normalizeMaybeEmpty(match.groupName),
    reportNewsId: normalizeMaybeEmpty(match.reportNewsId),
    reportTitle: normalizeMaybeEmpty(match.reportTitle),
    report: normalizeMaybeEmpty(match.report),
    updatedAt: normalizeMaybeEmpty(match.updatedAt),
  };
}

function normalizeNewsItem(item) {
  if (!item) {
    return item;
  }

  return {
    ...item,
    recordKey: item._id || item.newsId,
    relatedMatchId: normalizeMaybeEmpty(item.relatedMatchId),
    updatedAt: normalizeMaybeEmpty(item.updatedAt),
  };
}

function normalizeStandingsPayload(payload) {
  if (!payload) {
    return payload;
  }

  if (payload.type === 'group') {
    return {
      ...payload,
      groups: (payload.groups || []).map((group, index) => ({
        ...group,
        recordKey: group.recordKey || group.groupName || `group-${index}`,
        groupName: normalizeMaybeEmpty(group.groupName),
      })),
    };
  }

  return payload;
}

function getStageSortValue(stageName = '') {
  const knockoutIndex = knockoutStageKeywords.findIndex((keyword) => stageName.indexOf(keyword) !== -1);
  if (knockoutIndex !== -1) {
    return 100 + knockoutIndex;
  }

  const roundMatch = stageName.match(/第(\d+)轮/);
  if (roundMatch) {
    return Number(roundMatch[1]);
  }

  return 999;
}

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
    })
    .map(normalizeNewsItem);
}

function getFeaturedNews(eventId) {
  return getNewsByEvent(eventId).filter((item) => item.isFeatured);
}

function getNewsById(newsId) {
  return normalizeNewsItem(news.find((item) => item.newsId === newsId) || null);
}

function getMatchesByEvent(eventId) {
  return matches.filter((item) => item.eventId === eventId).map(normalizeMatch);
}

function getGroupedMatchesByEvent(eventId) {
  const grouped = {};

  getMatchesByEvent(eventId).forEach((match) => {
    if (!grouped[match.stage]) {
      grouped[match.stage] = [];
    }
    grouped[match.stage].push(match);
  });

  return Object.keys(grouped)
    .sort((a, b) => getStageSortValue(a) - getStageSortValue(b))
    .map((stageName) => ({
      stageName,
      matches: grouped[stageName].slice().sort((a, b) => (a.matchTime > b.matchTime ? 1 : -1)),
    }));
}

function getStandingsByEvent(eventId) {
  return normalizeStandingsPayload(standings[eventId] || null);
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
  const ongoingMatches = eventMatches.filter((item) => item.status === 'ongoing').length;
  const pinnedCount = eventNews.filter((item) => item.isPinned).length;
  const standingsModeLabel =
    eventStandings && eventStandings.type === 'group' ? '小组积分榜' : '总积分榜';
  const inferredStatus =
    ongoingMatches > 0
      ? 'ongoing'
      : finishedMatches > 0 && pendingMatches > 0
        ? 'ongoing'
        : eventMatches.length > 0 && finishedMatches === eventMatches.length
          ? 'finished'
          : eventInfo && eventInfo.status
            ? eventInfo.status
            : 'upcoming';

  return {
    statusLabel: getStatusLabel(inferredStatus),
    eventTypeLabel: eventInfo ? getEventTypeLabel(eventInfo.eventType) : '综合赛事',
    totalMatches: eventMatches.length,
    finishedMatches,
    pendingMatches,
    newsCount: eventNews.length,
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
  getFeaturedNews,
  getNewsByEvent,
  getNewsById,
  getGroupedMatchesByEvent,
  getStandingsByEvent,
  getStatsByEvent,
};
