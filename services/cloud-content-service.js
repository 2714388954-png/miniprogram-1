const localContentService = require('./local-content-service');

function normalizeMaybeEmpty(value) {
  return value === 'none' ? '' : value;
}

function normalizeMatch(match) {
  if (!match) {
    return match;
  }

  return {
    ...match,
    groupName: normalizeMaybeEmpty(match.groupName),
    reportNewsId: normalizeMaybeEmpty(match.reportNewsId),
    reportTitle: normalizeMaybeEmpty(match.reportTitle),
  };
}

function normalizeNewsItem(item) {
  if (!item) {
    return item;
  }

  return {
    ...item,
    relatedMatchId: normalizeMaybeEmpty(item.relatedMatchId),
  };
}

function getDatabase() {
  if (typeof wx === 'undefined' || !wx.cloud) {
    return null;
  }

  try {
    return wx.cloud.database();
  } catch (error) {
    return null;
  }
}

async function getEvents() {
  const db = getDatabase();
  if (!db) {
    return localContentService.getEvents();
  }

  const result = await db.collection('events').orderBy('sortOrder', 'asc').get();
  return (result.data || []).map((item) => ({
    ...item,
  }));
}

async function getDefaultEventId() {
  const events = await getEvents();
  return events[0] ? events[0].eventId : '';
}

async function getEventById(eventId) {
  const db = getDatabase();
  if (!db) {
    return localContentService.getEventById(eventId);
  }

  const result = await db.collection('events').where({ eventId }).limit(1).get();
  return result.data && result.data[0] ? { ...result.data[0] } : null;
}

async function getNewsByEvent(eventId) {
  const db = getDatabase();
  if (!db) {
    return localContentService.getNewsByEvent(eventId);
  }

  const result = await db.collection('news').where({ eventId }).get();
  const rows = (result.data || []).map(normalizeNewsItem);

  return rows.sort((a, b) => {
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

async function getFeaturedNews(eventId) {
  const rows = await getNewsByEvent(eventId);
  return rows.filter((item) => item.isFeatured);
}

async function getNewsById(newsId) {
  const db = getDatabase();
  if (!db) {
    return localContentService.getNewsById(newsId);
  }

  const result = await db.collection('news').where({ newsId }).limit(1).get();
  return result.data && result.data[0] ? normalizeNewsItem(result.data[0]) : null;
}

async function getGroupedMatchesByEvent(eventId) {
  const db = getDatabase();
  if (!db) {
    return localContentService.getGroupedMatchesByEvent(eventId);
  }

  const result = await db.collection('matches').where({ eventId }).get();
  const grouped = {};

  (result.data || []).map(normalizeMatch).forEach((match) => {
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

async function getStandingsByEvent(eventId) {
  const db = getDatabase();
  if (!db) {
    return localContentService.getStandingsByEvent(eventId);
  }

  const result = await db.collection('standings').where({ eventId }).get();
  const rows = result.data || [];
  if (!rows.length) {
    return null;
  }

  const groupRows = rows.filter((item) => item.tableType === 'group');
  if (groupRows.length) {
    return {
      type: 'group',
      groups: groupRows
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((item) => ({
          groupName: normalizeMaybeEmpty(item.groupName),
          table: item.table || [],
        })),
    };
  }

  const leagueRow = rows.find((item) => item.tableType === 'league');
  return leagueRow
    ? {
        type: 'league',
        table: leagueRow.table || [],
      }
    : null;
}

async function getStatsByEvent(eventId) {
  const db = getDatabase();
  if (!db) {
    return localContentService.getStatsByEvent(eventId);
  }

  const result = await db.collection('stats').where({ eventId }).get();
  const rows = result.data || [];
  const payload = {
    scorers: [],
    assists: [],
    yellowCards: [],
    redCards: [],
  };

  rows.forEach((item) => {
    if (payload[item.statType]) {
      payload[item.statType] = item.list || [];
    }
  });

  return payload;
}

async function getEventOverview(eventId) {
  const [eventInfo, eventNews, eventMatches, eventStandings, eventStats] = await Promise.all([
    getEventById(eventId),
    getNewsByEvent(eventId),
    getGroupedMatchesByEvent(eventId),
    getStandingsByEvent(eventId),
    getStatsByEvent(eventId),
  ]);

  const allMatches = eventMatches.flatMap((item) => item.matches);
  const finishedMatches = allMatches.filter((item) => item.status === 'finished').length;
  const pendingMatches = allMatches.filter((item) => item.status !== 'finished').length;
  const pinnedCount = eventNews.filter((item) => item.isPinned).length;

  return {
    statusLabel:
      eventInfo && eventInfo.status === 'ongoing'
        ? '进行中'
        : eventInfo && eventInfo.status === 'finished'
          ? '已结束'
          : '未开始',
    eventTypeLabel:
      eventInfo && eventInfo.eventType === 'cup' ? '杯赛制' : eventInfo ? '联赛制' : '综合赛事',
    totalMatches: allMatches.length,
    finishedMatches,
    pendingMatches,
    newsCount: eventNews.length,
    pinnedCount,
    standingsModeLabel:
      eventStandings && eventStandings.type === 'group' ? '小组积分榜' : '总积分榜',
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
