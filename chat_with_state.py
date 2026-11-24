import os, json, urllib.request, urllib.error, datetime, subprocess, re

API_KEY = os.environ.get("DEEPSEEK_API_KEY")
URL = "https://api.deepseek.com/chat/completions"
MODEL = "deepseek-chat"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(BASE_DIR, "project_state.md")
GDD_FILE = os.path.join(BASE_DIR, "GDD.md")
TECH_FILE = os.path.join(BASE_DIR, "tech_spec.md")
CODE_DIR = os.path.join(BASE_DIR, "code")
GITIGNORE = os.path.join(BASE_DIR, ".gitignore")

if not API_KEY:
    print("请先设置 DEEPSEEK_API_KEY")
    exit(1)
os.makedirs(CODE_DIR, exist_ok=True)

# ---------- git 相关 ----------
def git_run(args, cwd=BASE_DIR):
    try:
        r = subprocess.run(["git"] + args, cwd=cwd,
                           capture_output=True, text=True, timeout=60)
        return r.returncode == 0, (r.stdout + r.stderr).strip()
    except Exception as e:
        return False, str(e)

def git_commit_push(message):
    ok, _ = git_run(["add", "-A"])
    if not ok: return
    ok, status = git_run(["status", "--porcelain"])
    if not status: return                      # 没改动
    ok, out = git_run(["commit", "-m", message])
    if not ok:
        print("  [git] commit 失败:", out); return
    ok, out = git_run(["push"])
    if ok:
        print(f"  [git] 已推送: {message}")
    else:
        print("  [git] push 失败:", out)

def ensure_gitignore():
    if not os.path.exists(GITIGNORE):
        with open(GITIGNORE, "w", encoding="utf-8") as f:
            f.write("__pycache__/\n*.pyc\n.env\n*.log\n.venv/\n")

# ---------- 文件读写 ----------
def load_file(path, default=""):
    return open(path, encoding="utf-8").read() if os.path.exists(path) else default

def save_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8").write(content)
    print(f"  [已保存] {os.path.relpath(path, BASE_DIR)}")

def extract_saves(text):
    pattern = r"<<<SAVE:(.+?)>>>\n(.*?)\n<<<END>>>"
    saves = re.findall(pattern, text, re.DOTALL)
    clean = re.sub(pattern, "", text, flags=re.DOTALL).strip()
    if saves:
        for path, content in saves:
            save_file(os.path.join(BASE_DIR, path.strip()), content.strip())
        git_commit_push("AI: 更新 " + ", ".join(p for p, _ in saves))
    return clean, saves

# ---------- System Prompt ----------
SYSTEM_PROMPT = """你是一位资深独立游戏设计师兼全栈游戏工程师，有 10 年经验。

【工作方式】严格分阶段，不要跳步：
阶段1 设计沟通：了解雏形（核心玩法/平台/美术/规模），每次最多问3个问题，打磨核心循环与MVP，输出《GDD》，我确认后进入下一阶段。
阶段2 技术方案：根据GDD给技术选型、模块拆分、数据结构、风险点，我确认后才写代码。
阶段3 编码实现：按模块给完整可运行代码，标文件路径，写注释，给运行步骤。

【重要：产出落盘约定】
- 产出《GDD》时，正文后用 <<<SAVE:GDD.md>>> ... <<<END>>> 包裹完整内容。
- 产出技术方案时用 <<<SAVE:tech_spec.md>>> ... <<<END>>> 包裹。
- 产出每个代码文件时用 <<<SAVE:code/文件名>>> ... <<<END>>> 包裹（一个文件一个块）。
- 普通对话不要用这个标记。

【原则】不确定就问；MVP优先；代码要能直接跑；中文沟通。"""

def build_history():
    ctx = SYSTEM_PROMPT
    for label, path in [("当前项目状态", STATE_FILE), ("已确认的GDD", GDD_FILE),
                        ("已确认的技术方案", TECH_FILE)]:
        c = load_file(path)
        if c: ctx += f"\n\n【{label}】\n{c}"
    files = [f for f in os.listdir(CODE_DIR) if os.path.isfile(os.path.join(CODE_DIR, f))]
    if files: ctx += "\n\n【已有代码文件】" + ", ".join(files)
    return [{"role": "system", "content": ctx}]

history = build_history()

def ask(msg):
    history.append({"role": "user", "content": msg})
    data = json.dumps({"model": MODEL, "messages": history}).encode()
    req = urllib.request.Request(URL, data=data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            result = json.load(r)
    except urllib.error.HTTPError as e:
        print("请求失败:", e.code, e.read().decode()); history.pop(); return
    except Exception as e:
        print("请求异常:", e); history.pop(); return
    content = result["choices"][0]["message"]["content"]
    clean, saves = extract_saves(content)
    print(clean)
    if saves: print(f"\n（本轮保存 {len(saves)} 个文件，已自动 push）")
    history.append({"role": "assistant", "content": content})

# ---------- 启动 ----------
ensure_gitignore()
if not os.path.exists(STATE_FILE):
    save_file(STATE_FILE,
        f"# 项目状态\n\n当前阶段：阶段1 设计沟通\n创建时间：{datetime.datetime.now():%Y-%m-%d}\n\n"
        "## 进度\n- [ ] GDD 确认\n- [ ] 技术方案确认\n- [ ] 代码实现\n")

print("=== 游戏设计协作（自动 git push）===")
print(f"项目目录: {BASE_DIR}")
print("命令: /push 手动推送  /status 看状态  exit 退出\n")

while True:
    q = input("\n你: ").strip()
    if q.lower() == "exit": break
    if q == "/push":
        git_commit_push("手动提交"); continue
    if q == "/status":
        ok, out = git_run(["status", "-s"])
        print(out or "工作区干净")
        ok, log = git_run(["log", "--oneline", "-5"])
        print("最近提交:\n" + (log or "无")); continue
    if not q: continue
    print("\nDeepSeek:")
    ask(q)