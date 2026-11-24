# ---------- 喂给模型的"文件正文"清单 ----------
# 想让 AI 读到哪些文件，就把相对 BASE_DIR 的路径加进来。
# 相对 BASE_DIR，用正斜杠；不存在会自动跳过；单文件过大自动截断。
FEED_FILES = [
    "code/src/game/types.ts",
    "code/src/game/script.campus.ts",
    "code/src/engine.ts",
    # 按需继续加，例如：
    # "code/src/store.ts",
    # "code/src/game/GameView.ts",
]

# 单个文件最多喂多少字符（防上下文爆炸），超过则截断
FEED_MAX_CHARS = 120_000


def build_history():
    ctx = SYSTEM_PROMPT
    for label, path in [("当前项目状态", STATE_FILE), ("已确认的GDD", GDD_FILE),
                        ("已确认的技术方案", TECH_FILE)]:
        c = load_file(path)
        if c:
            ctx += f"\n\n【{label}】\n{c}"

    # ===== 新增：把指定文件的正文也拼进上下文 =====
    # 这样 AI 就能"看到"真实代码/剧本内容，而不是只知道文件名。
    for rel in FEED_FILES:
        full = os.path.join(BASE_DIR, rel)
        if not os.path.exists(full):
            ctx += f"\n\n【文件 {rel}】（未找到，跳过）"
            continue
        try:
            body = load_file(full)
        except Exception as e:
            ctx += f"\n\n【文件 {rel}】（读取失败: {e}）"
            continue
        # 防上下文爆炸：超长截断
        if len(body) > FEED_MAX_CHARS:
            body = body[:FEED_MAX_CHARS] + f"\n\n...（已截断，原文件 {len(body)} 字符）"
        ctx += f"\n\n【文件 {rel}】\n```\n{body}\n```"
    # ===== 新增结束 =====

    # 递归列出 code/ 下的文件（只列路径，不带内容，控制上下文体积）
    rel_files = []
    for root, _dirs, files in os.walk(CODE_DIR):
        for fn in files:
            full = os.path.join(root, fn)
            rel_files.append(os.path.relpath(full, BASE_DIR).replace("\\", "/"))
    if rel_files:
        ctx += "\n\n【已有代码文件】" + ", ".join(sorted(rel_files))

    return [{"role": "system", "content": ctx}]