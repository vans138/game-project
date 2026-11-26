// 第一份剧本（v8）：青川中学 · Y1 上学期 + 寒假
// 相对 v7 变更：
//   1) 事件加 tier + valence 双维度
//   2) 线索「失控？」改名「龙？」
//   3) 湖面事件：无论选什么，结束都给线索「龙？」+ 战力 +10 + 后天因子「唤龙」
//   4) 新增后天因子定义：唤龙
//   5) 触发湖面事件后，战力 +10 用 outcomes 保证 100%

import type {
  Script,
  MonthDef,
  FactorDef,
  FactorGroup,
  IdentityDef,
  EventDef,
  InteractEvent,
  ClueDef,
  AcquiredFactorDef,
} from './types'

const identities: IdentityDef[] = [
  {
    id: 'longjin_yugu',
    name: '龙烬余孤',
    desc: '世间最后一条血脉驳杂的龙。你不知道自己是被封印的容器，还是被封印者本身。',
    identityFactorPool: ['seal', 'ancient'],
    basePower: 60,
    // 龙和其他目标最多 80：没人能和一条龙真正亲近到 100
    npcAffinityCap: 80,
  },
]

const factorPool: FactorDef[] = []
const factorGroups: FactorGroup[] = []

const acquiredFactors: AcquiredFactorDef[] = [
  {
    id: 'acq_call_dragon',
    name: '唤龙',
    desc: '你身体里多了一道不属于你的呼唤。危急之时，你可以试着去应答它。',
    grantsCriticalOption: '唤龙',
  },
]

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
    tier: 'common', valence: { neutral: 1 },
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

      // ---- 负好感路径 ①：开学就给人脸色（古龙线的"疏远"从第一天开始）----
      { id: 'c_push_away', text: '把过来搭话的人冷冷推开', effects: [
        { type: 'affinity', target: 'npc_qiu', value: -25 },
        { type: 'flag', target: 'pushed_qiu_away' },
        { type: 'log', text: '邱同学的笑僵在脸上。TA 退后半步，把手插回校服口袋里，没再说话。' },
      ] },
      { id: 'c_swallow', text: '把那点烦躁咽回去', require: { identityFactorIs: 'seal' }, effects: [
        { type: 'affinity', target: 'npc_qiu', value: -10 },
        { type: 'flag', target: 'swallowed_irritation' },
        { type: 'log', text: '你把指甲掐进掌心。声音停了。邱同学看了你一眼，什么也没问。' },
      ] },
      { id: 'c_show_eyes', text: '让 TA 看见你眼睛里的东西', require: { identityFactorIs: 'ancient' }, effects: [
        { type: 'affinity', target: 'npc_qiu', value: -40 },
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'flag', target: 'leaked_eyes_once' },
        { type: 'log', text: '只有一瞬间。邱同学整个人僵住，手里的校歌单掉在地上。\nTA 后退时撞到了后面的人。' },
      ] },
    ],
  },

  {
    id: 'e_oct_walk', kind: 'fixed', season: 'school', title: '十月 · 晚自习后的操场',
    tier: 'common', valence: { favorable: 0.7, unfavorable: 0.3 },
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

      // ---- 负好感路径 ②：把话说到最绝 ----
      { id: 'c_cut', text: '“以后别再跟着我。”', effects: [
        { type: 'affinity', target: 'npc_qiu', value: -30 },
        { type: 'flag', target: 'cut_qiu_off' },
        { type: 'log', text: '你说完就走了。邱同学在后面叫了你的名字，你没有回头。' },
      ] },
      { id: 'c_silent_cut', text: '沉默着走完这段路', require: { identityFactorIs: 'seal' }, effects: [
        { type: 'affinity', target: 'npc_qiu', value: -20 },
        { type: 'flag', target: 'silent_walk' },
        { type: 'log', text: '你们一路没再说话。到宿舍楼下，TA 说了句“早点睡”，先上了楼。' },
      ] },
      { id: 'c_show_eyes_again', text: '不再遮，让 TA 看清楚', require: { identityFactorIs: 'ancient' }, effects: [
        { type: 'affinity', target: 'npc_qiu', value: -50 },
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'flag', target: 'eyes_seen_fully' },
        { type: 'log', text: '路灯下，你的影子比人多出一截。\n邱同学一句话都没说出来，转身跑了。' },
      ] },
    ],
  },

  {
    id: 'e_mid_exam', kind: 'fixed', season: 'school', title: '期中考试',
    tier: 'common', valence: { favorable: 1 },
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
    tier: 'rare', valence: { favorable: 0.5, unfavorable: 0.5 },
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

      // ---- 负好感路径 ③：封龙压久了会一次性炸开；古龙则学会回应那个声音 ----
      { id: 'c_vent', text: '把攒了一路的火，全砸在身边的人身上', require: { identityFactorIs: 'seal' }, effects: [
        { type: 'affinity', target: 'npc_qiu', value: -45 },
        { type: 'flag', target: 'vented_on_qiu' },
        { type: 'log', text: '你听见自己在说很重的话。雪落在 TA 的肩上，TA 没有还嘴。' },
      ] },
      { id: 'c_answer_snow', text: '对着空走廊，应一声那个叫你的声音', require: { identityFactorIs: 'ancient' }, effects: [
        { type: 'powerDelta', value: 5 },
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'flag', target: 'answered_snow_voice' },
        { type: 'log', text: '你应了一声。雪在半空停住，走廊尽头的灯同时暗了一下。' },
      ] },
    ],
  },

  {
    id: 'e_final_exam', kind: 'fixed', season: 'school', title: '期末考试',
    // critical：古龙线的第一个"危急事件"——拥有后天因子「唤龙」时，这里会多出【唤龙】选项
    tier: 'critical', valence: { favorable: 0.8, unfavorable: 0.2 },
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

      // ---- 期末的身份分叉：封龙按住两个心跳，古龙让它替自己写 ----
      { id: 'c_both_hearts', text: '按住两个心跳，一题一题写下去', require: { identityFactorIs: 'seal' }, effects: [
        { type: 'goalProgress', target: 'g_truth', value: 1 },
        { type: 'flag', target: 'held_both_hearts' },
        { type: 'log', text: '你数着两个心跳，把每道题都写了。交卷时，手心全是汗。' },
      ] },
      { id: 'c_shed_skin', text: '让那一刻的自己出来，把卷子写完', require: { identityFactorIs: 'ancient' }, effects: [
        { type: 'powerDelta', value: 5 },
        { type: 'goalProgress', target: 'g_truth', value: 2 },
        { type: 'flag', target: 'shed_skin_exam' },
        { type: 'log', text: '笔尖划过纸面，快得不像你在写。监考老师一直没敢往这边看。' },
      ] },
    ],
  },
]

