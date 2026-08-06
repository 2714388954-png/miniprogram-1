const contentService = require('../../services/content-service');
const adminService = require('../../services/admin-service');

function isGeneralNews(item) {
  const eventId = String(item && item.eventId ? item.eventId : '').trim();
  return !eventId || eventId === 'general' || eventId === 'association-general';
}

function buildFilterOptions(events) {
  const options = [
    { key: 'all', label: '全部', type: 'all', eventId: '' },
    { key: 'general', label: '普通新闻', type: 'general', eventId: '' },
  ];

  (events || [])
    .filter((item) => item.status !== 'finished')
    .forEach((item) => {
      options.push({
        key: `event:${item.eventId}`,
        label: item.eventName,
        type: 'event',
        eventId: item.eventId,
      });
    });

  return options;
}

function decorateNewsItem(item, events) {
  const matchedEvent = (events || []).find((event) => event.eventId === item.eventId);
  return {
    ...item,
    eventName: matchedEvent ? matchedEvent.eventName : '',
    filterType: isGeneralNews(item) ? 'general' : 'event',
    displayTag: isGeneralNews(item) ? '普通新闻' : (matchedEvent ? matchedEvent.eventName : '赛事新闻'),
  };
}

function filterNewsList(newsList, activeFilterKey) {
  if (!activeFilterKey || activeFilterKey === 'all') {
    return newsList;
  }

  if (activeFilterKey === 'general') {
    return newsList.filter((item) => item.filterType === 'general');
  }

  if (activeFilterKey.indexOf('event:') === 0) {
    const eventId = activeFilterKey.slice(6);
    return newsList.filter((item) => item.eventId === eventId);
  }

  return newsList;
}

Page({
  data: {
    events: [],
    filterOptions: [],
    activeFilterKey: 'all',
    activeFilterIndex: 0,
    featuredNews: [],
    allNewsList: [],
    newsList: [],
    isLoading: true,
  },

  hasLoaded: false,

  async onLoad() {
    await this.reloadPageData();
    this.hasLoaded = true;
  },

  async onShow() {
    if (!this.hasLoaded) {
      return;
    }

    contentService.clearCache();
    await this.reloadPageData();
  },

  async onPullDownRefresh() {
    try {
      contentService.clearCache();
      await this.reloadPageData();
      wx.showToast({
        title: '内容已刷新',
        icon: 'success',
      });
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async reloadPageData() {
    this.setData({ isLoading: true });
    try {
      const [events, featuredNews, allNews] = await Promise.all([
        contentService.getEvents(),
        contentService.getFeaturedNewsAll(),
        contentService.getAllNews(),
      ]);

      const filterOptions = buildFilterOptions(events);
      const decoratedFeaturedNews = featuredNews.map((item) => decorateNewsItem(item, events));
      const decoratedAllNews = allNews.map((item) => decorateNewsItem(item, events));
      const activeFilterKey = filterOptions.some((item) => item.key === this.data.activeFilterKey)
        ? this.data.activeFilterKey
        : 'all';
      const activeFilterIndex = Math.max(0, filterOptions.findIndex((item) => item.key === activeFilterKey));

      this.setData({
        events,
        filterOptions,
        activeFilterKey,
        activeFilterIndex,
        featuredNews: decoratedFeaturedNews,
        allNewsList: decoratedAllNews,
        newsList: filterNewsList(decoratedAllNews, activeFilterKey),
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  handleFilterChange(event) {
    const nextIndex = Number(event.detail.value);
    const target = this.data.filterOptions[nextIndex];
    const filterKey = target ? target.key : '';
    if (!filterKey || filterKey === this.data.activeFilterKey) {
      return;
    }

    this.setData({
      activeFilterKey: filterKey,
      activeFilterIndex: nextIndex,
      newsList: filterNewsList(this.data.allNewsList, filterKey),
    });
  },

  openNewsDetail(event) {
    const { newsId } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/news-detail/news-detail?newsId=${newsId}`,
    });
  },

  openAdminEntry() {
    const target = adminService.isLoggedIn() ? '/pages/admin-home/admin-home' : '/pages/admin-login/admin-login';
    wx.navigateTo({ url: target });
  },
});
