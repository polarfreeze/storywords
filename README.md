# 词境 · Words in Stories

把 100 个中英混排故事整理为可在电脑和手机上使用的英语词汇阅读网站。

- 完整导入 100 篇故事、487 个原文段落。
- 逐篇词表共 8,675 条，跨故事去重后 3,850 个词或短语。
- 书架可按标题、故事编号、英文词汇、中文词义搜索。
- 学习模式显示随文释义；复习模式点击揭晓；阅读模式收起释义。
- 点击单词查看词卡、调用浏览器英语语音、加入生词本或标记掌握。
- 生词词卡保留原文语境；「认识」后移出生词本，陌生词保留。
- 自动记住阅读段落、读完状态、字号和浅色/深色主题。
- 学习记录只保存在当前浏览器，可导出及导入 JSON 备份。
- 完成首次联网加载及离线缓存后，可以离线阅读全部故事。发音取决于浏览器、系统语音包及网络条件。

故事与原始词表署名：**书豪团队原创**。网页保留原文中的中文语境和英语词形，未把混排故事改写为英语例句。语法、搭配和词义请结合标准词典学习。原始内容的权利归其作者；此仓库未为故事内容另行授予开源许可。

## 运行

网站为无构建依赖的静态 HTML / CSS / JavaScript。进入网站所在目录，运行：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8765/`。也可以直接打开 `index.html` 阅读，但离线缓存需通过 HTTP(S) 使用。

## GitHub Pages

在 [storywords 仓库的 Pages 设置](https://github.com/polarfreeze/storywords/settings/pages) 中选择：

1. Source：**Deploy from a branch**。
2. Branch：**main**；Folder：**/ (root)**。
3. 点击 **Save**，等待 GitHub 显示发布地址。

无需 API Key、数据库、服务器或付费服务。所有资源使用相对路径，可部署在 GitHub Pages 的仓库子路径下。

发布完成后的地址：`https://polarfreeze.github.io/storywords/`。以 GitHub Pages 设置页的实际发布状态为准。

## 重新导入

原始资料目录结构为 `编号、标题/*学习版.pdf` 与 `编号、标题/重点单词.xlsx`。`scripts/import_stories.py` 只读取原文件，输出 `stories.js`。它按 PDF 坐标恢复阅读顺序和段落，并校验 100 篇编号及每篇词表中的每个词。

```powershell
python -m pip install pymupdf openpyxl
python scripts/import_stories.py "原始资料目录" --output stories.js
```

纯 Node.js 数据与资源检查：

```powershell
node scripts/check.mjs
```

发布新版本后应更新 `sw.js` 中的缓存版本号。不要提交个人学习备份、原始 PDF、原始 Excel 或测试浏览器资料。
