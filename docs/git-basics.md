# Git / GitHub 入门（给第一次用 Git 的人）

这份文档只讲这个项目会用到的部分，不追求完整。先把最短路径跑通，再慢慢学分支和 PR。

## 0. 你现在有什么

- 本机已经装了 `git`（`git --version` 能输出版本）。
- 还没有装 GitHub CLI（`gh`）。可以先不装，用网页建仓库也一样。
- 这个目录已经是一个本地项目，但还没有初始化 Git 仓库。

## 1. 四个概念，够用了

| 概念 | 是什么 | 常用命令 |
|---|---|---|
| 工作区 | 你正在改的文件 | `git status` / `git diff` |
| 暂存区 | 准备提交的快照 | `git add` |
| 本地仓库 | 已经 commit 的历史 | `git commit` / `git log` |
| 远程仓库 | GitHub 上的那一份 | `git push` / `git pull` |

- **commit**：一次快照，包含文件内容 + 提交信息 + 父提交。
- **branch**：一个指向某个 commit 的可移动指针，不是一份完整拷贝。
- **remote**：本地仓库记住的远程地址，通常叫 `origin`。

## 2. 第一次推送：网页建仓版

### 2.1 在 GitHub 网页建仓库

打开 <https://github.com/new>：

- Repository name 填 `meowmeow-assistant`（或你喜欢的名字）；
- 可见性选 Public 或 Private；
- **不要勾** “Add a README file”“Add .gitignore”“Choose a license”，因为本地已经有了，勾了反而会在第一次 push 时冲突。

### 2.2 本地初始化并推送

在项目根目录执行：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的 GitHub 邮箱"

git init -b main
git add .
git commit -m "chore: initial project scaffold"

git remote add origin https://github.com/你的用户名/meowmeow-assistant.git
git push -u origin main
```

第一次 push 会弹出浏览器，让 Git Credential Manager 登录 GitHub。登录一次之后，后面就不用重复了。

### 2.3 如果不想用网页，想用 `gh`

```powershell
winget install --id GitHub.cli
gh auth login
gh repo create meowmeow-assistant --public --source=. --remote=origin --push
```

`gh auth login` 是交互式的，需要你本人完成浏览器授权。

## 3. 日常循环

```bash
git pull --rebase                 # 先同步远程
git switch -c feat/focus-state    # 开一个功能分支
# ...改代码...
git status                        # 看哪些文件变了
git diff                          # 看具体改了什么
git add -p                        # 按块选择要提交的内容，比 git add . 安全
git commit -m "feat: add focus state machine"
git push -u origin feat/focus-state
```

然后到 GitHub 页面开 Pull Request：

1. 看 Files changed，确认 diff 里没有密钥、日志、模型；
2. 等 CI 变绿；
3. Merge 到 `main`。

一个人开发也可以走这个流程。PR 的价值是逼你看一遍 diff，而不是形式主义。

## 4. 提交信息怎么写

用 Conventional Commits 前缀：

```text
feat: 新功能
fix: 修 bug
docs: 只改文档
refactor: 不改行为的重构
test: 只改测试
chore: 构建、依赖、杂项
```

例子：

```text
feat: add camera-based away detection
fix: stop camera stream when settings are closed
docs: explain Live2D asset licensing
```

## 5. 这个项目必须忽略的东西

`.gitignore` 已经写好，重点是：

```text
node_modules/
out/
release/
.env
*.log
*.db
.dev-data/
src/renderer/public/live2d/models/*
src/renderer/public/live2d/core/*
```

原因：

- `node_modules` 可以随时 `npm install` 重建，提交它会让仓库巨大；
- `out/`、`release/` 是构建产物；
- `.env` 里可能有 API key；
- Live2D Core 和模型有独立授权，不能随便进公开仓库；
- 本地数据库和日志可能包含你的学习记录。

## 6. 常见错误与处理

### 6.1 不小心提交了 `node_modules`

```bash
git rm -r --cached node_modules
git commit -m "chore: stop tracking node_modules"
```

之后确认 `.gitignore` 里有 `node_modules/`。

### 6.2 不小心提交了 API key

1. 立刻去对应平台吊销这个 key；
2. 换一个新 key；
3. 如果仓库已经公开，密钥会留在历史里，需要重写历史（`git filter-repo` 或 BFG），这一步先找有经验的人确认，不要直接 force push。

### 6.3 直接在 `main` 上改坏了

如果还没 commit：

```bash
git restore <file>        # 丢弃工作区改动
git restore --staged <file>  # 取消暂存
```

如果已经 commit 但还没 push：

```bash
git reset --soft HEAD~1   # 撤销 commit，保留改动
```

已经 push 了就不要随便 `reset --hard` 再 force push；开一个新 commit 修复更安全。

### 6.4 大文件

模型、视频、安装包不要进 Git 历史。需要分发时用 GitHub Releases，或者用 Git LFS。

### 6.5 冲突

```bash
git pull --rebase
# 打开冲突文件，保留你要的内容，删掉 <<<<<<< ======= >>>>>>>
git add <file>
git rebase --continue
```

不确定时先 `git status`，它会告诉你下一步该做什么。

## 7. 版本标签

发布一个可运行版本时：

```bash
git tag -a v0.1.0 -m "M1: desktop mascot and focus detection"
git push origin v0.1.0
```

然后在 GitHub 的 Releases 页面基于这个 tag 写发布说明、上传安装包。

## 8. 这个项目建议的第一次练习

1. 完成首次 push；
2. 开分支 `feat/readme-tweak`，改一行 README；
3. commit、push、开 PR、自己 review、merge；
4. 打 `v0.1.0` tag；
5. 故意在 `.env` 里写一个假 key，确认 `git status` 看不到它。

做完这五步，日常的 Git 流程就够用了。