const clues: ClueDef[] = [
  {
    id: 'clue_dragon',
    title: '龙？',
    fromEventId: 'it_lake_dragon',
    stages: [
      {
        title: '第一印象',
        text: '湖面下的那条东西冲向你的前一秒，你什么都不记得了。\n你只记得醒来时，掌心有一道还没愈合的痕。',
      },
      {
        title: '推敲',
        text: '你回想那一刻——不是它冲向了你，而是你身上有什么东西，先一步被它勾了起来。\n你开始怀疑：那一刻失控的，也许不是它。',
      },
      {
        title: '确认',
        text: '你在旧楼镜子里试着重复那次的感觉。镜中的你，瞳孔变成了竖的，维持了很短的一瞬。\n你知道：你体内确实有东西能被勾出来。问题只是——它是你，还是不是你。',
      },
    ],
  },

  // 第二条线索：来自旧楼那扇门（古龙线：锁链 / 被锁住的到底是谁）
  {
    id: 'clue_chain',
    title: '锁链',
    fromEventId: 'it_oldfloor',
    stages: [
      {
        title: '痕迹',
        text: '你想起湖底那条东西身上，一圈一圈锈色的东西。\n它们不像伤，更像束缚。',
      },
      {
        title: '推想',
        text: '如果它是被锁住的，那把锁是谁上的？\n——又或者，被锁在里面的，从来不是它。',
      },
    ],
  },
]

