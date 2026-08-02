const adminService = require('../../services/admin-service');

Page({
  data: {
    username: '',
    password: '',
    isSubmitting: false,
  },

  onShow() {
    if (adminService.isLoggedIn()) {
      wx.redirectTo({
        url: '/pages/admin-home/admin-home',
      });
    }
  },

  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [field]: event.detail.value,
    });
  },

  async handleLogin() {
    const { username, password, isSubmitting } = this.data;
    if (isSubmitting) {
      return;
    }

    if (!username.trim() || !password.trim()) {
      wx.showToast({
        title: '请先输入账号和密码',
        icon: 'none',
      });
      return;
    }

    this.setData({ isSubmitting: true });
    try {
      await adminService.login(username.trim(), password.trim());
      wx.showToast({
        title: '登录成功',
        icon: 'success',
      });
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/admin-home/admin-home',
        });
      }, 300);
    } catch (error) {
      wx.showToast({
        title: error.message || '登录失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  openFeedback() {
    wx.navigateTo({
      url: '/pages/admin-feedback/admin-feedback?mode=submit',
    });
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
