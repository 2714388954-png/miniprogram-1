const adminService = require('../../services/admin-service');
const contentService = require('../../services/content-service');
const statsAdminService = require('../../services/stats-admin-service');

function findOptionIndex(options, value, fieldName) {
  const index = (options || []).findIndex((item) => item[fieldName] === value);
  return index >= 0 ? index : 0;
}

Page({
  data: {
    pageTitle: '数据榜管理',
    backText: '返回',
    toolbarEventLabel: '当前赛事',
    loadingText: '加载数据榜中...',
    statTypeLabel: '榜单类型',
    editCurrentLabel: '编辑当前榜单',
    inputHintText: '输入格式：姓名，球队，数值',
    unitPrefix: '单位：',
    emptyText: '当前榜单还没有录入数据',
    editorHintText: '每行一条，按“姓名，球队，数值”填写；射手榜支持 5 或 5(1)。',
    fillExampleText: '填入示例',
    clearInputText: '清空输入框',
    listContentLabel: '榜单内容',
    editorPlaceholder: '示例：\n张三，经管学院，5(1)\n李四，机械学院，5\n王五，计算机学院，3',
    cancelText: '取消',
    saveIdleText: '保存榜单',
    saveLoadingText: '保存中...',
    events: [],
    activeEventId: '',
    eventIndex: 0,
    statsRecords: [],
    statTypeOptions: statsAdminService.STAT_TYPE_OPTIONS,
    statTypeIndex: 0,
    activeStatType: 'scorers',
    activeStatLabel: statsAdminService.STAT_TYPE_OPTIONS[0].label,
    activeStatUnit: statsAdminService.STAT_TYPE_OPTIONS[0].unit,
    currentRecord: null,
    isLoading: true,
    showEditor: false,
    isSaving: false,
    editorTitle: '编辑数据榜',
    formData: statsAdminService.createEmptyStatsForm('', 'scorers'),
  },

  draftFormData: statsAdminService.createEmptyStatsForm('', 'scorers'),

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
      await this.loadStatsForEvent(events, activeEventId, 'scorers');
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async loadStatsForEvent(events, eventId, statType) {
    const statsRecords = eventId ? await statsAdminService.getStatsRecordsByEvent(eventId) : [];
    const eventIndex = Math.max(0, events.findIndex((item) => item.eventId === eventId));
    const statTypeIndex = findOptionIndex(this.data.statTypeOptions, statType, 'value');
    const activeOption = this.data.statTypeOptions[statTypeIndex] || this.data.statTypeOptions[0];
    const currentRecord =
      statsRecords.find((item) => item.statType === activeOption.value) || {
        _id: '',
        eventId,
        statType: activeOption.value,
        list: [],
        updatedAt: '',
      };
    const nextFormData = {
      recordId: currentRecord._id || '',
      updatedAt: currentRecord.updatedAt || '',
      eventId,
      statType: activeOption.value,
      listText: statsAdminService.formatStatsText(currentRecord.list || []),
    };

    this.setData({
      events,
      activeEventId: eventId,
      eventIndex,
      statsRecords,
      statTypeIndex,
      activeStatType: activeOption.value,
      activeStatLabel: activeOption.label,
      activeStatUnit: activeOption.unit,
      currentRecord,
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
      await this.loadStatsForEvent(this.data.events, eventId, this.data.activeStatType);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async handleStatTypeSwitch(event) {
    const { statType } = event.currentTarget.dataset;
    if (!statType || statType === this.data.activeStatType) {
      return;
    }

    await this.loadStatsForEvent(this.data.events, this.data.activeEventId, statType);
  },

  openEditor() {
    const { activeEventId, activeStatType, currentRecord, activeStatLabel } = this.data;
    const nextFormData = {
      recordId: currentRecord && currentRecord._id ? currentRecord._id : '',
      updatedAt: currentRecord && currentRecord.updatedAt ? currentRecord.updatedAt : '',
      eventId: activeEventId,
      statType: activeStatType,
      listText: statsAdminService.formatStatsText((currentRecord && currentRecord.list) || []),
    };

    this.setData({
      showEditor: true,
      editorTitle: `编辑${activeStatLabel}`,
      formData: nextFormData,
    });
    this.draftFormData = { ...nextFormData };
  },

  closeEditor() {
    const nextFormData = {
      recordId: this.data.currentRecord && this.data.currentRecord._id ? this.data.currentRecord._id : '',
      updatedAt: this.data.currentRecord && this.data.currentRecord.updatedAt ? this.data.currentRecord.updatedAt : '',
      eventId: this.data.activeEventId,
      statType: this.data.activeStatType,
      listText: statsAdminService.formatStatsText((this.data.currentRecord && this.data.currentRecord.list) || []),
    };

    this.setData({
      showEditor: false,
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

  fillExample() {
    const sampleText =
      this.data.activeStatType === 'scorers'
        ? ['张三，经管学院，5(1)', '李四，机械学院，5', '王五，计算机学院，3'].join('\n')
        : ['张三，经管学院，5', '李四，机械学院，4', '王五，计算机学院，3'].join('\n');

    this.draftFormData = {
      ...(this.draftFormData || {}),
      listText: sampleText,
    };

    this.setData({
      'formData.listText': sampleText,
    });
  },

  clearCurrentText() {
    this.draftFormData = {
      ...(this.draftFormData || {}),
      listText: '',
    };

    this.setData({
      'formData.listText': '',
    });
  },

  handleSaveTap() {
    if (this.data.isSaving) {
      return;
    }

    setTimeout(() => {
      this.submitStats();
    }, 80);
  },

  async submitStats() {
    const { isSaving, activeEventId, activeStatType } = this.data;
    if (isSaving) {
      return;
    }

    const formData = {
      ...this.data.formData,
      ...(this.draftFormData || {}),
      eventId: activeEventId,
      statType: activeStatType,
    };

    if (!String(formData.listText || '').trim()) {
      wx.showToast({
        title: '请先填写榜单内容',
        icon: 'none',
      });
      return;
    }

    this.setData({
      isSaving: true,
      formData,
    });

    try {
      await statsAdminService.saveStats(formData);
      contentService.clearCache();

      wx.showToast({
        title: '数据榜已保存',
        icon: 'success',
      });

      await this.loadStatsForEvent(this.data.events, activeEventId, activeStatType);
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isSaving: false });
    }
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
