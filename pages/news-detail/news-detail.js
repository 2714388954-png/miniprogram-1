const contentService = require('../../services/content-service');

Page({
  data: {
    newsItem: null,
    isLoading: true,
  },

  async onLoad(options) {
    this.setData({ isLoading: true });
    try {
      const newsItem = await contentService.getNewsById(options.newsId);
      this.setData({ newsItem });
    } finally {
      this.setData({ isLoading: false });
    }
  },
});
