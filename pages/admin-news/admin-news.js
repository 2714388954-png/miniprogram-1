const adminService = require('../../services/admin-service');
const contentService = require('../../services/content-service');
const newsAdminService = require('../../services/news-admin-service');

function normalizeSortOrder(value) {
  if (value === '' || value === null || value === undefined) {
    return '0';
  }
  return String(value);
}

function buildMatchOptions(stageGroups) {
  const options = [
    {
      value: '',
      label: '不关联比赛',
      detail: '这篇新闻不绑定具体比赛',
    },
  ];

  (stageGroups || []).forEach((group) => {
    (group.matches || []).forEach((match) => {
      options.push({
        value: match.matchId,
        label: `${match.matchId} | ${match.homeTeam} vs ${match.awayTeam}`,
        detail: `${match.stage} · ${match.matchTime}`,
      });
    });
  });

  return options;
}

function findOptionIndex(options, targetValue) {
  const index = (options || []).findIndex((item) => item.value === targetValue);
  return index >= 0 ? index : 0;
}

Page({
  data: {
    events: [],
    activeEventId: '',
    eventIndex: 0,
    newsList: [],
    matchOptions: buildMatchOptions([]),
    matchOptionIndex: 0,
    isLoading: true,
    showEditor: false,
    isSaving: false,
    isUploadingCover: false,
    isDeleting: false,
    editorTitle: '新增新闻',
    formData: newsAdminService.createEmptyNewsForm(''),
  },

  draftFormData: newsAdminService.createEmptyNewsForm(''),

  async onLoad() {
    const session = adminService.getSession();
    if (!session) {
      wx.redirectTo({
        url: '/pages/admin-login/admin-login',
      });
      return;
    }

    await this.loadPage();
  },

  onShow() {
    if (!adminService.getSession()) {
      wx.redirectTo({
        url: '/pages/admin-login/admin-login',
      });
    }
  },

  async loadPage() {
    this.setData({ isLoading: true });
    try {
      const events = await contentService.getEvents();
      const activeEventId = events[0] ? events[0].eventId : '';
      await this.loadNewsForEvent(events, activeEventId);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async loadNewsForEvent(events, eventId) {
    const [newsList, stageGroups] = await Promise.all([
      eventId ? newsAdminService.getNewsByEvent(eventId) : [],
      eventId ? contentService.getGroupedMatchesByEvent(eventId) : [],
    ]);
    const eventIndex = Math.max(0, events.findIndex((item) => item.eventId === eventId));
    const nextFormData = newsAdminService.createEmptyNewsForm(eventId);
    const matchOptions = buildMatchOptions(stageGroups);

    this.setData({
      events,
      eventIndex,
      activeEventId: eventId,
      newsList,
      matchOptions,
      matchOptionIndex: 0,
      showEditor: false,
      formData: nextFormData,
    });
    this.draftFormData = { ...nextFormData };
  },

  async handleEventSwitch(event) {
    const { eventId } = event.currentTarget.dataset;
    if (!eventId || eventId === this.data.activeEventId) {
      return;
    }

    this.setData({ isLoading: true });
    try {
      await this.loadNewsForEvent(this.data.events, eventId);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  openCreateForm() {
    const activeEventId = this.data.activeEventId;
    const nextFormData = newsAdminService.createEmptyNewsForm(activeEventId);

    this.setData({
      showEditor: true,
      editorTitle: '新增新闻',
      matchOptionIndex: 0,
      formData: nextFormData,
    });
    this.draftFormData = { ...nextFormData };
  },

  openEditForm(event) {
    const { recordId, newsId } = event.currentTarget.dataset;
    const newsItem = this.findNews(recordId, newsId);
    if (!newsItem) {
      return;
    }

    const nextFormData = {
      recordId: newsItem._id || '',
      updatedAt: newsItem.updatedAt || '',
      newsId: newsItem.newsId || '',
      eventId: newsItem.eventId || '',
      title: newsItem.title || '',
      summary: newsItem.summary || '',
      coverImage: newsItem.coverImage || '',
      publishTime: newsItem.publishTime || '',
      category: newsItem.category || '',
      isFeatured: !!newsItem.isFeatured,
      isPinned: !!newsItem.isPinned,
      sortOrder: normalizeSortOrder(newsItem.sortOrder),
      content: newsItem.content || '',
      relatedMatchId: newsItem.relatedMatchId || '',
    };
    const matchOptionIndex = findOptionIndex(this.data.matchOptions, nextFormData.relatedMatchId);

    this.setData({
      showEditor: true,
      editorTitle: '编辑新闻',
      matchOptionIndex,
      formData: nextFormData,
    });
    this.draftFormData = { ...nextFormData };
  },

  closeEditor() {
    const nextFormData = newsAdminService.createEmptyNewsForm(this.data.activeEventId);
    this.setData({
      showEditor: false,
      matchOptionIndex: 0,
      formData: nextFormData,
    });
    this.draftFormData = { ...nextFormData };
  },

  handleFieldInput(event) {
    const { field } = event.currentTarget.dataset;
    const nextValue = event.detail.value;

    this.draftFormData = {
      ...(this.draftFormData || {}),
      [field]: nextValue,
    };

    this.setData({
      [`formData.${field}`]: nextValue,
    });
  },

  handleSwitchChange(event) {
    const { field } = event.currentTarget.dataset;
    const nextValue = !!event.detail.value;

    this.draftFormData = {
      ...(this.draftFormData || {}),
      [field]: nextValue,
    };

    this.setData({
      [`formData.${field}`]: nextValue,
    });
  },

  handleRelatedMatchChange(event) {
    const matchOptionIndex = Number(event.detail.value);
    const target = this.data.matchOptions[matchOptionIndex] || this.data.matchOptions[0];
    const relatedMatchId = target ? target.value : '';

    this.draftFormData = {
      ...(this.draftFormData || {}),
      relatedMatchId,
    };

    this.setData({
      matchOptionIndex,
      'formData.relatedMatchId': relatedMatchId,
    });
  },

  async chooseCoverImage() {
    if (this.data.isUploadingCover) {
      return;
    }

    try {
      const result = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
      });

      const file = result && result.tempFiles && result.tempFiles[0];
      if (!file || !file.tempFilePath) {
        return;
      }

      this.setData({ isUploadingCover: true });
      const latestFormData = {
        ...this.data.formData,
        ...(this.draftFormData || {}),
      };
      const fileID = await newsAdminService.uploadCoverImage(file.tempFilePath, latestFormData.newsId || 'news');

      this.draftFormData = {
        ...(this.draftFormData || {}),
        coverImage: fileID,
      };

      this.setData({
        'formData.coverImage': fileID,
      });

      wx.showToast({
        title: '封面已上传',
        icon: 'success',
      });
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) {
        return;
      }
      wx.showToast({
        title: (error && error.message) || '上传封面失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isUploadingCover: false });
    }
  },

  previewCoverImage() {
    const coverImage = this.data.formData.coverImage;
    if (!coverImage) {
      return;
    }

    wx.previewImage({
      urls: [coverImage],
      current: coverImage,
    });
  },

  handleSaveTap() {
    if (this.data.isSaving) {
      return;
    }

    setTimeout(() => {
      this.submitNews();
    }, 80);
  },

  async submitNews(overrideFormData) {
    const { isSaving, activeEventId } = this.data;
    if (isSaving) {
      return;
    }

    const formData = {
      ...this.data.formData,
      ...(this.draftFormData || {}),
      ...(overrideFormData || {}),
      eventId: activeEventId,
    };

    if (
      !String(formData.newsId || '').trim() ||
      !String(formData.title || '').trim() ||
      !String(formData.summary || '').trim() ||
      !String(formData.publishTime || '').trim() ||
      !String(formData.category || '').trim() ||
      !String(formData.content || '').trim()
    ) {
      wx.showToast({
        title: '请先填写新闻编号、标题、摘要、发布时间、分类和正文',
        icon: 'none',
      });
      return;
    }

    this.setData({
      isSaving: true,
      formData,
    });

    try {
      await newsAdminService.saveNews(formData);

      wx.showToast({
        title: '新闻已保存',
        icon: 'success',
      });

      const nextFormData = newsAdminService.createEmptyNewsForm(activeEventId);
      await this.loadNewsForEvent(this.data.events, activeEventId);
      this.setData({
        showEditor: false,
        formData: nextFormData,
        matchOptionIndex: 0,
      });
      this.draftFormData = { ...nextFormData };
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isSaving: false });
    }
  },

  async handleDeleteNews() {
    const latestFormData = {
      ...this.data.formData,
      ...(this.draftFormData || {}),
    };

    if (!latestFormData.recordId && !latestFormData.newsId) {
      wx.showToast({
        title: '请先选择一条已有新闻再删除',
        icon: 'none',
      });
      return;
    }

    if (this.data.isDeleting) {
      return;
    }

    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '删除新闻',
        content: '删除后新闻列表和详情页都将无法继续查看，是否确认删除？',
        confirmColor: '#d93025',
        success(res) {
          resolve(!!res.confirm);
        },
        fail() {
          resolve(false);
        },
      });
    });

    if (!confirm) {
      return;
    }

    this.setData({ isDeleting: true });
    try {
      await newsAdminService.deleteNews({
        recordId: latestFormData.recordId,
        eventId: latestFormData.eventId || this.data.activeEventId,
        newsId: latestFormData.newsId,
      });

      wx.showToast({
        title: '新闻已删除',
        icon: 'success',
      });

      const nextFormData = newsAdminService.createEmptyNewsForm(this.data.activeEventId);
      await this.loadNewsForEvent(this.data.events, this.data.activeEventId);
      this.setData({
        showEditor: false,
        formData: nextFormData,
        matchOptionIndex: 0,
      });
      this.draftFormData = { ...nextFormData };
    } catch (error) {
      wx.showToast({
        title: error.message || '删除失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isDeleting: false });
    }
  },

  findNews(recordId, newsId) {
    const { newsList } = this.data;
    return newsList.find((item) => {
      if (recordId && item._id) {
        return item._id === recordId;
      }
      return item.newsId === newsId;
    }) || null;
  },

  handleBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        wx.reLaunch({
          url: '/pages/admin-home/admin-home',
        });
      },
    });
  },

  noop() {},
});
