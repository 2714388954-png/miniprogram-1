const cloudConfig = require('../config/cloud');
const { stats } = require('../data/stats');

const STAT_TYPE_OPTIONS = [
  { value: 'scorers', label: '射手榜', unit: '球' },
  { value: 'assists', label: '助攻榜', unit: '次' },
  { value: 'yellowCards', label: '黄牌榜', unit: '张' },
  { value: 'redCards', label: '红牌榜', unit: '张' },
];

function parseScorerValue(rawValue) {
  const normalized = String(rawValue === undefined || rawValue === null ? '' : rawValue).trim();
  const matched = normalized.match(/^(\d+)(?:\((\d+)\))?$/);

  if (!matched) {
    return {
      displayValue: normalized,
      totalGoals: 0,
      penaltyGoals: 0,
      hasPenalty: false,
    };
  }

  return {
    displayValue: matched[2] !== undefined ? `${matched[1]}(${matched[2]})` : matched[1],
    totalGoals: Number(matched[1]) || 0,
    penaltyGoals: matched[2] !== undefined ? Number(matched[2]) || 0 : 0,
    hasPenalty: matched[2] !== undefined,
  };
}

function getSortMeta(item = {}, statType) {
  if (statType === 'scorers') {
    return parseScorerValue(item.value);
  }

  return {
    displayValue: item.value,
    totalGoals: Number(item.value) || 0,
    penaltyGoals: 0,
    hasPenalty: false,
  };
}

function isSameRankMeta(metaA, metaB, statType) {
  if (!metaA || !metaB) {
    return false;
  }

  if (metaA.totalGoals !== metaB.totalGoals) {
    return false;
  }

  if (statType === 'scorers') {
    return (
      metaA.hasPenalty === metaB.hasPenalty &&
      metaA.penaltyGoals === metaB.penaltyGoals
    );
  }

  return true;
}

function sortStatsList(list, statType) {
  const sortedRows = (list || [])
    .slice()
    .sort((a, b) => {
      const metaA = getSortMeta(a, statType);
      const metaB = getSortMeta(b, statType);

      const primaryDiff = metaB.totalGoals - metaA.totalGoals;
      if (primaryDiff !== 0) {
        return primaryDiff;
      }

      if (statType === 'scorers') {
        if (metaA.hasPenalty !== metaB.hasPenalty) {
          return metaA.hasPenalty ? 1 : -1;
        }

        const penaltyDiff = metaB.penaltyGoals - metaA.penaltyGoals;
        if (penaltyDiff !== 0) {
          return penaltyDiff;
        }
      }

      return (a.rank || 0) - (b.rank || 0);
    });

  let previousMeta = null;

  return sortedRows.map((item, index) => {
    const meta = getSortMeta(item, statType);
    const nextRank = index === 0 || !isSameRankMeta(meta, previousMeta, statType) ? index + 1 : previousMeta.rank;

    previousMeta = {
      ...meta,
      rank: nextRank,
    };

    return {
      ...item,
      value: meta.displayValue,
      rank: nextRank,
    };
  });
}

function createEmptyStatsForm(eventId, statType) {
  return {
    recordId: '',
    updatedAt: '',
    eventId: eventId || '',
    statType: statType || 'scorers',
    listText: '',
  };
}

function formatStatsText(list, statType = 'scorers') {
  return sortStatsList(list, statType)
    .map((item) => [item.playerName || '', item.teamName || '', item.value ?? ''].join('，'))
    .join('\n');
}

function buildLocalRows(eventId) {
  const payload = stats[eventId] || {};

  return STAT_TYPE_OPTIONS.map((option, index) => ({
    _id: `local-${eventId}-${option.value}`,
    recordKey: `local-${eventId}-${option.value}`,
    eventId,
    statType: option.value,
    list: sortStatsList(payload[option.value] || [], option.value),
    updatedAt: '',
    sortOrder: index,
  }));
}

function getDatabase() {
  if (!cloudConfig.enabled || typeof wx === 'undefined' || !wx.cloud) {
    return null;
  }

  try {
    return wx.cloud.database();
  } catch (error) {
    return null;
  }
}

function normalizeRecord(item) {
  return {
    ...item,
    recordKey: item._id || `${item.eventId}-${item.statType}`,
    updatedAt: item.updatedAt || '',
    list: sortStatsList(item.list || [], item.statType),
  };
}

async function getStatsRecordsByEvent(eventId) {
  const db = getDatabase();
  if (!db) {
    return buildLocalRows(eventId);
  }

  const result = await db.collection('stats').where({ eventId }).get();
  const records = (result.data || []).map(normalizeRecord);

  return STAT_TYPE_OPTIONS.map((option, index) => {
    const matched = records.find((item) => item.statType === option.value);
    if (matched) {
      return matched;
    }

    return {
      _id: '',
      recordKey: `empty-${eventId}-${option.value}`,
      eventId,
      statType: option.value,
      list: [],
      updatedAt: '',
      sortOrder: index,
    };
  });
}

async function saveStats(formData) {
  if (!cloudConfig.enabled || typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('当前环境未连接云开发，暂时无法保存数据榜。');
  }

  const result = await wx.cloud.callFunction({
    name: 'adminUpdateStats',
    data: {
      formData,
    },
  });

  const payload = result && result.result ? result.result : null;
  if (!payload || !payload.success) {
    throw new Error((payload && payload.message) || '云函数保存数据榜失败，请稍后重试。');
  }

  return payload.data || null;
}

module.exports = {
  STAT_TYPE_OPTIONS,
  createEmptyStatsForm,
  formatStatsText,
  getStatsRecordsByEvent,
  saveStats,
};
