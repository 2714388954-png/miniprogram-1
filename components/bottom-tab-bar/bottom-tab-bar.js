const tabs = [
  { key: 'home', label: '首页', sticker: '首', path: '/pages/home/home' },
  { key: 'schedule', label: '赛程', sticker: '赛', path: '/pages/schedule/schedule' },
  { key: 'standings', label: '积分榜', sticker: '榜', path: '/pages/standings/standings' },
  { key: 'stats', label: '数据榜', sticker: '数', path: '/pages/stats/stats' },
];

Component({
  properties: {
    current: {
      type: String,
      value: 'home',
    },
  },
  data: {
    tabs,
  },
  methods: {
    handleSwitch(event) {
      const { path, key } = event.currentTarget.dataset;
      if (key === this.data.current) {
        return;
      }

      wx.reLaunch({ url: path });
    },
  },
});
