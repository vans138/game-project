// 第一份剧本（v6.1）：青川中学 · Y1 上学期 + 寒假（Y1-9 ~ Y2-2）
// 相对 v6 的变更：去掉 as never 临时 cast，require 走正式 Condition 类型。

import type {
  Script,
  MonthDef,
  FactorDef,
  FactorGroup,
  IdentityDef,
  EventDef,
  InteractEvent,
} from './types'

const identities: IdentityDef[] = [
  {
    id: 'longjin_yugu',
    name: '龙烬余孤',
    desc: '世间最后一条血脉驳杂的龙。你不知道自己是被封印的容器，还是被封印者本身。',
    identityFactorPool: ['seal', 'ancient'],
  },
]

const factorPool: FactorDef[] = []
const factorGroups: FactorGroup[] = []

function buildTimeline(): MonthDef[] {
  return [
    { index: 1, year: 1, month: 9,  type: 'school',  stepCount: 2, fixedEvent: 'e_term_open'  },
    { index: 2, year: 1, month: 10, type: 'school',  stepCount: 2, fixedEvent: 'e_oct_walk'   },
    { index: 3, year: 1, month: 11, type: 'school',  stepCount: 2, fixedEvent: 'e_mid_exam'   },
    { index: 4, year: 1, month: 12, type: 'school',  stepCount: 2, fixedEvent: 'e_dec_snow'   },
    { index: 5, year: 1, month: 1,  type: 'school',  stepCount: 2, fixedEvent: 'e_final_exam' },
    { index: 6, year: 1, month: 2,  type: 'holiday', stepCount: 1 },
  ]
}

