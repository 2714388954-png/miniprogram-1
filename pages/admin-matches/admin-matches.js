const adminService = require('../../services/admin-service');
const contentService = require('../../services/content-service');
const matchAdminService = require('../../services/match-admin-service');

const CUP_STAGE_PRESETS = [
  { value: '小组赛', label: '小组赛', groupHint: true },
  { value: '16进8', label: '16进8', groupHint: false },
  { value: '8进4', label: '8进4', groupHint: false },
  { value: '半决赛', label: '半决赛', groupHint: false },
  { value: '三四名决赛', label: '三四名决赛', groupHint: false },
  { value: '决赛', label: '决赛', groupHint: false },
];

function createEmptyForm(eventId) {
  return {
    recordId: '',
    updatedAt: '',
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

function createEmptyEventForm() {
  return {
    recordId: '',
    updatedAt: '',
    eventId: '',
    eventName: '',
    fullName: '',
    eventType: 'league',
    season: '',
    description: '',
    status: 'upcoming',
    sortOrder: '0',
    coverImage: '',
    cupDisplayMode: 'group',
  };
}

function buildScorersText(scorers) {
  return (scorers || [])
    .map((item) => [item.player || '', item.team || '', item.minute || ''].join('，'))
    .join('\n');
}

function buildNewsOptions(newsList) {
  const options = [
    {
      value: '',
      title: '不关联新闻',
      rawTitle: '',
      detail: '这场比赛暂时不跳转战报',
    },
  ];

  (newsList || []).forEach((item) => {
    options.push({
      value: item.newsId,
      title: `${item.newsId} | ${item.title || '未命名新闻'}`,
      rawTitle: item.title || '',
      detail: `${item.newsId} · ${item.publishTime || '未填写发布时间'}`,
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
    eventIndex: 0,
    activeEventId: '',
    currentEvent: null,
    stageGroups: [],
    newsOptions: buildNewsOptions([]),
    newsOptionIndex: 0,
    isLoading: true,
    showEditor: false,
    showEventEditor: false,
    isSaving: false,
    isSavingEvent: false,
    editorTitle: '新增比赛',
    eventEditorTitle: '编辑赛事',
    statusOptions: matchAdminService.STATUS_OPTIONS,
    eventStatusOptions: matchAdminService.EVENT_STATUS_OPTIONS,
    eventTypeOptions: matchAdminService.EVENT_TYPE_OPTIONS,
    cupDisplayModeOptions: matchAdminService.CUP_DISPLAY_MODE_OPTIONS,
    cupStagePresets: CUP_STAGE_PRESETS,
    statusIndex: 0,
    eventStatusIndex: 0,
    eventTypeIndex: 0,
    eventDisplayModeIndex: 0,
    formData: createEmptyForm(''),
    eventFormData: createEmptyEventForm(),
  },

  draftFormData: createEmptyForm(''),
  draftEventFormData: createEmptyEventForm(),
  pendingOpenParams: null,

  async onLoad(options) {
    const session = adminService.getSession();
    if (!session) {
      wx.redirectTo({
        url: '/pages/admin-login/admin-login',
      });
      return;
    }

    this.pendingOpenParams = {
      eventId: options && options.eventId ? decodeURIComponent(options.eventId) : '',
      matchId: options && options.matchId ? decodeURIComponent(options.matchId) : '',
      recordId: options && options.recordId ? decodeURIComponent(options.recordId) : '',
      openEditor: options && options.openEditor === '1',
    };

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
      const preferredEventId = this.pendingOpenParams && this.pendingOpenParams.eventId;
      const activeEventId = preferredEventId || (events[0] ? events[0].eventId : '');
      await this.loadMatchesForEvent(events, activeEventId);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async loadMatchesForEvent(events, eventId) {
    const [stageGroups, currentEvent, newsList] = await Promise.all([
      eventId ? matchAdminService.getMatchesByEvent(eventId) : [],
      eventId ? contentService.getEventById(eventId) : null,
      eventId ? contentService.getNewsByEvent(eventId) : [],
    ]);
    const eventIndex = Math.max(0, events.findIndex((item) => item.eventId === eventId));
    const nextFormData = createEmptyForm(eventId);
    const newsOptions = buildNewsOptions(newsList);

    this.setData({
      events,
      eventIndex,
      activeEventId: eventId,
      currentEvent,
      stageGroups,
      newsOptions,
      newsOptionIndex: 0,
      showEditor: false,
      showEventEditor: false,
      formData: nextFormData,
      statusIndex: 0,
    });
    this.draftFormData = { ...nextFormData };

    this.tryOpenPendingMatchEditor();
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
      newsOptionIndex: 0,
      statusIndex: 0,
    });
    this.draftFormData = { ...nextFormData };
  },

  openEventEditor() {
    const currentEvent = this.data.currentEvent;
    if (!currentEvent) {
      return;
    }

    const eventStatusIndex = Math.max(
      0,
      this.data.eventStatusOptions.findIndex((item) => item.value === (currentEvent.status || 'upcoming')),
    );
    const eventTypeIndex = Math.max(
      0,
      this.data.eventTypeOptions.findIndex((item) => item.value === (currentEvent.eventType || 'league')),
    );
    const eventDisplayModeIndex = Math.max(
      0,
      this.data.cupDisplayModeOptions.findIndex((item) => item.value === (currentEvent.cupDisplayMode || 'group')),
    );

    const nextFormData = {
      recordId: currentEvent._id || '',
      updatedAt: currentEvent.updatedAt || '',
      eventId: currentEvent.eventId || '',
      eventName: currentEvent.eventName || '',
      fullName: currentEvent.fullName || '',
      eventType: currentEvent.eventType || 'league',
      season: currentEvent.season || '',
      description: currentEvent.description || '',
      status: currentEvent.status || 'upcoming',
      sortOrder:
        currentEvent.sortOrder === undefined || currentEvent.sortOrder === null ? '0' : String(currentEvent.sortOrder),
      coverImage: currentEvent.coverImage || '',
      cupDisplayMode: currentEvent.cupDisplayMode || 'group',
    };

    this.setData({
      showEventEditor: true,
      eventEditorTitle: '编辑赛事',
      eventStatusIndex,
      eventTypeIndex,
      eventDisplayModeIndex,
      eventFormData: nextFormData,
    });
    this.draftEventFormData = { ...nextFormData };
  },

  openCreateEventForm() {
    const nextFormData = createEmptyEventForm();
    const nextSortOrder = this.data.events.length;
    nextFormData.sortOrder = String(nextSortOrder);

    this.setData({
      showEventEditor: true,
      eventEditorTitle: '新增赛事',
      eventStatusIndex: 0,
      eventTypeIndex: 0,
      eventDisplayModeIndex: 0,
      eventFormData: nextFormData,
    });
    this.draftEventFormData = { ...nextFormData };
  },

  openEditForm(event) {
    const { matchId, recordId } = event.currentTarget.dataset;
    const matchItem = this.findMatch(recordId, matchId);
    if (!matchItem) {
      return;
    }

    const statusIndex = Math.max(
      0,
      this.data.statusOptions.findIndex((item) => item.value === matchItem.status),
    );

    const nextFormData = {
      recordId: matchItem._id || '',
      updatedAt: matchItem.updatedAt || '',
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
        matchItem.homeScore === null || matchItem.homeScore === undefined ? '' : String(matchItem.homeScore),
      awayScore:
        matchItem.awayScore === null || matchItem.awayScore === undefined ? '' : String(matchItem.awayScore),
      reportNewsId: matchItem.reportNewsId || '',
      reportTitle: matchItem.reportTitle || '',
      scorersText: buildScorersText(matchItem.scorers),
      report: matchItem.report || '',
    };
    const newsOptionIndex = findOptionIndex(this.data.newsOptions, nextFormData.reportNewsId);

    this.setData({
      showEditor: true,
      editorTitle: '编辑比赛',
      statusIndex,
      newsOptionIndex,
      formData: nextFormData,
    });
    this.draftFormData = { ...nextFormData };
  },

  closeEditor() {
    const nextFormData = createEmptyForm(this.data.activeEventId);
    this.setData({
      showEditor: false,
      formData: nextFormData,
      newsOptionIndex: 0,
      statusIndex: 0,
    });
    this.draftFormData = { ...nextFormData };
  },

  closeEventEditor() {
    const nextFormData = createEmptyEventForm();
    this.setData({
      showEventEditor: false,
      eventStatusIndex: 0,
      eventTypeIndex: 0,
      eventDisplayModeIndex: 0,
      eventFormData: nextFormData,
    });
    this.draftEventFormData = { ...nextFormData };
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

  fillScorersExample() {
    const scorersText = ['张三，经管学院，28', '李四，机械学院，64'].join('\n');

    this.draftFormData = {
      ...(this.draftFormData || {}),
      scorersText,
    };

    this.setData({
      'formData.scorersText': scorersText,
    });
  },

  clearScorersText() {
    this.draftFormData = {
      ...(this.draftFormData || {}),
      scorersText: '',
    };

    this.setData({
      'formData.scorersText': '',
    });
  },

  applyCupStagePreset(event) {
    const { stage } = event.currentTarget.dataset;
    if (!stage) {
      return;
    }

    const nextPatch = { stage };

    if (stage !== '小组赛') {
      nextPatch.groupName = '';
    }

    this.draftFormData = {
      ...(this.draftFormData || {}),
      ...nextPatch,
    };

    this.setData({
      'formData.stage': nextPatch.stage,
      ...(stage !== '小组赛' ? { 'formData.groupName': '' } : {}),
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

  handleEventFieldInput(event) {
    const { field } = event.currentTarget.dataset;
    const nextValue = event.detail.value;

    this.draftEventFormData = {
      ...(this.draftEventFormData || {}),
      [field]: nextValue,
    };

    this.setData({
      [`eventFormData.${field}`]: nextValue,
    });
  },

  handleEventStatusChange(event) {
    const eventStatusIndex = Number(event.detail.value);
    const target = this.data.eventStatusOptions[eventStatusIndex];
    if (!target) {
      return;
    }

    this.draftEventFormData = {
      ...(this.draftEventFormData || {}),
      status: target.value,
    };

    this.setData({
      eventStatusIndex,
      'eventFormData.status': target.value,
    });
  },

  handleEventTypeChange(event) {
    const eventTypeIndex = Number(event.detail.value);
    const target = this.data.eventTypeOptions[eventTypeIndex];
    if (!target) {
      return;
    }

    const nextPatch = {
      eventType: target.value,
    };

    if (target.value !== 'cup') {
      nextPatch.cupDisplayMode = 'group';
    }

    this.draftEventFormData = {
      ...(this.draftEventFormData || {}),
      ...nextPatch,
    };

    this.setData({
      eventTypeIndex,
      ...(target.value !== 'cup' ? { eventDisplayModeIndex: 0 } : {}),
      'eventFormData.eventType': target.value,
      ...(target.value !== 'cup' ? { 'eventFormData.cupDisplayMode': 'group' } : {}),
    });
  },

  handleEventDisplayModeChange(event) {
    const eventDisplayModeIndex = Number(event.detail.value);
    const target = this.data.cupDisplayModeOptions[eventDisplayModeIndex];
    if (!target) {
      return;
    }

    this.draftEventFormData = {
      ...(this.draftEventFormData || {}),
      cupDisplayMode: target.value,
    };

    this.setData({
      eventDisplayModeIndex,
      'eventFormData.cupDisplayMode': target.value,
    });
  },

  handleRelatedNewsChange(event) {
    const newsOptionIndex = Number(event.detail.value);
    const target = this.data.newsOptions[newsOptionIndex] || this.data.newsOptions[0];
    const reportNewsId = target ? target.value : '';
    const reportTitle = reportNewsId ? (target.rawTitle || '') : '';

    this.draftFormData = {
      ...(this.draftFormData || {}),
      reportNewsId,
      reportTitle,
    };

    this.setData({
      newsOptionIndex,
      'formData.reportNewsId': reportNewsId,
      'formData.reportTitle': reportTitle,
    });
  },

  handleSaveTap() {
    if (this.data.isSaving) {
      return;
    }

    setTimeout(() => {
      this.submitMatch();
    }, 80);
  },

  handleSaveEventTap() {
    if (this.data.isSavingEvent) {
      return;
    }

    setTimeout(() => {
      this.submitEvent();
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

      const nextFormData = createEmptyForm(activeEventId);
      await this.loadMatchesForEvent(this.data.events, activeEventId);

      this.setData({
        showEditor: false,
        formData: nextFormData,
        newsOptionIndex: 0,
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

  async submitEvent(overrideFormData) {
    const { isSavingEvent, activeEventId } = this.data;
    if (isSavingEvent) {
      return;
    }

    const formData = {
      ...this.data.eventFormData,
      ...(this.draftEventFormData || {}),
      ...(overrideFormData || {}),
    };

    if (
      !String(formData.eventId || '').trim() ||
      !String(formData.eventName || '').trim() ||
      !String(formData.fullName || '').trim() ||
      !String(formData.season || '').trim()
    ) {
      wx.showToast({
        title: '请先填写赛事编号、赛事简称、赛事全称和赛季',
        icon: 'none',
      });
      return;
    }

    this.setData({
      isSavingEvent: true,
      eventFormData: formData,
    });

    try {
      const savedEvent = await matchAdminService.saveEvent(formData);
      const nextActiveEventId = savedEvent && savedEvent.eventId ? savedEvent.eventId : activeEventId;

      wx.showToast({
        title: '赛事已保存',
        icon: 'success',
      });

      await this.loadPage();

      if (nextActiveEventId && nextActiveEventId !== this.data.activeEventId) {
        await this.loadMatchesForEvent(this.data.events, nextActiveEventId);
      }

      const nextFormData = createEmptyEventForm();
      this.setData({
        showEventEditor: false,
        eventStatusIndex: 0,
        eventTypeIndex: 0,
        eventDisplayModeIndex: 0,
        eventFormData: nextFormData,
      });
      this.draftEventFormData = { ...nextFormData };
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isSavingEvent: false });
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

  tryOpenPendingMatchEditor() {
    const pending = this.pendingOpenParams;
    if (!pending || !pending.openEditor) {
      return;
    }

    if (pending.eventId && pending.eventId !== this.data.activeEventId) {
      return;
    }

    const targetMatch = this.findMatch(pending.recordId, pending.matchId);
    if (!targetMatch) {
      return;
    }

    this.pendingOpenParams = null;
    this.openEditForm({
      currentTarget: {
        dataset: {
          matchId: targetMatch.matchId,
          recordId: targetMatch._id || '',
        },
      },
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
