const adminService = require('../../services/admin-service');
const contentService = require('../../services/content-service');
const standingsAdminService = require('../../services/standings-admin-service');

const knockoutStageKeywords = ['16进8', '8进4', '半决赛', '三四名决赛', '决赛'];

function isKnockoutStage(stageName = '') {
  return knockoutStageKeywords.some((keyword) => stageName.indexOf(keyword) !== -1);
}

Page({
  data: {
    events: [],
    currentEvent: null,
    activeEventId: '',
    eventIndex: 0,
    standingsRecords: [],
    knockoutStageGroups: [],
    cupDisplayModeOptions: standingsAdminService.CUP_DISPLAY_MODE_OPTIONS,
    cupDisplayMode: 'group',
    isLoading: true,
    showEditor: false,
    isSaving: false,
    isDeleting: false,
    isSavingCupDisplayMode: false,
    editorTitle: '新增积分榜',
    tableTypeOptions: standingsAdminService.TABLE_TYPE_OPTIONS,
    tableTypeIndex: 0,
    formData: standingsAdminService.createEmptyStandingsForm(''),
  },

  draftFormData: standingsAdminService.createEmptyStandingsForm(''),

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
      await this.loadStandingsForEvent(events, activeEventId);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async loadStandingsForEvent(events, eventId) {
    const [currentEvent, standingsRecords, stageGroups] = await Promise.all([
      contentService.getEventById(eventId),
      standingsAdminService.getStandingsRecordsByEvent(eventId),
      contentService.getGroupedMatchesByEvent(eventId),
    ]);

    const eventIndex = Math.max(0, events.findIndex((item) => item.eventId === eventId));
    const defaultTableType = currentEvent && currentEvent.eventType === 'cup' ? 'group' : 'league';
    const nextFormData = {
      ...standingsAdminService.createEmptyStandingsForm(eventId),
      tableType: defaultTableType,
    };
    const cupDisplayMode =
      currentEvent && currentEvent.cupDisplayMode === 'knockout' ? 'knockout' : 'group';
    const knockoutStageGroups =
      currentEvent && currentEvent.eventType === 'cup'
        ? (stageGroups || []).filter((item) => isKnockoutStage(item.stageName))
        : [];
    const tableTypeIndex = Math.max(
      0,
      this.data.tableTypeOptions.findIndex((item) => item.value === defaultTableType),
    );

    this.setData({
      events,
      currentEvent,
      activeEventId: eventId,
      eventIndex,
      standingsRecords,
      knockoutStageGroups,
      cupDisplayMode,
      showEditor: false,
      formData: nextFormData,
      tableTypeIndex,
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
      await this.loadStandingsForEvent(this.data.events, eventId);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async handleCupDisplayModeTap(event) {
    const { mode } = event.currentTarget.dataset;
    const { activeEventId, currentEvent, isSavingCupDisplayMode, cupDisplayMode } = this.data;

    if (!mode || isSavingCupDisplayMode || !currentEvent || currentEvent.eventType !== 'cup') {
      return;
    }

    if (mode === cupDisplayMode) {
      wx.showToast({
        title: '当前已是这个显示顺序',
        icon: 'none',
      });
      return;
    }

    this.setData({ isSavingCupDisplayMode: true });

    try {
      await standingsAdminService.saveCupDisplayMode({
        eventId: activeEventId,
        cupDisplayMode: mode,
        recordId: currentEvent._id || '',
        updatedAt: currentEvent.updatedAt || '',
      });

      contentService.clearCache();
      await this.loadStandingsForEvent(this.data.events, activeEventId);

      wx.showToast({
        title: '显示顺序已保存',
        icon: 'success',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isSavingCupDisplayMode: false });
    }
  },

  openCreateLeagueForm() {
    const nextFormData = {
      ...standingsAdminService.createEmptyStandingsForm(this.data.activeEventId),
      tableType: 'league',
      sortOrder: '0',
    };

    this.setData({
      showEditor: true,
      editorTitle: '编辑联赛总榜',
      formData: nextFormData,
      tableTypeIndex: 0,
    });
    this.draftFormData = { ...nextFormData };
  },

  openCreateGroupForm() {
    const nextFormData = {
      ...standingsAdminService.createEmptyStandingsForm(this.data.activeEventId),
      tableType: 'group',
      sortOrder: String(this.getNextGroupSortOrder()),
    };

    this.setData({
      showEditor: true,
      editorTitle: '新增小组榜',
      formData: nextFormData,
      tableTypeIndex: 1,
    });
    this.draftFormData = { ...nextFormData };
  },

  openEditForm(event) {
    const { recordId } = event.currentTarget.dataset;
    const record = this.findRecord(recordId);
    if (!record) {
      return;
    }

    const nextFormData = {
      recordId: record._id || '',
      updatedAt: record.updatedAt || '',
      eventId: record.eventId || '',
      tableType: record.tableType || 'league',
      groupName: record.groupName || '',
      sortOrder: String(record.sortOrder || 0),
      tableText: standingsAdminService.formatTableText(record.table),
    };
    const tableTypeIndex = Math.max(
      0,
      this.data.tableTypeOptions.findIndex((item) => item.value === nextFormData.tableType),
    );

    this.setData({
      showEditor: true,
      editorTitle: record.tableType === 'group' ? `编辑${record.groupName}` : '编辑联赛总榜',
      formData: nextFormData,
      tableTypeIndex,
    });
    this.draftFormData = { ...nextFormData };
  },

  closeEditor() {
    const defaultTableType =
      this.data.currentEvent && this.data.currentEvent.eventType === 'cup' ? 'group' : 'league';
    const nextFormData = {
      ...standingsAdminService.createEmptyStandingsForm(this.data.activeEventId),
      tableType: defaultTableType,
    };
    const tableTypeIndex = Math.max(
      0,
      this.data.tableTypeOptions.findIndex((item) => item.value === defaultTableType),
    );

    this.setData({
      showEditor: false,
      formData: nextFormData,
      tableTypeIndex,
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

  handleTableTypeChange(event) {
    const tableTypeIndex = Number(event.detail.value);
    const target = this.data.tableTypeOptions[tableTypeIndex];
    if (!target) {
      return;
    }

    const nextGroupName = target.value === 'group' ? this.data.formData.groupName || '' : '';
    this.draftFormData = {
      ...(this.draftFormData || {}),
      tableType: target.value,
      groupName: nextGroupName,
    };

    this.setData({
      tableTypeIndex,
      'formData.tableType': target.value,
      'formData.groupName': nextGroupName,
    });
  },

  handleSaveTap() {
    if (this.data.isSaving) {
      return;
    }

    setTimeout(() => {
      this.submitStandings();
    }, 80);
  },

  async submitStandings(overrideFormData) {
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

    if (!String(formData.tableText || '').trim()) {
      wx.showToast({
        title: '请先填写积分榜内容',
        icon: 'none',
      });
      return;
    }

    if (formData.tableType === 'group' && !String(formData.groupName || '').trim()) {
      wx.showToast({
        title: '小组积分榜必须填写小组名称',
        icon: 'none',
      });
      return;
    }

    this.setData({
      isSaving: true,
      formData,
    });

    try {
      await standingsAdminService.saveStandings(formData);
      contentService.clearCache();

      wx.showToast({
        title: '积分榜已保存',
        icon: 'success',
      });

      await this.loadStandingsForEvent(this.data.events, activeEventId);
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isSaving: false });
    }
  },

  async handleDeleteRecord() {
    const latestFormData = {
      ...this.data.formData,
      ...(this.draftFormData || {}),
    };

    if (!latestFormData.recordId) {
      wx.showToast({
        title: '请先选择一条已有积分榜再删除',
        icon: 'none',
      });
      return;
    }

    if (this.data.isDeleting) {
      return;
    }

    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '删除积分榜',
        content:
          latestFormData.tableType === 'group'
            ? '删除后这个小组榜将无法继续查看，是否确认删除？'
            : '删除后联赛总榜将无法继续查看，是否确认删除？',
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
      await standingsAdminService.deleteStandings({
        recordId: latestFormData.recordId,
        eventId: latestFormData.eventId || this.data.activeEventId,
        tableType: latestFormData.tableType,
        groupName: latestFormData.groupName,
      });
      contentService.clearCache();

      wx.showToast({
        title: '积分榜已删除',
        icon: 'success',
      });

      await this.loadStandingsForEvent(this.data.events, this.data.activeEventId);
    } catch (error) {
      wx.showToast({
        title: error.message || '删除失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isDeleting: false });
    }
  },

  findRecord(recordId) {
    return this.data.standingsRecords.find((item) => item._id === recordId) || null;
  },

  getNextGroupSortOrder() {
    const groupRecords = this.data.standingsRecords.filter((item) => item.tableType === 'group');
    if (!groupRecords.length) {
      return 0;
    }

    return Math.max(...groupRecords.map((item) => Number(item.sortOrder) || 0)) + 1;
  },

  openMatchManager() {
    wx.navigateTo({
      url: '/pages/admin-matches/admin-matches',
    });
  },

  openKnockoutMatchEditor(event) {
    const { eventId, matchId, recordId } = event.currentTarget.dataset;
    const targetEventId = eventId || this.data.activeEventId;
    if (!targetEventId || !matchId) {
      return;
    }

    const query = [
      `eventId=${encodeURIComponent(targetEventId)}`,
      `matchId=${encodeURIComponent(matchId)}`,
      recordId ? `recordId=${encodeURIComponent(recordId)}` : '',
      'openEditor=1',
    ]
      .filter(Boolean)
      .join('&');

    wx.navigateTo({
      url: `/pages/admin-matches/admin-matches?${query}`,
    });
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
