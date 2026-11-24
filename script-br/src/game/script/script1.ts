// 第一份最小校园剧本：6 角色可选，3 年 x 10 月 = 30 回合。
// 内容遵循"密度守恒 + 固定做脊随机做肉 + 学年清算"：每学年有固定锚点事件，月份间穿插随机活动。
// 所有结构对齐 types.ts，将来原样导出 JSON 即可。

import type { Script } from './types'

export const SCRIPT_1: Script = {
  id: 'campus-3y-01',
  meta: { title: '轮回校园', era: '当代', place: '青川中学' },

  // 6 个可选角色，身份标签含一种"玄幻身份"，私人目标结构性互斥（争同一稀缺物/同一 NPC 好感）
  roles: [
    { id: 'r1', name: '林知夏', surfaceTask: '顺利毕业，进入学生会。', privateGoalId: 'g_truth', identityTags: ['vampire'], },
    { id: 'r2', name: '陈默', surfaceTask: '拿下年级第一。', privateGoalId: 'g_friend', identityTags: ['human'], },
    { id: 'r3', name: '苏晚', surfaceTask: '组建社团并存活到毕业。', privateGoalId: 'g_secret', identityTags: ['human'], },
    { id: 'r4', name: '顾言', surfaceTask: '成为全校最受欢迎的人。', privateGoalId: 'g_truth', identityTags: ['human'], },
    { id: 'r5', name: '白露', surfaceTask: '平安读完三年。', privateGoalId: 'g_friend', identityTags: ['spirit'], },
    { id: 'r6', name: '周野', surfaceTask: '在运动会上夺冠。', privateGoalId: 'g_secret', identityTags: ['human'], },
  ],

  // NPC：4 常驻（可积累好感）+ 2 随机（每局不同）
  npcs: [
    { id: 'npc_lin', name: '林老师', type: 'resident', personality: '严肃公正', affinityStart: 10, persistAcrossRuns: true },
    { id: 'npc_moon', name: '月亮学姐', type: 'resident', personality: '神神秘秘', affinityStart: 0, persistAcrossRuns: true },
    { id: 'npc_qiu', name: '邱同学', type: 'resident', personality: '热心八卦', affinityStart: 20, persistAcrossRuns: true },
    { id: 'npc_yao', name: '姚主任', type: 'resident', personality: '刻板严厉', affinityStart: 0, persistAcrossRuns: true },
    { id: 'npc_rand1', name: '转学生', type: 'random', personality: '随机', affinityStart: 5, persistAcrossRuns: false },
    { id: 'npc_rand2', name: '校工', type: 'random', personality: '随机', affinityStart: 5, persistAcrossRuns: false },
  ],

  // 私人目标
  goals: [
    { id: 'g_truth', title: '揭开轮回真相', target: 5 },
    { id: 'g_friend', title: '赢得一个真心朋友', target: 5 },
    { id: 'g_secret', title: '守护一个秘密到毕业', target: 5 },
  ],

  // 30 个回合：每年 10 月，固定锚点在第 1/5/9 月，其余月份挂随机池
  timeline: buildTimeline(),

  // 事件
  events: [
    // ---- 固定锚点：开学 ----
    {
      id: 'e_open',
      kind: 'fixed',
      title: '开学第一天',
      narrative: '你站在青川中学的校门口，秋风吹过。这里你似乎来过很多次，又似乎第一次来。',
      choices: [
        { id: 'c1', text: '去教室报到', effects: [{ type: 'affinity', target: 'npc_qiu', value: 5 }, { type: 'log', text: '你遇见了热情的同桌邱同学。' }] },
        { id: 'c2', text: '先在校园里逛逛', effects: [{ type: 'goalProgress', target: 'g_truth', value: 1 }, { type: 'log', text: '旧教学楼的方向有奇怪的感觉。' }] },
      ],
    },
    // ---- 固定锚点：期中 ----
    {
      id: 'e_midterm',
      kind: 'fixed',
      title: '期中考试',
      narrative: '期中成绩贴出来，走廊里人头攒动。你看到一个不该出现的人影一闪而过。',
      choices: [
        { id: 'c1', text: '留下来查成绩', effects: [{ type: 'affinity', target: 'npc_lin', value: 5 }] },
        { id: 'c2', text: '追那个身影', effects: [{ type: 'goalProgress', target: 'g_truth', value: 1 }, { type: 'flag', target: 'saw_shadow' }] },
        { id: 'c3', text: '先去安慰考砸的朋友', effects: [{ type: 'affinity', target: 'npc_qiu', value: 10 }, { type: 'goalProgress', target: 'g_friend', value: 1 }] },
      ],
    },
    // ---- 固定锚点：学年末 ----
    {
      id: 'e_year_end',
      kind: 'fixed',
      title: '学年闭幕',
      narrative: '一年结束。旧教学楼尽头那扇门又出现了，只有你能看见。',
      choices: [
        { id: 'c1', text: '推开门', effects: [{ type: 'goalProgress', target: 'g_truth', value: 2 }, { type: 'flag', target: 'opened_door' }] },
        { id: 'c2', text: '转身离开', effects: [{ type: 'affinity', target: 'npc_moon', value: 10 }, { type: 'goalProgress', target: 'g_secret', value: 1 }] },
      ],
    },
    // ---- 随机活动：社团 ----
    {
      id: 'e_club',
      kind: 'random',
      title: '社团招新',
      narrative: '社团摊位排了一长排，有几双眼睛一直跟着你。',
      choices: [
        { id: 'c1', text: '加入文学社', effects: [{ type: 'affinity', target: 'npc_qiu', value: 5 }, { type: 'goalProgress', target: 'g_friend', value: 1 }] },
        { id: 'c2', text: '加入灵异研究社', effects: [{ type: 'goalProgress', target: 'g_truth', value: 1 }] },
        { id: 'c3', text: '自己组建社团', effects: [{ type: 'unlock', target: 'club_founder' }, { type: 'log', text: '你成了新社团的创始人。' }] },
      ],
    },
    // ---- 随机活动：夜晚旧教学楼 ----
    {
      id: 'e_night',
      kind: 'random',
      title: '夜探旧楼',
      narrative: '深夜的旧教学楼没有灯。楼梯尽头传来脚步。',
      choices: [
        { id: 'c1', text: '跟上去', effects: [{ type: 'flag', target: 'chased_night' }, { type: 'goalProgress', target: 'g_truth', value: 1 }] },
        { id: 'c2', text: '退回宿舍', effects: [{ type: 'affinity', target: 'npc_yao', value: 5 }] },
        // 需要特定 flag 才出现的后段选项
        { id: 'c3', text: '推开那扇门', require: { flag: 'opened_door' }, effects: [{ type: 'goalProgress', target: 'g_truth', value: 2 }, { type: 'log', text: '门后是你自己的背影。' }] },
      ],
    },
    // ---- 随机活动：考试周 ----
    {
      id: 'e_study',
      kind: 'random',
      title: '考试周',
      narrative: '图书馆座无虚席，你只有两个选择。',
      choices: [
        { id: 'c1', text: '埋头复习', effects: [{ type: 'affinity', target: 'npc_lin', value: 8 }] },
        { id: 'c2', text: '帮同学补课', effects: [{ type: 'affinity', target: 'npc_qiu', value: 8 }, { type: 'goalProgress', target: 'g_friend', value: 1 }] },
      ],
    },
  ],

  // 结局：有序，从具体到兜底
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
}

/** 生成 3 学年 x 10 月的时间表 */
function buildTimeline() {
  const t = []
  let globalIndex = 1
  for (let year = 1; year <= 3; year++) {
    for (let m = 1; m <= 10; m++) {
      const def: {
        index: number; year: number; month: number;
        fixedEvent?: string; randomPool?: string[]; silentStudy?: boolean
      } = { index: globalIndex, year, month: m, silentStudy: true }

      // 每学年内：第 1 月开学、第 5 月期中、第 10 月学年末 作为固定锚点
      if (m === 1) def.fixedEvent = 'e_open'
      else if (m === 5) def.fixedEvent = 'e_midterm'
      else if (m === 10) def.fixedEvent = 'e_year_end'
      else def.randomPool = ['e_club', 'e_night', 'e_study']

      t.push(def)
      globalIndex++
    }
  }
  return t
}