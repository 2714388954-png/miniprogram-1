const adminService = require('../../services/admin-service');
const feedbackService = require('../../services/feedback-service');

Page({
  data: {
    mode: 'list',
    nickname: '',
    contact: '',
    content: '',
    isSubmitting: false,
    isLoading: false,
    feedbackList: [],
  },

  onLoad(options) {
    const mode = options.mode === 'submit' ? 'submit' : 'list';
    this.setData({ mode });
  },

  async onShow() {
    if (this.data.mode === 'list') {
      const session = adminService.getSession();
      if (!session) {
        wx.redirectTo({
          url: '/pages/admin-login/admin-login',
        });
        return;
      }

      await this.loadFeedbackList();
    }
  },

  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [field]: event.detail.value,
    });
  },

  async loadFeedbackList() {
    this.setData({ isLoading: true });
    try {
      const feedbackList = await feedbackService.getFeedbackList();
      this.setData({ feedbackList });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async submitFeedback() {
    const { nickname, contact, content, isSubmitting } = this.data;
    if (isSubmitting) {
      return;
    }

    if (!content.trim()) {
      wx.showToast({
        title: '请先填写反馈内容',
        icon: 'none',
      });
      return;
    }

    this.setData({ isSubmitting: true });
    try {
      await feedbackService.submitFeedback({
        nickname: nickname.trim(),
        contact: contact.trim(),
        content: content.trim(),
      });

      wx.showToast({
        title: '反馈已提交',
        icon: 'success',
      });

      this.setData({
        nickname: '',
        contact: '',
        content: '',
      });
    } finally {
      this.setData({ isSubmitting: false });
    }
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
