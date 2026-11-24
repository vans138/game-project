// ============================================================
// 剧本：校园 · 1 年精简版（自包含版本，不依赖 types.ts）
// 目的：跑通"事件 → 选项 → 效果 → 时间轮 → 结局"最小闭环。
// 规模：10 个月 / 2 个私人目标 / 3 个 NPC / 固定+随机+同框+学习
//       / 2 个结局。
// 后续扩三年：把 months 补到 30，events 增加即可。
// ============================================================

// ---------- 类型（自包含，放在本文件顶部）----------

export interface Condition {
  hasIdentity?: string;
  affinityAtLeast?: [string, number];
  flag?: string;
  goalAtLeast?: [string, number];
}

export type Effect =
  | { type: 'affinity'; npc: string; value: number }
  | { type: 'unlock'; target: string }
  | { type: 'flag'; target: string }
  | { type: 'goalProgress'; goal: string; value: number };

export interface ChoiceDef {
  id: string;
  text: string;
  require?: Condition;
  effects?: Effect[];
}

export interface EventDef {
  id: string;
  kind: 'fixed' | 'random' | 'samebox' | 'study';
  background: string;
  text: string;
  choices: ChoiceDef[];
}

export interface MonthDef {
  index: number;
  fixedEventId?: string;
  randomPool?: string[];
  silentEventId?: string;
}

export interface GoalDef {
  id: string;
  title: string;
  target: number;
}

export interface OutcomeDef {
  id: string;
  title: string;
  text: string;
  require?: { totalGoalAtLeast?: number; flag?: string };
}

export interface ScriptDef {
  id: string;
  meta: { title: string; era: string; place: string };
  startBackground: string;
  months: MonthDef[];
  events: EventDef[];
  goals: GoalDef[];
  outcomes: OutcomeDef[];
}

// ---------- 剧本数据 ----------

