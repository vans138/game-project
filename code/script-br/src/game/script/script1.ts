// 第一份剧本：青川中学 · 三年（9月入学 → 三年后9月大学录取）
// 单玩家，11 个 NPC（8 常驻 + 3 随机）。
//
// 本版重点（v4）：
//   1) 因子层对齐「互斥组」模型：factorPool 只留 id/title，factorGroups 配组与概率；
//   2) 「因子未来」组 id 约定为 "<原因子id>::future"，special='future'；
//   3) 其余数据（矛盾 / 关系边 / 冲突事件源 / NPC 影响 / 事件 season / 时间轴）沿用 v3。

import type {
  Script,
  MonthDef,
  Conflict,
  ConflictLink,
  ConflictEventLink,
  ConflictNpcEffect,
  FactorDef,
  FactorGroup,
} from './types'

// ---------- 矛盾点（核心插座） ----------
const conflicts: Conflict[] = [
  {
    id: 'c_parents',
    title: '父母不合',
    parties: ['家族', 'npc_lin'],
    tags: ['family', 'vampire', 'spirit'],
    data: {
      demandA: '希望孩子留在家族',
      demandB: '希望孩子远离家族',
      solvePaths: ['调解', '选边', '隐瞒'],
      fog: 3,
    },
  },
  {
    id: 'c_old_door',
    title: '旧楼那扇门',
    parties: ['npc_moon', 'npc_gu', 'npc_yao'],
    tags: ['campus', 'truth'],
    data: { fog: 5, witness: 'npc_gu' },
  },
  {
    id: 'c_top_rank',
    title: '年级第一之争',
    parties: ['npc_shen', 'npc_lin'],
    tags: ['campus', 'study'],
    data: { fog: 2, prize: '奖学金名额' },
  },
]

// ---------- 矛盾 ↔ 矛盾 关系边 ----------
const conflictLinks: ConflictLink[] = [
  { from: 'c_parents', to: 'c_top_rank', kind: 'mutex', data: { note: '家族把你往学业上推' } },
  { from: 'c_old_door', to: 'c_parents', kind: 'reveals', data: { note: '门后揭示家族旧事' } },
]

// ---------- 矛盾 ↔ 事件（矛盾作为事件源） ----------
const conflictEventLinks: ConflictEventLink[] = [
  { conflictId: 'c_parents', eventId: 'e_open', kind: 'seed', season: 'school' },
  { conflictId: 'c_parents', eventId: 'e_midterm', kind: 'escalate', season: 'school' },
  { conflictId: 'c_parents', eventId: 'e_holiday_family', kind: 'resolve', season: 'holiday' },
  { conflictId: 'c_old_door', eventId: 'e_night', kind: 'spawn', season: 'both' },
  { conflictId: 'c_old_door', eventId: 'e_year_end', kind: 'escalate', season: 'school' },
  { conflictId: 'c_top_rank', eventId: 'e_study', kind: 'spawn', season: 'school' },
]

// ---------- 矛盾 ↔ NPC 影响（动态，取满足条件的第一条） ----------
const conflictNpcEffects: ConflictNpcEffect[] = [
  { conflictId: 'c_parents', npcId: 'npc_lin', value: -3, reversible: true },
  {
    conflictId: 'c_old_door',
    npcId: 'npc_he',
    value: 5,
    reversible: true,
    require: { flag: 'opened_door' },
  },
  { conflictId: 'c_old_door', npcId: 'npc_gu', value: 4, reversible: true },
]