// 通用"必遇湖面事件触发后"的结算——用 outcomes 保证 100%
const lakeDragonRewards = [
  { type: 'gainClue' as const, clueId: 'clue_dragon' },
  { type: 'powerDelta' as const, value: 10 },
  { type: 'acquireFactor' as const, factorId: 'acq_call_dragon' },
  { type: 'log' as const, text: '掌心那道痕还没愈合，你就知道：有什么东西在你体内醒了。' },
]

const interactEvents: InteractEvent[] = [
  {
    // 湖面事件：必遇、一次性、高优先级。
    // 无论选哪个分支，都结算：得线索「龙？」+ 战力 +10 + 后天因子「唤龙」。
    // 具体结算放在"事件结束点"——这里我们挂到每个分支的最后一步，
    // 通过叶子节点 gainClue 或通过 RunEngine 在 finishInteract 时统一补结算。
    id: 'it_lake_dragon', kind: 'maybeLong', weight: 10,
    onceGuaranteed: true, priority: 100,
    tier: 'rare', valence: { favorable: 0.6, unfavorable: 0.4 },
    root: {
      text:
        '某个放学后的傍晚，你没有直接回家。\n' +
        '穿过教学楼后的小路时，你发现自己站在一片从没见过的湖面前——水面静得像镜子，看得见自己的影子。\n' +
        '湖面中央，倒影的下方，隐约有一条龙形的东西在游动。它抬起了头，和湖面上的你对视。',
      choices: [
        {
          text: '开口问它：你是什么？',
          next: {
            byMutual: {
              text:
                '古龙没有回答。它只是静静看着你，鳞片是淬过火的暗金色，没有锁链——从头到尾，一截都没有。\n' +
                '然后它突然朝你冲了上来。',
            },
            byOneSide: {
              text:
                '古龙没有回答。它缓缓游动，你才看清：它的龙身上缠满了一道又一道锈色的锁链。\n' +
                '它在锁链里挣扎了一下，然后突然朝你冲了上来。',
            },
          },
        },
        {
          text: '不发问，只是和它对视',
          next: {
            byMutual: {
              text:
                '你什么都没说。湖面下的古龙也没有。\n没有锁链的它，安静地游了一圈，然后慢慢沉入更深处，像什么都没发生。',
            },
            byOneSide: {
              text:
                '你什么都没说。湖面下的古龙也没有。\n被锁链捆住的它试着抬了一下头，没能抬起来，沉回去了。',
            },
          },
        },
        {
          text: '转身离开',
          next: { text: '你转过身。身后的湖面，安静得像从来没有过。' },
        },
      ],
    },
  },

  {
    id: 'it_bench', kind: 'short', weight: 3,
    tier: 'common', valence: { favorable: 0.5, unfavorable: 0.5 },
    root: {
      text: '放学后，操场边的长椅空着。你正想坐，发现另一头也来了个人。',
      choices: [
        { text: '先坐下来', next: { text: 'TA 也坐下了。两个人各自看着远处，谁都没有开口。\n过了很久，TA 站起来走了。' } },
        { text: '让给对方，自己走开', next: { text: '你转身走开。风吹动长椅，发出很轻的一声。' } },
      ],
    },
  },

  {
    id: 'it_latenight', kind: 'maybeLong', weight: 4,
    requires: { hasCrush: true },
    tier: 'rare', valence: { favorable: 0.5, unfavorable: 0.5 },
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
        { text: '关灯，直接走', next: { text: '你拉下灯绳，教室陷进黑暗。走出教学楼时，天上的云遮住了月亮。' } },
      ],
    },
  },

  {
    id: 'it_rooftop', kind: 'short', weight: 2,
    tier: 'common', valence: { favorable: 0.5, unfavorable: 0.5 },
    root: {
      text: '你上了天台，发现有个人靠在栏杆边。TA 没拿烟，只是看着校门的方向。',
      choices: [
        { text: '走过去，一起看', next: { text: '你站到 TA 旁边。风很大。\n过了很久，TA 说：“你知道吗，去年这个时候，也有人在站这儿。”' } },
        { text: '不打扰，转身下楼', next: { text: '你退回去，轻轻带上门。' } },
      ],
    },
  },

  {
    id: 'it_oldfloor', kind: 'maybeLong', weight: 2,
    tier: 'rare', valence: { favorable: 0.3, unfavorable: 0.7 },
    root: {
      text: '旧教学楼里，那扇门又出现了。\n这一次，它是真的、实在地立在你面前，门缝下透着一点光。',
      choices: [
        {
          text: '推门进去', requires: { identityFactor: 'ancient' },
          next: {
            byMutual: {
              text: '门开了。门后没有人——门后是你自己，背对着，慢慢转过头。',
              gainClue: 'clue_chain',
            },
            byOneSide: { text: '门推到一半就停住了。光从缝里流出来，照在你脚背上。' },
          },
        },
        {
          text: '伸手，隔着门去摸', requires: { identityFactor: 'seal' },
          next: {
            byMutual: {
              text: '门后传来一声很轻的抓挠，像有什么被困在里面，认出了你。',
              gainClue: 'clue_chain',
            },
            byOneSide: { text: '你的手掌贴上门，什么都没有发生。凉意顺着掌心往上爬。' },
          },
        },
        { text: '转身离开', next: { text: '你转身，走下楼梯。门在你身后慢慢淡了下去。' } },
      ],
    },
  },

  {
    // 失控事件：由 RunEngine 在检测敌意时强制指定。
    id: 'it_out_of_control', kind: 'short', weight: 0,
    tier: 'critical', valence: { unfavorable: 1 },
    root: {
      text: '这个月的某种东西，终于压不住了。\n等你回过神来，已经站在那个人面前。',
      choices: [
        {
          text: '“别再靠近我。”',
          next: { text: '话没说完，事情就已经发生了。' },
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
    { id: 'npc_lin',   name: '林老师',   type: 'resident', personality: '严肃公正', affinityStart: 10, persistAcrossRuns: true, place: '教学楼', relation: '尊', power: 40 },
    { id: 'npc_qiu',   name: '邱同学',   type: 'resident', personality: '热心八卦', affinityStart: 20, persistAcrossRuns: true, place: '教室',   relation: '友', power: 25 },
    { id: 'npc_moon',  name: '月亮学姐', type: 'resident', personality: '神神秘秘', affinityStart: 0,  persistAcrossRuns: true, place: '旧楼',   relation: '谜', power: 55 },
    { id: 'npc_yao',   name: '姚主任',   type: 'resident', personality: '刻板严厉', affinityStart: 0,  persistAcrossRuns: true, place: '办公室', relation: '敌', power: 30 },
    { id: 'npc_shen',  name: '沈星河',   type: 'resident', personality: '冷淡学霸', affinityStart: 5,  persistAcrossRuns: true, place: '图书馆', relation: '友', power: 35 },
    { id: 'npc_jiang', name: '江晴',     type: 'resident', personality: '开朗体委', affinityStart: 10, persistAcrossRuns: true, place: '操场',   relation: '友', power: 45 },
    { id: 'npc_he',    name: '何老师',   type: 'resident', personality: '温和心理', affinityStart: 15, persistAcrossRuns: true, place: '办公室', relation: '尊', power: 30 },
    { id: 'npc_gu',    name: '顾伯',     type: 'resident', personality: '沉默校工', affinityStart: 5,  persistAcrossRuns: true, place: '旧楼',   relation: '谜', power: 70 },
  ],
  goals: [
    { id: 'g_truth', title: '揭开轮回真相',     target: 8 },
    { id: 'g_bond',  title: '与一个人建立真关系', target: 5 },
  ],
  affinityCap: 100,
  timeline: buildTimeline(),
  events,
  interactEvents,
  clues,
  acquiredFactors,
  outcomes: [
    {
      id: 'o_default',
      title: '【第一学期 · 完】',
      narrative:
        '第一学期结束了。\n' +
        '关于体内那个东西，你只确定一件事：它还在。\n\n' +
        '（后续内容在做）',
      minGoalRatio: 0,
    },
  ],
  factorPool,
  factorGroups,
}