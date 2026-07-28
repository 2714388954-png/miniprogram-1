const cloudConfig = require('./config/cloud');

App({
  onLaunch() {
    this.initCloud();
  },

  initCloud() {
    if (!cloudConfig.enabled) {
      this.globalData.dataSource = 'local';
      return;
    }

    if (!wx.cloud) {
      console.warn('当前基础库不支持云开发，已回退到本地数据源。');
      this.globalData.dataSource = 'local';
      return;
    }

    wx.cloud.init({
      env: cloudConfig.envId,
      traceUser: true,
    });

    this.globalData.dataSource = 'cloud';
  },

  globalData: {
    dataSource: 'local',
  },
});