// ---------- 因子池（极简：只有身份信息） ----------
// 大因子/小因子仅靠命名与语义规范，此处不再有 tier 字段。
const factorPool: FactorDef[] = [
  // 家族线
  { id: 'f_family',      title: '家族裂痕' },
  // 旧楼线
  { id: 'f_oldfloor',    title: '旧楼低语' },
  // 学业线
  { id: 'f_rivalry',     title: '学业竞争' },
  // 小因子（局部摆动）
  { id: 'f_new_seatmate', title: '换了同桌' },
  { id: 'f_rainy_week',   title: '连绵阴雨' },
  // 未来因子（作为"因子未来"组的落点）
  { id: 'f_family_reconciled', title: '家族和解' },
  { id: 'f_family_broken',     title: '家族决裂' },
  { id: 'f_door_open',         title: '门被打开' },
  { id: 'f_door_sealed',       title: '门被封死' },
]

// ---------- 因子互斥组 ----------
// 约定：
//   普通组：组内按 chance 独立互斥选取（剩余概率 = 都不选）
//   未来组：special='future'，id 约定 "<原因子id>::future"
//           * 一定触发
//           * 视为该因子本轮最后一次触发
//           * 触发后原因子 off（由引擎在演化后处理）
// 组与组之间的触发顺序/条件由配置层人工约定（引擎按"当前激活因子"筛出参与的组）。

const factorGroups: FactorGroup[] = [
  // ---- 开局主基调组：大因子互斥选取 ----
  // 家族裂痕 45% / 旧楼低语 35% / 学业竞争 20%（之和 1.0）
  {
    id: 'grp_opening_theme',
    data: { note: '开局主基调，三选一' },
    members: [
      { factorId: 'f_family',   chance: 0.45 },
      { factorId: 'f_oldfloor', chance: 0.35 },
      { factorId: 'f_rivalry',  chance: 0.2 },
    ],
  },

  // ---- 小因子组（非互斥独立触发：把它们拆成两个"单选组"也行，这里保留为单组独立）----
  // 换同桌 60%，否则不变（剩余 40% = 都不选）
  {
    id: 'grp_small_seatmate',
    members: [{ factorId: 'f_new_seatmate', chance: 0.6 }],
  },
  // 阴雨周 30%
  {
    id: 'grp_small_rain',
    members: [{ factorId: 'f_rainy_week', chance: 0.3 }],
  },

  // ---- 家族线的未来：由 f_family 驱动 ----
  // 命中后原因子 f_family 关闭；二选一（和解 60% / 决裂 40%）
  {
    id: 'f_family::future',
    special: 'future',
    data: { ownerFactorId: 'f_family' },
    members: [
      { factorId: 'f_family_reconciled', chance: 0.6 },
      { factorId: 'f_family_broken',     chance: 0.4 },
    ],
  },

  // ---- 旧楼线的未来：由 f_oldfloor 驱动 ----
  // 命中后原因子 f_oldfloor 关闭；打开 50% / 封死 50%
  {
    id: 'f_oldfloor::future',
    special: 'future',
    data: { ownerFactorId: 'f_oldfloor' },
    members: [
      { factorId: 'f_door_open',   chance: 0.5 },
      { factorId: 'f_door_sealed', chance: 0.5 },
    ],
  },
]

// ---------- 时间轴 ----------
// 学年结构：9月开学 → 次年8月学年结束（约 12 个月）。
// 假期：寒假 ≈ 1、2 月；暑假 ≈ 7、8 月（按月为整体标签）。
// 最后一格：三年 9 月 = 大学录取 / 结局月。

function buildTimeline(): MonthDef[] {
  const targetMonths: { year: number; month: number }[] = []
  const years = [1, 2, 3]
  const order = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8]

  for (const y of years) {
    for (const m of order) {
      targetMonths.push({ year: y, month: m })
    }
  }
  targetMonths.push({ year: 3, month: 9 }) // 录取月，作为收尾

  return targetMonths.map(({ year, month }, i) => {
    const index = i + 1
    const isHoliday = month === 7 || month === 8 || month === 1 || month === 2
    const type: MonthDef['type'] = isHoliday ? 'holiday' : 'school'

    const def: MonthDef = {
      index,
      year,
      month,
      type,
      stepCount: isHoliday ? 3 : 2,
      silentStudy: type === 'school',
    }

    if (year === 1 && month === 9) def.fixedEvent = 'e_open'
    if (year === 1 && month === 11) def.fixedEvent = 'e_midterm'
    if (year === 3 && month === 9) def.fixedEvent = 'e_admission'
    if (year !== 1 && month === 9) def.fixedEvent = 'e_open'

    if (!def.fixedEvent) {
      if (type === 'school') def.randomPool = ['e_club', 'e_night', 'e_study', 'e_sports', 'e_midterm']
      else def.randomPool = ['e_night', 'e_holiday_family', 'e_sports']
    }
    return def
  })
}

