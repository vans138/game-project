import type { Script } from './types';

// ===== 示例剧本（最小可玩）=====
// 三年 = 36 个月。MVP 演示：把若干月挂事件，其余静默学习。
// 人工配置，未来可替换为 AI 生成（结构不变）。

export const AFFINITY_CAP = 20; // 好感总封顶（所有 NPC 好感之和上限）

export const script: Script = {
  id: 'campus_v1',
  title: '校园 · 轮回（MVP 演示剧本）',
  scenes: {
    classroom: { id: 'classroom', name: '教室', color: '#2f3b52' },
    playground: { id: 'playground', name: '操场', color: '#3d5a3b' },
    hall: { id: 'hall', name: '礼堂', color: '#5a3b52' },
    rooftop: { id: 'rooftop', name: '天台', color: '#4a4a4a' },
  },
  npcs: {
    npc_a: { id: 'npc_a', name: '班长', personality: '认真、原则性强', resident: true },
    npc_b: { id: 'npc_b', name: '转学生', personality: '神秘、话少', resident: false },
    npc_c: { id: 'npc_c', name: '同班同学', personality: '开朗、爱八卦', resident: true },
  },
  months: buildMonths(),
  events: {
    first_meet: {
      id: 'first_meet',
      title: '开学 · 初识',
      scene: 'classroom',
      text: '新学期开始。你注意到班长在组织座位，转学生独自坐在角落。',
      choices: [
        { id: 'c1', text: '主动去和班长搭话', effects: [{ type: 'affinity', npc: 'npc_a', value: 2 }, { type: 'flag', name: 'met_monitor' }] },
        { id: 'c2', text: '去角落和转学生说话', effects: [{ type: 'affinity', npc: 'npc_b', value: 2 }] },
        { id: 'c3', text: '安静观察，谁也不理', effects: [{ type: 'goalProgress', value: 1 }] },
      ],
    },
    sports_meet: {
      id: 'sports_meet',
      title: '运动会',
      scene: 'playground',
      text: '运动会。你可以邀请一个人同行，也可以独自观赛。',
      choices: [
        { id: 's1', text: '邀请班长一起看比赛', effects: [{ type: 'affinity', npc: 'npc_a', value: 3 }, { type: 'flag', name: 'sports_with_monitor' }] },
        { id: 's2', text: '邀请转学生', require: { affinityAtLeast: ['npc_b', 2] }, effects: [{ type: 'affinity', npc: 'npc_b', value: 3 }] },
        { id: 's3', text: '独自看，顺便观察谁和谁同行', effects: [{ type: 'goalProgress', value: 2 }, { type: 'flag', name: 'saw_pair' }] },
      ],
    },
    samebox: {
      id: 'samebox',
      title: '同框 · 撞见',
      scene: 'rooftop',
      text: '你在天台撞见班长和转学生争执。这可能是撕开真相的口子。',
      choices: [
        { id: 'x1', text: '走上前问清楚', effects: [{ type: 'goalProgress', value: 3 }, { type: 'flag', name: 'confronted' }] },
        { id: 'x2', text: '躲起来偷听', effects: [{ type: 'goalProgress', value: 4 }, { type: 'flag', name: 'eavesdropped' }] },
        { id: 'x3', text: '转身离开，装作没看见', effects: [{ type: 'affinity', npc: 'npc_a', value: 1 }] },
      ],
    },
    ceremony: {
      id: 'ceremony',
      title: '表彰会',
      scene: 'hall',
      text: '表彰会。光环与嫉妒在同一礼堂里流动。',
      choices: [
        { id: 'y1', text: '上台领奖，接受注目', effects: [{ type: 'affinity', npc: 'npc_c', value: 2 }, { type: 'flag', name: 'on_stage' }] },
        { id: 'y2', text: '在台下与转学生交换眼神', require: { hasIdentity: 'vampire' }, effects: [{ type: 'affinity', npc: 'npc_b', value: 3 }, { type: 'unlock', id: 'vampire_secret' }] },
        { id: 'y3', text: '低调离开', effects: [{ type: 'goalProgress', value: 1 }] },
      ],
    },
  },
};

// 构造 36 个月：给部分月份挂事件，其余静默学习
function buildMonths() {
  const months = [];
  const eventsByMonth: Record<number, string> = {
    1: 'first_meet',
    8: 'sports_meet',     // 高一运动会
    20: 'samebox',        // 高二某月同框事件
    30: 'ceremony',       // 高三表彰会
  };
  for (let i = 1; i <= 36; i++) {
    const year = i <= 12 ? 1 : i <= 24 ? 2 : 3;
    const m = ((i - 1) % 12) + 1;
    months.push({
      index: i,
      label: `高${['一', '二', '三'][year - 1]} · 第${m}月`,
      eventId: eventsByMonth[i],
      silentStudy: !eventsByMonth[i],
    });
  }
  return months;
}