export const campusScript: ScriptDef = {
  id: 'campus-year1',
  meta: { title: '校园·第一年', era: '现代', place: '临江一中' },
  startBackground: '/bg/classroom.jpg',

  goals: [
    { id: 'g_secret', title: '查清旧校舍传闻的真相', target: 3 },
    { id: 'g_bond',   title: '和至少一个人建立真正的关系', target: 3 },
  ],

  months: [
    { index: 1, fixedEventId: 'e_meet', silentEventId: 'e_study' },
    { index: 2, randomPool: ['e_rumor_a', 'e_rumor_b'], silentEventId: 'e_study' },
    { index: 3, fixedEventId: 'e_samebox_1', silentEventId: 'e_study' },
    { index: 4, randomPool: ['e_rumor_a', 'e_rumor_b'], silentEventId: 'e_study' },
    { index: 5, fixedEventId: 'e_midterm', silentEventId: 'e_study' },
    { index: 6, randomPool: ['e_rumor_a', 'e_rumor_b'], silentEventId: 'e_study' },
    { index: 7, fixedEventId: 'e_samebox_2', silentEventId: 'e_study' },
    { index: 8, randomPool: ['e_rumor_a', 'e_rumor_b'], silentEventId: 'e_study' },
    { index: 9, fixedEventId: 'e_finale', silentEventId: 'e_study' },
    { index: 10, fixedEventId: 'e_grad', silentEventId: 'e_study' },
  ],

  events: [
    {
      id: 'e_study',
      kind: 'study',
      background: '/bg/classroom.jpg',
      text: '这个月没什么特别的事。\n你照常上课、自习，日子像静止的水。',
      choices: [
        { id: 'study_ok', text: '继续', effects: [] },
      ],
    },

    {
      id: 'e_meet',
      kind: 'fixed',
      background: '/bg/classroom.jpg',
      text: '九月的第一天，新班级。\n同桌「林夏」把一本旧笔记推到你面前：“这本……是上个班留下的。”',
      choices: [
        {
          id: 'meet_take',
          text: '接过笔记，翻看',
          effects: [
            { type: 'affinity', npc: 'linxia', value: 1 },
            { type: 'flag', target: 'got_old_notes' },
            { type: 'goalProgress', goal: 'g_secret', value: 1 },
          ],
        },
        {
          id: 'meet_decline',
          text: '婉拒，说改天再看',
          effects: [{ type: 'affinity', npc: 'linxia', value: -1 }],
        },
      ],
    },

    {
      id: 'e_rumor_a',
      kind: 'random',
      background: '/bg/hallway.jpg',
      text: '走廊上有人低声议论：旧校舍半夜有灯亮。\n「苏野」靠在窗边，似笑非笑地看着你。',
      choices: [
        {
          id: 'rumor_a_probe',
          text: '追问细节',
          require: { flag: 'got_old_notes' },
          effects: [
            { type: 'affinity', npc: 'suye', value: 1 },
            { type: 'goalProgress', goal: 'g_secret', value: 1 },
          ],
        },
        {
          id: 'rumor_a_ignore',
          text: '不理会，走开',
          effects: [],
        },
      ],
    },

    {
      id: 'e_rumor_b',
      kind: 'random',
      background: '/bg/library.jpg',
      text: '图书馆里，你无意中在旧报纸上看到一段被划掉的名字。',
      choices: [
        {
          id: 'rumor_b_trace',
          text: '记下这个名字',
          effects: [
            { type: 'goalProgress', goal: 'g_secret', value: 1 },
            { type: 'unlock', target: 'know_old_name' },
          ],
        },
        {
          id: 'rumor_b_skip',
          text: '合上报纸',
          effects: [],
        },
      ],
    },

    {
      id: 'e_samebox_1',
      kind: 'samebox',
      background: '/bg/rooftop.jpg',
      text: '天台上，你和林夏、苏野撞了个正着。\n空气有点僵。林夏看你一眼，苏野则在笑。',
      choices: [
        {
          id: 'sb1_ask_linxia',
          text: '问林夏：你也在意那件事？',
          effects: [
            { type: 'affinity', npc: 'linxia', value: 1 },
            { type: 'goalProgress', goal: 'g_bond', value: 1 },
          ],
        },
        {
          id: 'sb1_ask_suye',
          text: '问苏野：你到底知道多少？',
          effects: [
            { type: 'affinity', npc: 'suye', value: 1 },
            { type: 'goalProgress', goal: 'g_bond', value: 1 },
          ],
        },
        {
          id: 'sb1_leave',
          text: '什么都不说，先走',
          effects: [{ type: 'affinity', npc: 'linxia', value: -1 }],
        },
      ],
    },

    {
      id: 'e_midterm',
      kind: 'fixed',
      background: '/bg/classroom.jpg',
      text: '期中考后，班主任把一张旧照片夹在你的卷子里，什么都没解释。',
      choices: [
        {
          id: 'mid_keep',
          text: '收好照片',
          effects: [
            { type: 'flag', target: 'got_photo' },
            { type: 'goalProgress', goal: 'g_secret', value: 1 },
          ],
        },
        {
          id: 'mid_ask',
          text: '当场去问班主任',
          require: { affinityAtLeast: ['linxia', 1] },
          effects: [{ type: 'affinity', npc: 'linxia', value: 1 }],
        },
      ],
    },

    {
      id: 'e_samebox_2',
      kind: 'samebox',
      background: '/bg/oldbuilding.jpg',
      text: '旧校舍前，你和苏野同时停下脚步。\n他说：“你也在查？”',
      choices: [
        {
          id: 'sb2_trust',
          text: '如实说出你查到的东西',
          require: { flag: 'got_photo' },
          effects: [
            { type: 'affinity', npc: 'suye', value: 2 },
            { type: 'goalProgress', goal: 'g_secret', value: 1 },
            { type: 'goalProgress', goal: 'g_bond', value: 1 },
          ],
        },
        {
          id: 'sb2_hide',
          text: '含糊带过',
          effects: [{ type: 'affinity', npc: 'suye', value: -1 }],
        },
      ],
    },

    {
      id: 'e_finale',
      kind: 'fixed',
      background: '/bg/oldbuilding.jpg',
      text: '夜里，旧校舍的灯又亮了。\n林夏发来消息：“你一个人别去。”',
      choices: [
        {
          id: 'fin_go_alone',
          text: '一个人去',
          effects: [{ type: 'goalProgress', goal: 'g_secret', value: 1 }],
        },
        {
          id: 'fin_go_together',
          text: '约上林夏一起',
          require: { affinityAtLeast: ['linxia', 1] },
          effects: [
            { type: 'affinity', npc: 'linxia', value: 1 },
            { type: 'goalProgress', goal: 'g_bond', value: 1 },
          ],
        },
      ],
    },

    {
      id: 'e_grad',
      kind: 'fixed',
      background: '/bg/campus.jpg',
      text: '期末最后一天。\n这一年发生的事，像一场没讲完的梦。',
      choices: [
        { id: 'grad_end', text: '结束这一年', effects: [] },
      ],
    },
  ],

  outcomes: [
    {
      id: 'o_truth',
      title: '接近真相的人',
      text: '你拼出了一部分真相。故事还没完，但你已经不再是那个刚转来的陌生人了。',
      require: { totalGoalAtLeast: 5 },
    },
    {
      id: 'o_ordinary',
      title: '安静的旁观者',
      text: '这一年平平淡淡地过去了。你留下了，也有人离开，而你始终站在边上看。',
    },
  ],
};