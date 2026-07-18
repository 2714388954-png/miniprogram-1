const stats = {
  '2026-spring-league': {
    scorers: [
      { playerId: 'player-001', playerName: '张三', teamName: '经管学院', value: 5, rank: 1 },
      { playerId: 'player-002', playerName: '李四', teamName: '电气学院', value: 4, rank: 2 },
      { playerId: 'player-003', playerName: '王五', teamName: '机械学院', value: 3, rank: 3 },
    ],
    assists: [
      { playerId: 'player-004', playerName: '赵六', teamName: '经管学院', value: 4, rank: 1 },
      { playerId: 'player-005', playerName: '孙七', teamName: '计算机学院', value: 3, rank: 2 },
    ],
    yellowCards: [
      { playerId: 'player-006', playerName: '周八', teamName: '土木学院', value: 2, rank: 1 },
      { playerId: 'player-007', playerName: '吴九', teamName: '材料学院', value: 1, rank: 2 },
    ],
    redCards: [
      { playerId: 'player-008', playerName: '郑十', teamName: '法学院', value: 1, rank: 1 },
    ],
  },
  '2026-freshman-cup': {
    scorers: [
      { playerId: 'cup-player-001', playerName: '陈一', teamName: '法学院', value: 2, rank: 1 },
      { playerId: 'cup-player-002', playerName: '刘二', teamName: '计算机学院', value: 1, rank: 2 },
    ],
    assists: [
      { playerId: 'cup-player-003', playerName: '黄三', teamName: '外国语学院', value: 1, rank: 1 },
    ],
    yellowCards: [
      { playerId: 'cup-player-004', playerName: '许四', teamName: '生科学院', value: 1, rank: 1 },
    ],
    redCards: [],
  },
};

module.exports = {
  stats,
};
