const news = [
  {
    newsId: 'news-001',
    eventId: '2026-spring-league',
    title: '经管学院补时绝杀，首轮拿下关键三分',
    summary: '第1轮焦点战中，经管学院在终场前完成绝杀，2比1战胜电气学院。',
    coverImage: '/assets/covers/news-match.svg',
    publishTime: '2026-03-15 18:30',
    category: '赛事战报',
    isFeatured: true,
    isPinned: true,
    priority: 100,
    views: 328,
    content:
      '春季联赛首轮比赛中，经管学院与电气学院奉献了一场高强度对抗。双方上半场各有攻守，下半场节奏进一步提升，经管学院在补时阶段完成制胜进球，拿到赛季开门红。',
  },
  {
    newsId: 'news-002',
    eventId: '2026-spring-league',
    title: '春季联赛第二轮赛程公布',
    summary: '第二轮比赛将于本周末继续进行，南区球场和虎溪球场同步开赛。',
    coverImage: '/assets/covers/news-schedule.svg',
    publishTime: '2026-03-18 12:00',
    category: '赛前预告',
    isFeatured: true,
    isPinned: false,
    priority: 72,
    views: 186,
    content:
      '第二轮赛程已经完成排定，各学院球队将于本周末继续展开较量。请关注具体开球时间与场地信息，文明观赛，共同维护良好的校园赛事氛围。',
  },
  {
    newsId: 'news-003',
    eventId: '2026-spring-league',
    title: '射手榜更新，张三暂列榜首',
    summary: '首轮过后，张三以2粒进球暂居射手榜第一。',
    coverImage: '/assets/covers/news-stats.svg',
    publishTime: '2026-03-19 09:20',
    category: '球员数据',
    isFeatured: false,
    isPinned: false,
    priority: 68,
    views: 241,
    content:
      '随着首轮赛事全部结束，球员数据榜单同步更新。经管学院前锋张三以2粒进球暂居射手榜第一，助攻榜和纪律榜也已同步开放查询。',
  },
  {
    newsId: 'news-004',
    eventId: '2026-freshman-cup',
    title: '新生杯分组抽签结果出炉',
    summary: 'A组、B组名单确认，小组赛将于4月上旬正式开打。',
    coverImage: '/assets/covers/news-cup.svg',
    publishTime: '2026-04-01 20:00',
    category: '协会公告',
    isFeatured: true,
    isPinned: true,
    priority: 96,
    views: 412,
    content:
      '新生杯分组抽签工作已经结束，各参赛队伍将按照分组开展小组赛。赛事信息将统一在小程序内更新，同学们可以通过赛程页和积分榜页实时查看比赛进展。',
  },
];

module.exports = {
  news,
};
