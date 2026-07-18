const { getNewsById } = require('../../data/index');

Page({
  data: {
    newsItem: null,
  },

  onLoad(options) {
    const newsItem = getNewsById(options.newsId);
    this.setData({ newsItem });
  },
});
