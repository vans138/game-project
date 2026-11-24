import { useStore } from './store';
import type { Scene } from './types';

// ===== 主界面：2D 纯色背景 + 文本 + 选项 =====
export default function App() {
  const { run, roster, startRun, choose, nextMonthSilent, resetAll, script } = useStore();

  // 未开始：显示开始界面
  if (!run) {
    return (
      <div className="app">
        <div className="panel">
          <h1>{script.title}</h1>
          <p className="muted">纯文本 · 选择驱动 · 三年轮回</p>
          {roster && (
            <p className="muted">上一轮带出：身份[{roster.identity}] 解锁[{roster.unlocked.length}]项</p>
          )}
          <button className="primary" onClick={startRun}>开始一局</button>
          <button className="ghost" onClick={resetAll}>清空存档</button>
        </div>
      </div>
    );
  }

  // 已结束：显示结局
  if (run.finished) {
    return (
      <div className="app">
        <div className="panel">
          <h1>结局</h1>
          <p>{run.ending}</p>
          <p className="muted">本轮已带出到局外存档，下一局将继承身份 / 好感 / 解锁。</p>
          <button className="primary" onClick={startRun}>再来一轮</button>
          <button className="ghost" onClick={resetAll}>清空存档</button>
        </div>
      </div>
    );
  }

  // 进行中
  const month = script.months[run.monthIdx];
  const event = month.eventId ? script.events[month.eventId] : null;
  const scene: Scene | undefined = event ? script.scenes[event.scene] : undefined;
  const player = run.players.p1;

  return (
    <div className="app">
      {/* 2D 纯色背景占位 */}
      <div
        className="scene"
        style={{ background: scene?.color ?? '#1e1e1e' }}
      >
        <span className="scene-name">{scene?.name ?? '校园'}</span>
        <span className="month-badge">{month.label}</span>
      </div>

      <div className="panel">
        <h2>{event ? event.title : '静默学习'}</h2>
        {event ? (
          <>
            <p>{event.text}</p>
            <div className="choices">
              {event.choices.map((c) => {
                const disabled = !isChoiceEnabled(c.require, player);
                return (
                  <button
                    key={c.id}
                    className="choice"
                    disabled={disabled}
                    onClick={() => choose(c.id)}
                    title={disabled ? '条件不足' : ''}
                  >
                    {c.text}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p>这个月没有特别的事件，时间安静地流过。</p>
            <button className="primary" onClick={nextMonthSilent}>推进到下个月</button>
          </>
        )}

        <div className="stats">
          身份：{player.identity} ｜ 私人目标：{player.goalProgress} ｜
          解锁：{player.unlocked.length} 项 ｜ 好感：
          {Object.entries(player.affinity).map(([k, v]) => `${k}:${v}`).join(' ') || '无'}
        </div>

        <details className="log">
          <summary>日志（{run.log.length}）</summary>
          <pre>{run.log.join('\n')}</pre>
        </details>
      </div>
    </div>
  );
}

// 选项是否可选（轻量判定）
function isChoiceEnabled(require: any, player: any): boolean {
  if (!require) return true;
  if (require.hasIdentity && player.identity !== require.hasIdentity) return false;
  if (require.affinityAtLeast) {
    const [npc, v] = require.affinityAtLeast;
    if ((player.affinity[npc] ?? 0) < v) return false;
  }
  if (require.flag && !player.flags.includes(require.flag)) return false;
  return true;
}