// 第一份剧本（v5）：青川中学 · Y1 上学期 + 寒假（Y1-9 ~ Y2-2）
// 相对 v4.3 的变更：
//   1) 删掉冲突顶层数据，改为身份驱动
//   2) 引入 identities（本批只有龙烬余孤）
//   3) timeline 重排：11 月期中、1 月期末、2 月寒假
//   4) interactEvents 先留空数组（骨架阶段）
//   5) 世界因子本批不激活：保留 factorPool / factorGroups 但只留一两个占位

import type {
  Script,
  MonthDef,
  FactorDef,
  FactorGroup,
  IdentityDef,
} from './types'

// ---------- 玄幻身份：龙烬余孤 ----------
// 选择的身份 → 随机从 pool 里抽一个身份因子（玩家不可见）
const identities: IdentityDef[] = [
  {
    id: 'longjin_yugu',
    name: '龙烬余孤',
    desc: '世间最后一条血脉驳杂的龙。你不知道自己是被封印的容器，还是被封印者本身。',
    identityFactorPool: ['seal', 'ancient'],
  },
]

// ---------- 因子池（本批不激活世界因子，仅保留占位）----------
const factorPool: FactorDef[] = []

// 互斥组留空，避免本批牵动 factorEvolve 逻辑
const factorGroups: FactorGroup[] = []

// ---------- 时间轴 ----------
// 本批只铺 Y1-9 到 Y2-2 共 6 个月：
//   Y1-9  开学月（事件月：开学，导入用）
//   Y1-10 普通月
//   Y1-11 期中月（固定事件：期中考试）
//   Y1-12 普通月
//   Y1-1  期末月（固定事件：期末考试）
//   Y1-2  寒假（假期月，跳过）
function buildTimeline(): MonthDef[] {
  return [
    { index: 1, year: 1, month: 9,  type: 'school',  stepCount: 2, fixedEvent: 'e_term_open',    silentStudy: true },
    { index: 2, year: 1, month: 10, type: 'school',  stepCount: 2,                                silentStudy: true },
    { index: 3, year: 1, month: 11, type: 'school',  stepCount: 2, fixedEvent: 'e_mid_exam',     silentStudy: true },
    { index: 4, year: 1, month: 12, type: 'school',  stepCount: 2,                                silentStudy: true },
    { index: 5, year: 1, month: 1,  type: 'school',  stepCount: 2, fixedEvent: 'e_final_exam',   silentStudy: true },
    { index: 6, year: 1, month: 2,  type: 'holiday', stepCount: 1,                                silentStudy: false },
  ]
}

// ---------- 剧本导出 ----------
export const SCRIPT_1: Script = {
  id: 'campus-y1-upper',
  meta: { title: '轮回校园', era: '当代', place: '青川中学' },

  identities,

  // 身份取代角色后，roles 本批保留占位（UI 不再用）
  roles: [],

  npcs: [
    { id: 'npc_lin',   name: '林老师',   type: 'resident', personality: '严肃公正', affinityStart: 10, persistAcrossRuns: true, place: '教学楼', relation: '尊' },
    { id: 'npc_qiu',   name: '邱同学',   type: 'resident', personality: '热心八卦', affinityStart: 20, persistAcrossRuns: true, place: '教室',   relation: '友' },
    { id: 'npc_moon',  name: '月亮学姐', type: 'resident', personality: '神神秘秘', affinityStart: 0,  persistAcrossRuns: true, place: '旧楼',   relation: '谜' },
    { id: 'npc_yao',   name: '姚主任',   type: 'resident', personality: '刻板严厉', affinityStart: 0,  persistAcrossRuns: true, place: '办公室', relation: '敌' },
    { id: 'npc_shen',  name: '沈星河',   type: 'resident', personality: '冷淡学霸', affinityStart: 5,  persistAcrossRuns: true, place: '图书馆', relation: '友' },
    { id: 'npc_jiang', name: '江晴',     type: 'resident', personality: '开朗体委', affinityStart: 10, persistAcrossRuns: true, place: '操场',   relation: '友' },
    { id: 'npc_he',    name: '何老师',   type: 'resident', personality: '温和心理', affinityStart: 15, persistAcrossRuns: true, place: '办公室', relation: '尊' },
    { id: 'npc_gu',    name: '顾伯',     type: 'resident', personality: '沉默校工', affinityStart: 5,  persistAcrossRuns: true, place: '旧楼',   relation: '谜' },
  ],

  goals: [
    { id: 'g_truth',  title: '揭开轮回真相',      target: 5 },
    { id: 'g_bond',   title: '与一个人建立真关系',  target: 5 },
  ],

  // 好感总封顶
  affinityCap: 100,

  timeline: buildTimeline(),

  // 事件：本批只给「固定事件」和「最小占位」。内容下一批填。
  events: [
    {
      id: 'e_term_open',
      kind: 'fixed', season: 'school',
      title: '开学典礼',
      narrative: '九月的操场，升旗、训话、人群。你站在队伍里，忽然有一瞬间说不清自己是谁。',
      choices: [
        { id: 'c1', text: '跟着人群唱校歌', effects: [] },
        { id: 'c2', text: '发呆看着天空',   effects: [] },
      ],
    },
    {
      id: 'e_mid_exam',
      kind: 'fixed', season: 'school',
      title: '期中考试',
      narrative: '考试周。考场安静得能听见翻卷声。',
      choices: [
        { id: 'c1', text: '认真答题', effects: [] },
        { id: 'c2', text: '答完提早交卷', effects: [] },
      ],
    },
    {
      id: 'e_final_exam',
      kind: 'fixed', season: 'school',
      title: '期末考试',
      narrative: '一年中最重的一场考试。窗外的树在风里响。',
      choices: [
        { id: 'c1', text: '认真答题', effects: [] },
        { id: 'c2', text: '答完提早交卷', effects: [] },
      ],
    },
  ],

  outcomes: [
    {
      id: 'o_default', title: '【暂时】学期未完',
      narrative: '这段时间结束。',
      minGoalRatio: 0,
    },
  ],

  factorPool,
  factorGroups,
  interactEvents: [],   // 骨架阶段：空池，引擎能跑但不出事件
}