const events: EventDef[] = [
  {
    id: 'e_term_open', kind: 'fixed', season: 'school', title: '开学典礼',
    narrative:
      '九月的操场，升旗、训话、人群。你站在队伍里，忽然有一瞬间说不清自己是谁。\n' +
      '阳光很亮，你听见体内（或背后）有什么东西轻轻动了一下。',
    choices: [
      { id: 'c_row', text: '跟着人群唱校歌', effects: [
        { type: 'affinity', target: 'npc_qiu', value: 5 },
        { type: 'affinity', target: 'npc_lin', value: 3 },
        { type: 'log', text: '邱同学回头冲你笑了一下；林老师在队尾点了点头。' },
      ] },
      { id: 'c_sky', text: '发呆看着天空', effects: [
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'log', text: '你在云层里看见一道极淡的、像鳞片一样的纹路。' },
      ] },
      { id: 'c_listen', text: '屏住呼吸，去听那个声音', require: { identityFactorIs: 'seal' }, effects: [
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'flag', target: 'heard_second_heart' },
        { type: 'log', text: '很轻，很闷，像在厚厚的冰层下敲了一下。' },
      ] },
      { id: 'c_hide', text: '下意识缩了一下肩，假装什么都没感觉到', require: { identityFactorIs: 'ancient' }, effects: [
        { type: 'flag', target: 'hid_presence' },
        { type: 'log', text: '你觉得阳光有点刺。人群里有人下意识地往远离你的方向退了半步。' },
      ] },
    ],
  },

  {
    id: 'e_oct_walk', kind: 'fixed', season: 'school', title: '十月 · 晚自习后的操场',
    narrative:
      '十月的一个晚上，操场边的灯只亮了一半。\n' +
      '你和邱同学一起走回宿舍，TA 忽然压低声音：“你有没有觉得，我们班那个转来的，有点怪。”',
    choices: [
      { id: 'c_agree', text: '顺着话题聊下去', effects: [
        { type: 'affinity', target: 'npc_qiu', value: 8 },
        { type: 'goalProgress', target: 'g_bond', value: 1 },
        { type: 'log', text: '你们聊到熄灯。邱同学对你的信任多了一点。' },
      ] },
      { id: 'c_ignore', text: '“别乱说。”', effects: [
        { type: 'affinity', target: 'npc_qiu', value: -3 },
        { type: 'log', text: '邱同学“哦”了一声，走开时加快了步子。' },
      ] },
      { id: 'c_truth', text: '“我最近……也在想一些奇怪的事。”', require: { affinityAtLeast: ['npc_qiu', 20] }, effects: [
        { type: 'affinity', target: 'npc_qiu', value: 10 },
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'goalProgress', target: 'g_bond', value: 1 },
        { type: 'log', text: '你把那些自己也说不清的错觉讲了出来。TA 认真地听完。' },
      ] },
    ],
  },

  {
    id: 'e_mid_exam', kind: 'fixed', season: 'school', title: '期中考试',
    narrative:
      '考场安静得能听见翻卷声。\n' +
      '做到一半时，你忽然觉得，卷子上的字在轻轻抖动。',
    choices: [
      { id: 'c_focus', text: '低头继续答题', effects: [
        { type: 'affinity', target: 'npc_lin', value: 5 },
        { type: 'log', text: '你答得不错。林老师后来在走廊上多看了你一眼。' },
      ] },
      { id: 'c_look', text: '抬眼，看清周围', effects: [
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'log', text: '你认出了监考席斜后方，站着一个根本不在这间教室里的人。' },
      ] },
      { id: 'c_calm', text: '用手指按住太阳穴，把那个声音压下去', require: { identityFactorIs: 'seal' }, effects: [
        { type: 'flag', target: 'pushed_down_voice' },
        { type: 'log', text: '声音停了。你听见自己两个心跳，一起慢下来。' },
      ] },
      { id: 'c_leak', text: '不管它，让它出来', require: { identityFactorIs: 'ancient' }, effects: [
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'flag', target: 'let_slipped' },
        { type: 'log', text: '考场的灯闪了一下。前排两个同学同时回头看了看你。' },
      ] },
    ],
  },

  {
    id: 'e_dec_snow', kind: 'fixed', season: 'school', title: '十二月 · 初雪',
    narrative:
      '十二月的第一场雪落下来。晚自习后，教学楼的走廊空得能听见回声。\n' +
      '你看见落雪停在半空中，像是有人按了暂停。',
    choices: [
      { id: 'c_blink', text: '眨眨眼，也许只是看错了', effects: [
        { type: 'log', text: '雪继续落下。你站在风里多待了片刻。' },
      ] },
      { id: 'c_reach', text: '伸手去碰那片悬停的雪', effects: [
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'flag', target: 'touched_still_snow' },
        { type: 'log', text: '雪在你指尖化开，冰水沿着手腕往下淌。你听见一个很远的声音在叫你的名字。' },
      ] },
      { id: 'c_look_back', text: '回头', effects: [
        { type: 'affinity', target: 'npc_moon', value: 10 },
        { type: 'log', text: '月亮学姐站在走廊尽头，笑了一下，转身消失在拐角。' },
      ] },
    ],
  },

  {
    id: 'e_final_exam', kind: 'fixed', season: 'school', title: '期末考试',
    narrative:
      '一年最重的那场考试。窗外的树在风里响。\n' +
      '答到最后一题时，你忽然清晰地想起来了：去年这个时候，你也坐在这张桌子前。',
    choices: [
      { id: 'c_scribble', text: '把卷子答完', effects: [
        { type: 'affinity', target: 'npc_lin', value: 6 },
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'log', text: '你答得很稳。走出考场时，你比谁都清楚：这不是第一次。' },
      ] },
      { id: 'c_blank', text: '停下笔，看着窗外', effects: [
        { type: 'goalProgress', target: 'g_truth', value: 2 },
        { type: 'flag', target: 'remembered_exam' },
        { type: 'log', text: '你想起了上一次，同样的题，不同的答案。' },
      ] },
      { id: 'c_ask', text: '向监考老师举手，说了一个本不该被知道的名字', require: { goalProgressAtLeast: ['g_truth', 3] }, effects: [
        { type: 'goalProgress', target: 'g_truth', value: 2 },
        { type: 'affinity', target: 'npc_he', value: 8 },
        { type: 'log', text: '监考席后的何老师整个人僵住。她没有回答，只是在你交卷后，把你单独留了下来。' },
      ] },
    ],
  },
]

