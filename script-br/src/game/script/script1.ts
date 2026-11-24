// 第一份剧本：单玩家，11 个 NPC（8 常驻 + 3 随机），3 年 x 10 月 = 30 回合。
// 矛盾引擎骨架：私人目标结构性互斥（争同一 NPC 好感 / 争同一稀缺真相）。

import type { Script } from './types'

export const SCRIPT_1: Script = {
  id: 'campus-3y-01',
  meta: { title: '轮回校园', era: '当代', place: '青川中学' },

  // 玩家可选身份（玄幻身份决定流派与部分选项可见）
  roles: [
    { id: 'r1', name: '林知夏', surfaceTask: '顺利毕业，进入学生会。', privateGoalId: 'g_truth', identityTags: ['vampire'] },
    { id: 'r2', name: '陈默', surfaceTask: '拿下年级第一。', privateGoalId: 'g_friend', identityTags: ['human'] },
    { id: 'r3', name: '苏晚', surfaceTask: '组建社团并存活到毕业。', privateGoalId: 'g_secret', identityTags: ['human'] },
    { id: 'r4', name: '顾言', surfaceTask: '成为全校最受欢迎的人。', privateGoalId: 'g_truth', identityTags: ['human'] },
    { id: 'r5', name: '白露', surfaceTask: '平安读完三年。', privateGoalId: 'g_friend', identityTags: ['spirit'] },
    { id: 'r6', name: '周野', surfaceTask: '在运动会上夺冠。', privateGoalId: 'g_secret', identityTags: ['human'] },
  ],

  // 11 个 NPC：8 常驻 + 3 随机
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

  // 好感总封顶
  affinityCap: 100,

  timeline: buildTimeline(),

  events: [
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
    {
      id: 'e_midterm',
      kind: 'fixed',
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
      title: '夜探旧楼',
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
      title: '考试周',
      narrative: '图书馆座无虚席，你只有两个选择。',
      choices: [
        { id: 'c1', text: '埋头复习', effects: [{ type: 'affinity', target: 'npc_lin', value: 8 }, { type: 'affinity', target: 'npc_shen', value: 8 }] },
        { id: 'c2', text: '帮同学补课', effects: [{ type: 'affinity', target: 'npc_qiu', value: 8 }, { type: 'goalProgress', target: 'g_friend', value: 1 }] },
      ],
    },
    {
      id: 'e_sports',
      kind: 'random',
      title: '操场训练',
      narrative: '江晴在操场招手，远处沈星河抱着书走过。',
      choices: [
        { id: 'c1', text: '陪江晴训练', effects: [{ type: 'affinity', target: 'npc_jiang', value: 10 }] },
        { id: 'c2', text: '去和沈星河讨论题目', effects: [{ type: 'affinity', target: 'npc_shen', value: 10 }, { type: 'goalProgress', target: 'g_friend', value: 1 }] },
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
}

function buildTimeline() {
  const t = []
  let globalIndex = 1
  for (let year = 1; year <= 3; year++) {
    for (let m = 1; m <= 10; m++) {
      const def: {
        index: number; year: number; month: number;
        fixedEvent?: string; randomPool?: string[]; silentStudy?: boolean
      } = { index: globalIndex, year, month: m, silentStudy: true }
      if (m === 1) def.fixedEvent = 'e_open'
      else if (m === 5) def.fixedEvent = 'e_midterm'
      else if (m === 10) def.fixedEvent = 'e_year_end'
      else def.randomPool = ['e_club', 'e_night', 'e_study', 'e_sports']
      t.push(def)
      globalIndex++
    }
  }
  return t
}