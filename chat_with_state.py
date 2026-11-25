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
PENDING_DIR = os.path.join(BASE_DIR, ".pending")

if not API_KEY:
    print("请先设置 DEEPSEEK_API_KEY")
    exit(1)

os.makedirs(CODE_DIR, exist_ok=True)
os.makedirs(PENDING_DIR, exist_ok=True)


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
        return
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
    lines = []
    if os.path.exists(GITIGNORE):
        lines = open(GITIGNORE, encoding="utf-8").read().splitlines()
    need = ["__pycache__/", "*.pyc", ".env", "*.log", ".venv/", ".pending/"]
    changed = False
    for n in need:
        if n not in lines:
            lines.append(n)
            changed = True
    if changed:
        with open(GITIGNORE, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")


# ---------- 文件读写 ----------
def load_file(path, default=""):
    return open(path, encoding="utf-8").read() if os.path.exists(path) else default


def save_file(path, content):
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)
    open(path, "w", encoding="utf-8").write(content)
    print(f"  [已保存] {os.path.relpath(path, BASE_DIR)}")


def dump_pending(path, content, reason):
    """疑似截断：转存到 .pending/ 下，文件名带上时间戳，避免覆盖。"""
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe = path.replace("/", "__").replace("\\", "__")
    dest = os.path.join(PENDING_DIR, f"{ts}__{safe}")
    open(dest, "w", encoding="utf-8").write(content)
    print(f"  [转存] {path} → .pending/{os.path.basename(dest)}（原因：{reason}）")


# ---------- SAVE 块解析 ----------
SAVE_RE = re.compile(
    r'^<<<SAVE:([A-Za-z0-9_./\-]+)>>>[ \t]*\r?\n'
    r'(.*?)'
    r'^<<<END>>>[ \t]*$',
    re.MULTILINE | re.DOTALL
)

# 结尾看起来"没写完"的字符（对代码文件的粗略哨兵）
BAD_TAIL = ("+", "=", ":", "(", "{", "[", ",", "=>", "&&", "||", "?")


def looks_truncated(path, body):
    """粗略判断内容是否疑似被截断。
    只作为"可疑就拒写"的筛子；宁可误报（重发一次）也绝不写坏现网文件。"""
    if not body.strip():
        return "内容为空"

    last = body.rstrip().splitlines()[-1].rstrip()
    for bad in BAD_TAIL:
        if last.endswith(bad):
            return f"末行以 {bad!r} 结尾"

    ext = os.path.splitext(path)[1].lower()
    if ext in (".ts", ".tsx", ".js", ".jsx", ".py", ".json"):
        # 括号粗配平（可能被字符串干扰，仅作可疑判断）
        for op, cl in (("(", ")"), ("{", "}"), ("[", "]")):
            if body.count(op) != body.count(cl):
                return f"括号不配平 {op} vs {cl}（{body.count(op)}≠{body.count(cl)}）"
        # 反引号奇偶（模板字符串）
        if ext in (".ts", ".tsx", ".js", ".jsx"):
            if body.count("`") % 2 != 0:
                return "反引号数量为奇数（模板字符串未闭合）"
        # 单双引号不配对常见于中文字符串里混入的引号，很不可靠，不做。
    return None


def extract_saves(text):
    """
    fail-safe 落盘：
      1. 同一路径在本次回复里出现多次 → 合并为最后一次（记录警告）
      2. 写盘前用 looks_truncated 做哨兵；疑似截断 → 拒绝写、转存 .pending/
      3. 通过校验的才整份覆盖现网文件
    """
    saves = list(SAVE_RE.findall(text))

    by_path = {}
    duplicate = set()
    for path, content in saves:
        path = path.strip()
        if not path or ".." in path:
            continue
        if path in by_path:
            duplicate.add(path)
        by_path[path] = content.strip()

    written, rejected = [], []
    for path, body in by_path.items():
        reason = looks_truncated(path, body)
        if reason:
            dump_pending(path, body, reason)
            rejected.append((path, reason))
            continue
        full = os.path.join(BASE_DIR, path)
        save_file(full, body)
        written.append(path)

    if written:
        git_commit_push("AI: 更新 " + ", ".join(written))

    if duplicate:
        print(f"  [提示] 本轮同一路径出现多次：{', '.join(sorted(duplicate))}")
    if rejected:
        print("\n  ❌ 以下文件因疑似截断被拒绝写入（内容已转存 .pending/）：")
        for p, r in rejected:
            print(f"     - {p}（{r}）")
        print("     请让模型重发这些文件，或从 .pending/ 手动取用。")

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
- 如果你预判本轮回复太长、可能写不完全部内容，请在「一个完整的文件块」结束后（<<<END>>> 之后的新行）另起一行写 
-  必须独占一行；系统检测到它会自动让你继续写剩余部分。
- 绝不要在一个代码块中间截断后写 ，必须写完当前文件再续。
- 续写时从上次结尾接着写，不要重复已写内容。

