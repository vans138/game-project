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
    if not ok:
        return
    ok, status = git_run(["status", "--porcelain"])
    if not status:
        return  # 没改动
    ok, out = git_run(["commit", "-m", message])
    if not ok:
        print("  [git] commit 失败:", out)
        return
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
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)
    open(path, "w", encoding="utf-8").write(content)
    print(f"  [已保存] {os.path.relpath(path, BASE_DIR)}")


# ---------- SAVE 块解析 ----------
# 只匹配“独占一行”的标记：^...$ + MULTILINE
# 路径只允许 ASCII 安全字符，杜绝中文/省略号/反引号/空格导致的 WinError 123
SAVE_RE = re.compile(
    r'^<<<SAVE:([A-Za-z0-9_./\-]+)>>>[ \t]*\r?\n'
    r'(.*?)'
    r'^<<<END>>>[ \t]*$',
    re.MULTILINE | re.DOTALL
)


def extract_saves(text):
    saves = []
    for m in SAVE_RE.finditer(text):
        path = m.group(1).strip()
        content = m.group(2)
        # 兜底校验：非空、无目录穿越
        if not path or '..' in path:
            continue
        saves.append((path, content))

    # 先全部校验完，再统一写盘 + push，避免写一半炸掉
    written = []
    for path, content in saves:
        full = os.path.join(BASE_DIR, path)
        save_file(full, content.strip())
        written.append(path)

    if written:
        git_commit_push("AI: 更新 " + ", ".join(written))

    clean = SAVE_RE.sub("", text).strip()
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
- 标记必须【独占一行】，路径只能是英文/数字/下划线/斜杠/点/短横线，不要写中文路径，不要在行内举例时写出完整标记。

【原则】不确定就问；MVP优先；代码要能直接跑；中文沟通。

【续写约定（重要）】
- 如果你预判本轮回复太长、可能写不完全部内容，请在「一个完整的文件块」结束后（<<<END>>> 之后的新行）另起一行写 <<<MORE>>>
- <<<MORE>>> 必须独占一行。系统检测到它会自动让你继续写剩余部分。
- 绝不要在一个代码块中间截断后写 <<<MORE>>>，必须写完当前文件再续。
- 续写时从上次结尾接着写，不要重复已写内容。
"""


def build_history():
    ctx = SYSTEM_PROMPT
    for label, path in [("当前项目状态", STATE_FILE), ("已确认的GDD", GDD_FILE),
                        ("已确认的技术方案", TECH_FILE)]:
        c = load_file(path)
        if c:
            ctx += f"\n\n【{label}】\n{c}"

    # 递归列出 code/ 下的文件（只列路径，不带内容，控制上下文体积）
    rel_files = []
    for root, _dirs, files in os.walk(CODE_DIR):
        for fn in files:
            full = os.path.join(root, fn)
            rel_files.append(os.path.relpath(full, BASE_DIR).replace("\\", "/"))
    if rel_files:
        ctx += "\n\n【已有代码文件】" + ", ".join(sorted(rel_files))

    return [{"role": "system", "content": ctx}]


history = build_history()


def call_api(messages, timeout=300):
    """单次请求，返回 content 字符串；失败返回 None。"""
    data = json.dumps({"model": MODEL, "messages": messages}).encode()
    req = urllib.request.Request(URL, data=data, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            result = json.load(r)
    except urllib.error.HTTPError as e:
        print("请求失败:", e.code, e.read().decode())
        return None
    except Exception as e:
        print("请求异常:", e)
        return None

    # 安全取值，防结构异常崩掉
    try:
        return result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        print("响应结构异常:", result)
        return None


def ask(msg):
    history.append({"role": "user", "content": msg})

    # 续写循环：检测 <<<MORE>>>，自动请求后续
    full_content = ""
    while True:
        content = call_api(history)
        if content is None:
            # 失败则回滚本轮的 user 消息，避免污染上下文
            history.pop()
            return

        has_more = "<<<MORE>>>" in content
        # 剥掉续写标记后再拼接/入库
        content = content.replace("<<<MORE>>>", "").rstrip()

        full_content = (full_content + "\n" + content) if full_content else content

        # 把本次（去掉 MORE 的）内容放进上下文，供下一次续写参考
        history.append({"role": "assistant", "content": content})

        if not has_more:
            break

        # 要求模型接着上次结尾继续
        history.append({"role": "user",
                        "content": "继续，从上次结尾接着写，不要重复已写内容，写完用收尾标记结束。"})

    # 解析 SAVE 块并写盘（基于完整拼接结果）
    clean, saves = extract_saves(full_content)

    # 打印给用户看（去掉标记后的干净文本）
    print(clean)

    if saves:
        print(f"\n（本轮保存 {len(saves)} 个文件，已自动 push）")
        # 关键：回传“已保存”给模型，形成闭环；同时避免把代码全文留在上下文
        saved_list = ", ".join(p for p, _ in saves)
        history.append({"role": "system",
                        "content": f"[系统] 以下文件已成功落盘并推送：{saved_list}"})


# ---------- 启动 ----------
ensure_gitignore()

if not os.path.exists(STATE_FILE):
    save_file(STATE_FILE,
              f"# 项目状态\n\n当前阶段：阶段1 设计沟通\n创建时间：{datetime.datetime.now():%Y-%m-%d}\n\n"
              "## 进度\n- [ ] GDD 确认\n- [ ] 技术方案确认\n- [ ] 代码实现\n")

print("=== 游戏设计协作（自动 git push）===")
print(f"项目目录: {BASE_DIR}")
print("命令: /push 手动推送  /status 看状态  /reset 清空上下文  exit 退出\n")

while True:
    q = input("\n你: ").strip()
    if q.lower() == "exit":
        break
    if q == "/push":
        git_commit_push("手动提交")
        continue
    if q == "/status":
        ok, out = git_run(["status", "-s"])
        print(out or "工作区干净")
        ok, log = git_run(["log", "--oneline", "-5"])
        print("最近提交:\n" + (log or "无"))
        continue
    if q == "/reset":
        history = build_history()
        print("  [已重置上下文]")
        continue
    if not q:
        continue

    print("\nDeepSeek:")
    ask(q)