const interactEvents: InteractEvent[] = [
  {
    id: 'it_bench', kind: 'short', weight: 3,
    root: {
      text: '放学后，操场边的长椅空着。你正想坐，发现另一头也来了个人。',
      choices: [
        {
          text: '先坐下来',
          next: { text: 'TA 也坐下了。两个人各自看着远处，谁都没有开口。\n过了很久，TA 站起来走了。' },
        },
        {
          text: '让给对方，自己走开',
          next: { text: '你转身走开。风吹动长椅，发出很轻的一声。' },
        },
      ],
    },
  },
  {
    id: 'it_latenight', kind: 'maybeLong', weight: 4,
    root: {
      text: '某天你学得入了迷，很晚才走。教室里只剩你一个人，走廊的灯也已经关了大半。\n窗外黑着，只有对面楼还隐约亮着一格。',
      choices: [
        {
          text: '走过去，看一眼',
          next: {
            byMutual: { text: '你走到窗边。对面那格里的人影动了一下，也朝这边看过来。\n隔着两个楼的距离，你们都停住了。' },
            byOneSide: { text: '你走到窗边。对面那格里的人影没有动——也许只是忘了关灯。' },
          },
        },
        {
          text: '关灯，直接走',
          next: { text: '你拉下灯绳，教室陷进黑暗。走出教学楼时，天上的云遮住了月亮。' },
        },
      ],
    },
  },
  {
    id: 'it_rooftop', kind: 'short', weight: 2,
    root: {
      text: '你上了天台，发现有个人靠在栏杆边。TA 没拿烟，只是看着校门的方向。',
      choices: [
        {
          text: '走过去，一起看',
          next: { text: '你站到 TA 旁边。风很大。\n过了很久，TA 说：“你知道吗，去年这个时候，也有人在站这儿。”' },
        },
        {
          text: '不打扰，转身下楼',
          next: { text: '你退回去，轻轻带上门。' },
        },
      ],
    },
  },
  {
    id: 'it_oldfloor', kind: 'maybeLong', weight: 2,
    root: {
      text: '旧教学楼里，那扇门又出现了。\n这一次，它是真的、实在地立在你面前，门缝下透着一点光。',
      choices: [
        {
          text: '推门进去', requires: { identityFactor: 'ancient' },
          next: {
            byMutual: { text: '门开了。门后没有人——门后是你自己，背对着，慢慢转过头。' },
            byOneSide: { text: '门推到一半就停住了。光从缝里流出来，照在你脚背上。' },
          },
        },
        {
          text: '伸手，隔着门去摸', requires: { identityFactor: 'seal' },
          next: {
            byMutual: { text: '门后传来一声很轻的抓挠，像有什么被困在里面，认出了你。' },
            byOneSide: { text: '你的手掌贴上门，什么都没有发生。凉意顺着掌心往上爬。' },
          },
        },
        {
          text: '转身离开',
          next: { text: '你转身，走下楼梯。门在你身后慢慢淡了下去。' },
        },
      ],
    },
  },
]

export const SCRIPT_1: Script = {
  id: 'campus-y1-upper',
  meta: { title: '轮回校园', era: '当代', place: '青川中学' },
  identities,
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
    { id: 'g_truth', title: '揭开轮回真相',     target: 8 },
    { id: 'g_bond',  title: '与一个人建立真关系', target: 5 },
  ],
  affinityCap: 100,
  timeline: buildTimeline(),
  events,
  interactEvents,
  outcomes: [
    { id: 'o_default', title: '【暂时】学期未完', narrative: '这一段结束了。', minGoalRatio: 0 },
  ],
  factorPool,
  factorGroups,
}