export const SCRIPT_1: Script = {
  id: 'campus-3y-01',
  meta: { title: '轮回校园', era: '当代', place: '青川中学' },

  roles: [
    { id: 'r1', name: '林知夏', surfaceTask: '顺利毕业，进入学生会。', privateGoalId: 'g_truth', identityTags: ['vampire'] },
    { id: 'r2', name: '陈默', surfaceTask: '拿下年级第一。', privateGoalId: 'g_friend', identityTags: ['human'] },
    { id: 'r3', name: '苏晚', surfaceTask: '组建社团并存活到毕业。', privateGoalId: 'g_secret', identityTags: ['human'] },
    { id: 'r4', name: '顾言', surfaceTask: '成为全校最受欢迎的人。', privateGoalId: 'g_truth', identityTags: ['human'] },
    { id: 'r5', name: '白露', surfaceTask: '平安读完三年。', privateGoalId: 'g_friend', identityTags: ['spirit'] },
    { id: 'r6', name: '周野', surfaceTask: '在运动会上夺冠。', privateGoalId: 'g_secret', identityTags: ['human'] },
  ],

  npcs: [
    { id: 'npc_lin',   name: '林老师',   type: 'resident', personality: '严肃公正', affinityStart: 10, persistAcrossRuns: true, place: '教学楼', relation: '尊' },
    { id: 'npc_qiu',   name: '邱同学',   type: 'resident', personality: '热心八卦', affinityStart: 20, persistAcrossRuns: true, place: '教室',   relation: '友' },
    { id: 'npc_moon',  name: '月亮学姐', type: 'resident', personality: '神神秘秘', affinityStart: 0,  persistAcrossRuns: true, place: '旧楼',   relation: '谜' },
    { id: 'npc_yao',   name: '姚主任',   type: 'resident', personality: '刻板严厉', affinityStart: 0,  persistAcrossRuns: true, place: '办公室', relation: '敌' },
    { id: 'npc_shen',  name: '沈星河',   type: 'resident', personality: '冷淡学霸', affinityStart: 5,  persistAcrossRuns: true, place: '图书馆', relation: '友' },
    { id: 'npc_jiang', name: '江晴',     type: 'resident', personality: '开朗体委', affinityStart: 10, persistAcrossRuns: true, place: '操场',   relation: '友' },
    { id: 'npc_he',    name: '何老师',   type: 'resident', personality: '温和心理', affinityStart: 15, persistAcrossRuns: true, place: '办公室', relation: '尊' },
    { id: 'npc_gu',    name: '顾伯',     type: 'resident', personality: '沉默校工', affinityStart: 5,  persistAcrossRuns: true, place: '旧楼',   relation: '谜' },
    { id: 'npc_rand1', name: '转学生',   type: 'random',   personality: '随机',     affinityStart: 5,  persistAcrossRuns: false, place: '教室',  relation: '友' },
    { id: 'npc_rand2', name: '社团新人', type: 'random',   personality: '随机',     affinityStart: 5,  persistAcrossRuns: false, place: '社团',  relation: '友' },
    { id: 'npc_rand3', name: '神秘访客', type: 'random',   personality: '随机',     affinityStart: 0,  persistAcrossRuns: false, place: '旧楼',  relation: '谜' },
  ],

  goals: [
    { id: 'g_truth', title: '揭开轮回真相', target: 5 },
    { id: 'g_friend', title: '赢得一个真心朋友', target: 5 },
    { id: 'g_secret', title: '守护一个秘密到毕业', target: 5 },
  ],

  affinityCap: 100,

  timeline: buildTimeline(),

  events: [
    {
      id: 'e_open',
      kind: 'fixed',
      season: 'school',
      title: '开学第一天',
      narrative: '你站在青川中学的校门口，秋风吹过。这里你似乎来过很多次，又似乎第一次来。',
      choices: [
        { id: 'c1', text: '去教室报到', effects: [{ type: 'affinity', target: 'npc_qiu', value: 5 }, { type: 'log', text: '你遇见了热情的同桌邱同学。' }] },
        { id: 'c2', text: '先在校园里逛逛', effects: [{ type: 'goalProgress', target: 'g_truth', value: 1 }, { type: 'log', text: '旧教学楼的方向有奇怪的感觉。' }] },
      ],
    },
    {
      id: 'e_midterm',
      kind: 'fixed',
      season: 'school',
      title: '期中考试',
      narrative: '期中成绩贴出来，走廊里人头攒动。你看到一个不该出现的人影一闪而过。',
      choices: [
        { id: 'c1', text: '留下来查成绩', effects: [{ type: 'affinity', target: 'npc_lin', value: 5 }, { type: 'affinity', target: 'npc_shen', value: 5 }] },
        { id: 'c2', text: '追那个身影', effects: [{ type: 'goalProgress', target: 'g_truth', value: 1 }, { type: 'flag', target: 'saw_shadow' }] },
        { id: 'c3', text: '先去安慰考砸的朋友', effects: [{ type: 'affinity', target: 'npc_qiu', value: 10 }, { type: 'goalProgress', target: 'g_friend', value: 1 }] },
      ],
    },
    {
      id: 'e_year_end',
      kind: 'fixed',
      season: 'school',
      title: '学年闭幕',
      narrative: '一年结束。旧教学楼尽头那扇门又出现了，只有你能看见。',
      choices: [
        { id: 'c1', text: '推开门', effects: [{ type: 'goalProgress', target: 'g_truth', value: 2 }, { type: 'flag', target: 'opened_door' }] },
        { id: 'c2', text: '转身离开', effects: [{ type: 'affinity', target: 'npc_moon', value: 10 }, { type: 'goalProgress', target: 'g_secret', value: 1 }] },
      ],
    },
    {
      id: 'e_club',
      kind: 'random',
      season: 'school',
      title: '社团招新',
      narrative: '社团摊位排了一长排，有几双眼睛一直跟着你。',
      choices: [
        { id: 'c1', text: '加入文学社', effects: [{ type: 'affinity', target: 'npc_qiu', value: 5 }, { type: 'goalProgress', target: 'g_friend', value: 1 }] },
        { id: 'c2', text: '加入灵异研究社', effects: [{ type: 'affinity', target: 'npc_moon', value: 5 }, { type: 'goalProgress', target: 'g_truth', value: 1 }] },
        { id: 'c3', text: '自己组建社团', effects: [{ type: 'unlock', target: 'club_founder' }, { type: 'affinity', target: 'npc_rand2', value: 10 }, { type: 'log', text: '你成了新社团的创始人。' }] },
      ],
    },
    {
      id: 'e_night',
      kind: 'random',
      season: 'both',
      title: '夜探旧楼',
      fromConflict: 'c_old_door',
      narrative: '深夜的旧教学楼没有灯。楼梯尽头传来脚步。',
      choices: [
        { id: 'c1', text: '跟上去', effects: [{ type: 'flag', target: 'chased_night' }, { type: 'goalProgress', target: 'g_truth', value: 1 }, { type: 'affinity', target: 'npc_gu', value: 5 }] },
        { id: 'c2', text: '退回宿舍', effects: [{ type: 'affinity', target: 'npc_yao', value: 5 }] },
        { id: 'c3', text: '推开那扇门', require: { flag: 'opened_door' }, effects: [{ type: 'goalProgress', target: 'g_truth', value: 2 }, { type: 'affinity', target: 'npc_moon', value: 10 }, { type: 'log', text: '门后是你自己的背影。' }] },
      ],
    },
    {
      id: 'e_study',
      kind: 'random',
      season: 'school',
      title: '考试周',
      fromConflict: 'c_top_rank',
      narrative: '图书馆座无虚席，你只有两个选择。',
      choices: [
        { id: 'c1', text: '埋头复习', effects: [{ type: 'affinity', target: 'npc_lin', value: 8 }, { type: 'affinity', target: 'npc_shen', value: 8 }] },
        { id: 'c2', text: '帮同学补课', effects: [{ type: 'affinity', target: 'npc_qiu', value: 8 }, { type: 'goalProgress', target: 'g_friend', value: 1 }] },
      ],
    },
    {
      id: 'e_sports',
      kind: 'random',
      season: 'both',
      title: '操场训练',
      narrative: '江晴在操场招手，远处沈星河抱着书走过。',
      choices: [
        { id: 'c1', text: '陪江晴训练', effects: [{ type: 'affinity', target: 'npc_jiang', value: 10 }] },
        { id: 'c2', text: '去和沈星河讨论题目', effects: [{ type: 'affinity', target: 'npc_shen', value: 10 }, { type: 'goalProgress', target: 'g_friend', value: 1 }] },
      ],
    },
    {
      id: 'e_holiday_family',
      kind: 'random',
      season: 'holiday',
      title: '假期 · 家族宅邸',
      fromConflict: 'c_parents',
      narrative: '回到宅邸，父母分坐在长桌两端，都没有先开口。你身上的血脉感在假期里变得清晰。',
      choices: [
        { id: 'c1', text: '主动调解', effects: [{ type: 'goalProgress', target: 'g_friend', value: 1 }, { type: 'flag', target: 'tried_mediate' }, { type: 'log', text: '你试着把两边的话都听了一遍。' }] },
        { id: 'c2', text: '选择站在母亲一边', effects: [{ type: 'goalProgress', target: 'g_secret', value: 1 }, { type: 'affinity', target: 'npc_lin', value: -5 }] },
        { id: 'c3', text: '回房独自翻找旧物', effects: [{ type: 'goalProgress', target: 'g_truth', value: 1 }, { type: 'flag', target: 'found_old_letter' }], require: { hasIdentity: 'vampire' } },
      ],
    },
    {
      id: 'e_admission',
      kind: 'fixed',
      season: 'school',
      title: '大学录取',
      narrative: '三年走到这里。桌上的录取通知书摊开，窗外是和你第一次开学那天一样的秋风。',
      choices: [
        { id: 'c1', text: '按原计划去远方', effects: [{ type: 'flag', target: 'leave_far' }] },
        { id: 'c2', text: '留在青川', effects: [{ type: 'flag', target: 'stay_qingchuan' }] },
      ],
    },
  ],

  outcomes: [
    {
      id: 'o_truth',
      title: '【真相】读档人',
      narrative: '你想起了所有轮回。这一次，你不再是被读的剧本，而是读的人。',
      require: { all: [{ flag: 'opened_door' }, { goalProgressAtLeast: ['g_truth', 4] }] },
      minGoalRatio: 0.8,
    },
    {
      id: 'o_friend',
      title: '【羁绊】不再孤单',
      narrative: '三年里你有了一个愿意一起重来的人，轮回也不再那么可怕。',
      minGoalRatio: 0.8,
    },
    {
      id: 'o_normal',
      title: '【平淡】毕业',
      narrative: '你走完了三年，风平浪静，有些东西永远留在了旧楼里。',
      minGoalRatio: 0,
    },
  ],

  conflicts,
  conflictLinks,
  conflictEventLinks,
  conflictNpcEffects,
  factorPool,
  factorGroups,
}