const contentService = require('../../services/content-service');

Page({
  data: {
    newsItem: null,
  },

  async onLoad(options) {
    const newsItem = await contentService.getNewsById(options.newsId);
    this.setData({ newsItem });
  },
});