【单文件长度红线（重要）】
- 单个 SAVE 块尽量控制在 200 行以内。超过 200 行的文件，请拆成多个小文件/模块，不要强行一个块写完。
- 落盘脚本会对"疑似截断"的文件拒绝写入并转存到 .pending/（fail-safe）。
"""


# ---------- 组装历史 ----------
# 自动扫描目录（默认扫整个项目，与 SAVE 可写范围一致）
AUTO_SCAN_DIRS = ["."]
SCAN_EXTS = (".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md", ".html", ".py")
SCAN_SKIP_DIRS = {
    "node_modules", "dist", "build", ".git", "__pycache__",
    ".venv", "venv", "out", ".next", "coverage", ".pending",
}

FEED_MAX_CHARS = 120_000


def build_history():
    ctx = SYSTEM_PROMPT
    for label, path in [("当前项目状态", STATE_FILE), ("已确认的GDD", GDD_FILE),
                        ("已确认的技术方案", TECH_FILE)]:
        c = load_file(path)
        if c:
            ctx += f"\n\n【{label}】\n{c}"

    fed_files = []
    for scan_dir in AUTO_SCAN_DIRS:
        root_dir = os.path.join(BASE_DIR, scan_dir)
        if not os.path.isdir(root_dir):
            ctx += f"\n\n【扫描目录 {scan_dir}】（不存在，跳过）"
            continue
        for cur, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in SCAN_SKIP_DIRS]
            for fn in sorted(files):
                if not fn.endswith(SCAN_EXTS):
                    continue
                full = os.path.join(cur, fn)
                rel = os.path.relpath(full, BASE_DIR).replace("\\", "/")
                if rel in ("project_state.md", "GDD.md", "tech_spec.md"):
                    continue
                try:
                    body = load_file(full)
                except Exception as e:
                    ctx += f"\n\n【文件 {rel}】（读取失败: {e}）"
                    continue
                if len(body) > FEED_MAX_CHARS:
                    body = body[:FEED_MAX_CHARS] + f"\n\n...（已截断，原文件过长）"
                fed_files.append(rel)
                ctx += f"\n\n【文件 {rel}】\n```\n{body}\n```"

    if fed_files:
        ctx += f"\n\n【本次已喂 {len(fed_files)} 个文件】"

    return [{"role": "system", "content": ctx}]


history = build_history()


def call_api(messages, timeout=300):
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
    try:
        return result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        print("响应结构异常:", result)
        return None


def ask(msg):
    history.append({"role": "user", "content": msg})

    full_content = ""
    while True:
        content = call_api(history)
        if content is None:
            history.pop()
            return

        has_more = "" in content
        content = content.replace("", "").rstrip()
        full_content = (full_content + "\n" + content) if full_content else content
        history.append({"role": "assistant", "content": content})

        if not has_more:
            break
        history.append({"role": "user",
                        "content": "继续，从上次结尾接着写，不要重复已写内容，写完用收尾标记结束。"})

    clean, saves = extract_saves(full_content)
    print(clean)

    if saves:
        saved_list = ", ".join(p for p, _ in saves)
        history.append({"role": "system",
                        "content": f"[系统] 本轮尝试落盘：{saved_list}（疑似截断的已被拒绝并转存 .pending/）"})


# ---------- 启动 ----------
ensure_gitignore()

if not os.path.exists(STATE_FILE):
    save_file(STATE_FILE,
              f"# 项目状态\n\n当前阶段：阶段1 设计沟通\n创建时间：{datetime.datetime.now():%Y-%m-%d}\n\n"
              "## 进度\n- [ ] GDD 确认\n- [ ] 技术方案确认\n- [ ] 代码实现\n")

print("=== 游戏设计协作（fail-safe 落盘）===")
print(f"项目目录: {BASE_DIR}")
print("命令: /push 手动推送  /status 看状态  /reset 清空上下文  /sync 同步文件  exit 退出\n")

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
    if q in ("/sync", "同步", "刷新"):
        new_sys = build_history()[0]
        if history and history[0]["role"] == "system":
            history[0] = new_sys
        else:
            history.insert(0, new_sys)
        print("  [已同步：system prompt 已刷新为当前文件]")
        continue
    if not q:
        continue

    print("\nDeepSeek:")
    ask(q)