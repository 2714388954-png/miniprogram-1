const adminService = require('../../services/admin-service');

const moduleCards = [
  { key: 'matches', title: '比赛管理', desc: '录入赛程、比分、战报与进球球员', url: '/pages/admin-matches/admin-matches' },
  { key: 'news', title: '新闻管理', desc: '维护新闻标题、封面、置顶与排序', url: '/pages/admin-news/admin-news' },
  { key: 'standings', title: '积分榜管理', desc: '更新联赛积分或杯赛小组积分榜', url: '/pages/admin-standings/admin-standings' },
  { key: 'stats', title: '数据榜管理', desc: '维护进球榜、助攻榜与牌榜', url: '/pages/admin-stats/admin-stats' },
  { key: 'feedback', title: '反馈查阅', desc: '查看同学提交的问题与建议', url: '/pages/admin-feedback/admin-feedback' },
];

Page({
  data: {
    session: null,
    moduleCards,
  },

  onShow() {
    const session = adminService.getSession();
    if (!session) {
      wx.redirectTo({
        url: '/pages/admin-login/admin-login',
      });
      return;
    }

    this.setData({ session });
  },

  openModule(event) {
    const { url } = event.currentTarget.dataset;
    wx.navigateTo({ url });
  },

  handleLogout() {
    adminService.clearSession();
    wx.showToast({
      title: '已退出登录',
      icon: 'success',
    });
    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/admin-login/admin-login',
      });
    }, 300);
  },

  handleBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        wx.reLaunch({
          url: '/pages/home/home',
        });
      },
    });
  },
});
