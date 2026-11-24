import { create } from 'zustand';
import type { PlayerState, RunState, RosterSave, Script } from './types';
import { script } from './script';
import { applyEffect, checkCondition, createRosterSave, judgeEnding } from './engine';

// ===== 全局状态（单机 + localStorage 存档）=====
const SAVE_KEY = 'script_chicken_save_v1';
const RUN_KEY = 'script_chicken_run_v1';

interface Store {
  script: Script;
  run: RunState | null;
  roster: RosterSave | null;      // 上一轮带出的局外存档
  startRun: () => void;
  choose: (choiceId: string) => void;
  nextMonthSilent: () => void;    // 静默学习回合同步推进
  resetAll: () => void;
}

// 读取/写入持久化
function loadRoster(): RosterSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as RosterSave) : null;
  } catch { return null; }
}
function persistRoster(r: RosterSave) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(r));
}
function persistRun(r: RunState) {
  localStorage.setItem(RUN_KEY, JSON.stringify(r));
}

// 创建初始玩家：身份来自局外存档（若存在），否则默认
function makePlayer(roster: RosterSave | null): PlayerState {
  return {
    identity: roster?.identity ?? 'human',   // 默认身份；可被局外"吸血鬼"等覆盖
    affinity: { ...(roster?.affinity ?? {}) },
    flags: [],
    unlocked: [...(roster?.unlocked ?? [])],
    goalProgress: 0,
  };
}

export const useStore = create<Store>((set, get) => ({
  script,
  run: null,
  roster: loadRoster(),

  startRun: () => {
    const roster = get().roster;
    const run: RunState = {
      monthIdx: 0,
      players: { p1: makePlayer(roster) },
      log: ['—— 新的一轮轮回开始 ——'],
      finished: false,
    };
    persistRun(run);
    set({ run });
  },

  choose: (choiceId: string) => {
    const { run, script } = get();
    if (!run || run.finished) return;
    const month = script.months[run.monthIdx];
    const event = month.eventId ? script.events[month.eventId] : null;
    if (!event) return;

    const choice = event.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    // 深拷贝玩家，避免直接改引用
    const p = structuredClone(run.players.p1);
    if (!checkCondition(choice.require, p)) {
      set({ run: { ...run, log: [...run.log, '条件不足，无法选择。'] } });
      return;
    }

    const logs: string[] = [`【${month.label}】${event.title} → ${choice.text}`];
    for (const e of choice.effects) {
      const msg = applyEffect(p, e);
      if (msg) logs.push('  · ' + msg);
    }

    const nextRun: RunState = {
      ...run,
      players: { ...run.players, p1: p },
      log: [...run.log, ...logs],
    };
    advanceMonth(nextRun, script);
    persistRun(nextRun);
    set({ run: nextRun });
  },

  nextMonthSilent: () => {
    const { run, script } = get();
    if (!run || run.finished) return;
    const nextRun = structuredClone(run);
    // 静默学习：结算小学习收益（这里简化为目标进度+1）
    const p = nextRun.players.p1;
    p.goalProgress += 1;
    nextRun.log.push(`【${script.months[nextRun.monthIdx].label}】静默学习，时间悄然流逝。`);
    advanceMonth(nextRun, script);
    persistRun(nextRun);
    set({ run: nextRun });
  },

  resetAll: () => {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(RUN_KEY);
    set({ run: null, roster: null });
  },
}));

// 推进月份；到 36 月后结算结局并写局外存档
function advanceMonth(run: RunState, script: Script) {
  run.monthIdx += 1;
  if (run.monthIdx >= script.months.length) {
    run.finished = true;
    const p = run.players.p1;
    run.ending = judgeEnding(p);
    run.log.push('—— 三年结束 ——');
    run.log.push('结局：' + run.ending);
    const save = createRosterSave(p, 0);
    persistRoster(save);
    // 更新 store 里的 roster 通过外层 set 已处理不了，这里直接写 localStorage，
    // UI 重新读取即可（简化处理）。
  }
}