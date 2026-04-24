# Changelog

All notable changes to the **Notion 导入助手 (Notion Import Assistant)** project will be documented in this file.

## [5.2.2] - 2026-04-24

### Internal
- **`popup.js` ESM 模块化重构**：将原 2100+ 行 monolithic `popup.js` 拆分为 20 个 ESM 模块，按职责分组到 `extractors/` `notion/` `parsers/` `ui/` `utils/` 五个目录；入口 `popup.js` 仅保留两行 `import`。重构遵循"行为零变更、模块边界清晰"原则，详见 `REFACTOR_LOG.md`。
- **syndication 抽为独立模块**：v5.2.1 的推文 syndication 抓取逻辑（`TWEET_STATUS_RE` / `_tweetMetaCache` / `fetchTweetMeta`）抽离到 `extractors/tweet-syndication.js`，与 `extractors/remote.js`、`extractors/current-tab.js` 解耦；功能与 v5.2.1 等价，仅结构变化。

---

## [5.2.1] - 2026-04-24

### Added
- **推文 Bookmark 真实封面与完整数据**：书签 / 批量模式下导入 `x.com/*/status/*` 推文链接时，改走官方 syndication API（`cdn.syndication.twimg.com/tweet-result`）抓取，拿到真实推文媒体图（photo 首图 / video poster）作为 bookmark 封面，并同时取出"作者 on X: 正文摘要"标题和完整推文正文作为描述。此前 og:image 对所有推文都是同一张通用默认图（被黑名单过滤为无封面）、批量模式 `fetch(x.com)` 还会撞登录墙导致标题仅剩 "X"，现已根除。

### Changed
- **"在 Notion 中查看"按钮样式**：由实心绿色主按钮改为浅绿描边风格，与"导入样式"单选按钮选中态视觉一致，降低完成弹层的视觉重量。
- **Popup 底部间距收紧**：`body` 下内边距与 `#status` 外边距调整，空态下底部空白由 43px 减至 34px，避免视觉松散。

### Internal
- 会话级推文元数据缓存（`_tweetMetaCache`）：UI 预检与正式导入共用缓存，同一推文在 popup 存活期间只调用一次 syndication。
- 整理封面过滤逻辑中的重复实现，`extractCurrentTabMetadata` 内联黑名单统一回 `filterCover`；推文 URL 走 syndication 短路不再经过 `filterCover`，非推文 X URL（主页 / profile）仍由 `filterCover` 屏蔽 X 通用默认图。

---

## [5.1.0] - 2026-03-21

### Added
- **导入成功跳转按钮**：保存完成后显示「在 Notion 中查看」全宽按钮，点击直接跳转到 Notion 中新创建的页面，3 秒倒计时后自动关闭。
- **推文代码块导入**：支持提取 Twitter/X 推文中的 Markdown 代码块（`<pre><code>`），以 Notion Code Block 形式写入，保留语言标识。
- **标签智能建议**：文章/推文模式下，从当前网页标题自动提取关键词（英文术语、短标题段），以可点击芯片形式展示，点击即填入标签输入框，支持切换选中。

### Fixed
- 修复推文中 `data-testid="markdown-code-block"` 代码块和内嵌文字被跳过未导入的问题。

---

## [5.0.0] - 2026-03-13

### Changed
- **UI/UX 彻底重构**：将原有的零散复选框（批量开关、推文提取）重构为具有状态记忆的三阶“导入样式”单选控制栏 (`书签 / 推特长文 / 批量链接`)。
- **项目更名**：应用名称正式从“Notion 终极书签助手”化简定名为“Notion 导入助手”。
- **高级物理动画系统**：针对交互元素实现了具有拟物惯性的多层柔性缓动 (`cubic-bezier(0.25, 1, 0.5, 1)`) 反馈动效。当用户点击、悬停、进入时均提供高级界面反馈（按钮回弹、下潜隐藏）。
- **页面排版优化管理**：
  - 推文提取模式不仅可插入具备 `multi-select` 容错和颜色推算技术的 `Database` 表格。
  - 在把目标定为无表头的 `非数据库普通页面 (Page)` 的情场下，插件会智能地将源网页的 `Author`, `Date`, `Tags`, `URL` 以加粗及带 Emoji 点缀的新文本区块前置渲染在文章顶部，并插入自然的视觉分割线。

### Added
- **推特智能 URL 校验防护**：进入该助手时，会深度扫描和探测底层环境是否归属 `x.com` / `twitter.com` 网站组。如果不符，推特卡片将被以低可见性的灰色彻底防误触拉闸锁定，并优雅降低会话继承容错处理（默认回退到安全模式书签选项）。
- **推特长文实时读取**：现在选择推特模式时，原有的 URL 输入框重新暴露且被转为 `Read-only` 只读模式以防止意外损坏原始数据的来源一致性，在满足视觉锚定感的同时大幅缩短了默认的文本框高度至 64px 以求美观紧凑。
- **自定义属性补全与就地生成技术 (Tag Resolution)**：
  - 在检测推文输入标签（Tags）时，能够深入 Notion 远程服务端拉取并读取出当前的 `schema`.
  - 检测不存在该列字段时将就地在表格中新建多选属性定义列。
  - 遇到库内缺失的新自定义 Tag 词条时会自动构建一个带安全 UUID 的全随机颜色新选项并合并覆盖刷新表格架构，杜绝无法插入 Notion 隐藏词条及视觉掉色的旧日顽疾。

### Fixed
- 处理了批量链接操作工具组由于采用 `flex-end` 排列造成的页面右倾重心不稳问题，现已使用 `space-between` 对向定海神针式定位规整布局空间。
- 修复了因为使用全局覆盖手段移除 DOM 占位造成的 Toggle 按钮组件（封面图抓取开关）消失问题，退回了更原生有效的排布管理策略。

---

## [4.2.0] 及之前版本

### Added
- 核心功能：使用 v3 私有内部 API 抓取网络内容转化为原生 Bookmark 块。
- 功能扩展：封面智能提取和批量处理写入队列。
- 功能扩展：支持独立分析 Twitter 递归发文，以 Block 为单位连缀导出。
