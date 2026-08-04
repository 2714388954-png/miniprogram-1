const tabs = [
  { key: 'home', iconText: '首页', path: '/pages/home/home' },
  { key: 'schedule', iconText: '赛程', path: '/pages/schedule/schedule' },
  { key: 'standings', iconText: '积分', path: '/pages/standings/standings' },
  { key: 'stats', iconText: '数据', path: '/pages/stats/stats' },
];

Component({
  properties: {
    current: {
      type: String,
      value: 'home',
    },
  },
  data: {
    leftTabs: tabs.slice(0, 2),
    rightTabs: tabs.slice(2),
    badgeSrc: '/assets/club-badge.png',
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
