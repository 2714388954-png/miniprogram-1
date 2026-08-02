const adminService = require('../../services/admin-service');
const contentService = require('../../services/content-service');
const matchAdminService = require('../../services/match-admin-service');

function createEmptyForm(eventId) {
  return {
    recordId: '',
    eventId: eventId || '',
    matchId: '',
    stage: '',
    groupName: '',
    homeTeam: '',
    awayTeam: '',
    matchTime: '',
    location: '',
    status: 'not_started',
    homeScore: '',
    awayScore: '',
    reportNewsId: '',
    reportTitle: '',
    scorersText: '',
    report: '',
  };
}

function buildScorersText(scorers) {
  return (scorers || [])
    .map((item) => [item.player || '', item.team || '', item.minute || ''].join(' | '))
    .join('\n');
}

Page({
  data: {
    events: [],
    eventIndex: 0,
    activeEventId: '',
    stageGroups: [],
    isLoading: true,
    showEditor: false,
    isSaving: false,
    editorTitle: '新增比赛',
    statusOptions: matchAdminService.STATUS_OPTIONS,
    statusIndex: 0,
    formData: createEmptyForm(''),
  },

  draftFormData: createEmptyForm(''),

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
      await this.loadMatchesForEvent(events, activeEventId);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async loadMatchesForEvent(events, eventId) {
    const stageGroups = eventId ? await matchAdminService.getMatchesByEvent(eventId) : [];
    const eventIndex = Math.max(
      0,
      events.findIndex((item) => item.eventId === eventId)
    );
    const nextFormData = createEmptyForm(eventId);

    this.setData({
      events,
      eventIndex,
      activeEventId: eventId,
      stageGroups,
      showEditor: false,
      formData: nextFormData,
      statusIndex: 0,
    });
    this.draftFormData = { ...nextFormData };
  },

  async handleEventChange(event) {
    const eventIndex = Number(event.detail.value);
    const targetEvent = this.data.events[eventIndex];
    if (!targetEvent) {
      return;
    }

    this.setData({ isLoading: true });
    try {
      await this.loadMatchesForEvent(this.data.events, targetEvent.eventId);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async handleEventSwitch(event) {
    const { eventId } = event.currentTarget.dataset;
    if (!eventId || eventId === this.data.activeEventId) {
      return;
    }

    this.setData({ isLoading: true });
    try {
      await this.loadMatchesForEvent(this.data.events, eventId);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  openCreateForm() {
    const activeEventId = this.data.activeEventId;
    const nextFormData = createEmptyForm(activeEventId);

    this.setData({
      showEditor: true,
      editorTitle: '新增比赛',
      formData: nextFormData,
      statusIndex: 0,
    });
    this.draftFormData = { ...nextFormData };
  },

  openEditForm(event) {
    const { matchId, recordId } = event.currentTarget.dataset;
    const matchItem = this.findMatch(recordId, matchId);
    if (!matchItem) {
      return;
    }

    const statusIndex = Math.max(
      0,
      this.data.statusOptions.findIndex((item) => item.value === matchItem.status)
    );

    const nextFormData = {
      recordId: matchItem._id || '',
      eventId: matchItem.eventId,
      matchId: matchItem.matchId,
      stage: matchItem.stage,
      groupName: matchItem.groupName || '',
      homeTeam: matchItem.homeTeam,
      awayTeam: matchItem.awayTeam,
      matchTime: matchItem.matchTime,
      location: matchItem.location,
      status: matchItem.status,
      homeScore:
        matchItem.homeScore === null || matchItem.homeScore === undefined
          ? ''
          : String(matchItem.homeScore),
      awayScore:
        matchItem.awayScore === null || matchItem.awayScore === undefined
          ? ''
          : String(matchItem.awayScore),
      reportNewsId: matchItem.reportNewsId || '',
      reportTitle: matchItem.reportTitle || '',
      scorersText: buildScorersText(matchItem.scorers),
      report: matchItem.report || '',
    };

    this.setData({
      showEditor: true,
      editorTitle: '编辑比赛',
      statusIndex,
      formData: nextFormData,
    });
    this.draftFormData = { ...nextFormData };
  },

  closeEditor() {
    const nextFormData = createEmptyForm(this.data.activeEventId);
    this.setData({
      showEditor: false,
      formData: nextFormData,
      statusIndex: 0,
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

  handleStatusChange(event) {
    const statusIndex = Number(event.detail.value);
    const target = this.data.statusOptions[statusIndex];
    if (!target) {
      return;
    }

    this.draftFormData = {
      ...(this.draftFormData || {}),
      status: target.value,
    };

    this.setData({
      statusIndex,
      'formData.status': target.value,
    });
  },

  handleSaveTap() {
    if (this.data.isSaving) {
      return;
    }

    // Give iOS input/textarea blur events a brief moment to flush latest text.
    setTimeout(() => {
      this.submitMatch();
    }, 80);
  },

  async submitMatch(overrideFormData) {
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
      !formData.matchId.trim() ||
      !formData.stage.trim() ||
      !formData.homeTeam.trim() ||
      !formData.awayTeam.trim()
    ) {
      wx.showToast({
        title: '请先填写比赛编号、轮次和对阵双方',
        icon: 'none',
      });
      return;
    }

    if (!formData.matchTime.trim() || !formData.location.trim()) {
      wx.showToast({
        title: '请先填写比赛时间和地点',
        icon: 'none',
      });
      return;
    }

    if (formData.status === 'finished' && (formData.homeScore === '' || formData.awayScore === '')) {
      wx.showToast({
        title: '已结束比赛需要填写比分',
        icon: 'none',
      });
      return;
    }

    this.setData({
      isSaving: true,
      formData,
    });

    try {
      await matchAdminService.saveMatch(formData);

      wx.showToast({
        title: '比赛已保存',
        icon: 'success',
      });

      const stageGroups = await matchAdminService.getMatchesByEvent(activeEventId);
      const nextFormData = createEmptyForm(activeEventId);

      this.setData({
        stageGroups,
        showEditor: false,
        formData: nextFormData,
        statusIndex: 0,
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

  findMatch(recordId, matchId) {
    const { stageGroups } = this.data;
    for (let i = 0; i < stageGroups.length; i += 1) {
      const target = stageGroups[i].matches.find((item) => {
        if (recordId && item._id) {
          return item._id === recordId;
        }
        return item.matchId === matchId;
      });
      if (target) {
        return target;
      }
    }
    return null;
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
