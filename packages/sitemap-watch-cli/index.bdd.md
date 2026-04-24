# sitemap-watch-cli - BDD 规格

> Agent 需要从 competitor sitemap 拿到“当前事实快照”，用于后续状态层做 diff 和 feedback loop 推导。
> 状态：**草稿 - 待确认**

## 范围边界

**包含：**
- 读取 competitor registry
- 抓取并展开 sitemap index / urlset
- 归一化单页 snapshot record
- 用确定性规则给页面打 `pageType` 与 `topicCluster`
- 提供 dataset 级和 entity 级查询
- 提供稳定、可机读的错误响应

**不包含：**
- 历史持久化
- 任意跨运行 diff
- 页面正文抓取
- insight、recommendation、action 生成
- 人类分析报告

## 前提假设

- Phase 1 命令面为：`registry dataset competitors`、`snapshot dataset pages`、`snapshot entity page`
- registry 由本地 JSON 文件提供，定义 competitor 元信息、sitemap URL 与分类规则
- 同一次 snapshot 请求内，只要任一目标 sitemap 抓取或解析失败，本次结果整体失败，不返回部分成功 pages
- 未命中分类规则时，页面仍然保留在 snapshot 中，只是落到默认分类

---

## 功能 1：读取竞品清单

> Agent 需要先知道当前有哪些 competitor 可以被采集，以及它们各自绑定了哪些 sitemap 来源。

**场景 1.1：读取启用中的 competitor 列表**
Given Agent 持有一份合法的 competitor registry
  And registry 中同时存在启用和停用的 competitor
When Agent 请求 competitor 清单
Then Agent 只收到启用中的 competitor
  And 每个 competitor 都带有稳定的基础字段：
    | 字段 |
    |---|
    | competitorId |
    | domain |
    | priority |
    | sitemapUrls |
    | pageTypeRules |
    | topicRules |

**场景 1.2：按 competitor 定位单个对象**
Given Agent 持有一份合法的 competitor registry
When Agent 指定一个存在且启用中的 competitor
Then Agent 只收到该 competitor 的对象
  And 不会混入其他 competitor 的配置

**场景 1.3：registry 中没有任何启用 competitor**
Given Agent 持有一份合法的 competitor registry
  And registry 中所有 competitor 都处于停用状态
When Agent 请求 competitor 清单
Then Agent 收到一个成功但为空的结果
  And 上游可以把它当成“当前没有采集目标”，而不是系统故障

---

## 功能 2：产出当前页面快照

> Agent 需要把 sitemap 当前暴露出来的 URL 集合，转换成可进入状态层的标准 snapshot record 列表。

**场景 2.1：从普通 sitemap 产出页面快照**
Given Agent 指定了一个存在且启用中的 competitor
  And 该 competitor 的 sitemap 返回一组页面 URL
When Agent 请求当前页面快照
Then Agent 收到一个成功结果
  And 结果中包含本次采集时间
  And 结果中的页面数量等于本次归一化后页面记录的数量
  And 每条页面记录都带有稳定字段：
    | 字段 |
    |---|
    | competitorId |
    | domain |
    | url |
    | path |
    | slug |
    | pageType |
    | topicCluster |
    | lastmod |
    | sitemapUrl |
    | capturedAt |

**场景 2.2：从 sitemap index 递归展开页面**
Given Agent 指定了一个存在且启用中的 competitor
  And 该 competitor 的入口 sitemap 实际返回的是 sitemap index
  And index 下挂了多个子 sitemap
When Agent 请求当前页面快照
Then Agent 收到子 sitemap 展开后的页面记录
  And 每条页面记录都保留其来源 sitemapUrl
  And Agent 不需要自己再二次展开 sitemap index

**场景 2.3：多个 sitemap 来源合并后按 URL 去重**
Given Agent 指定了一个存在且启用中的 competitor
  And 该 competitor 配置了多个 sitemap URL
  And 相同页面同时出现在多个 sitemap 中
When Agent 请求当前页面快照
Then 相同的页面 URL 只保留一条记录
  And 最终页面数量按去重后的唯一 URL 计算
  And 每条保留记录仍然能追溯到其归属的 competitor

**场景 2.4：显式指定 capturedAt 时保持该时间戳**
Given Agent 指定了一个存在且启用中的 competitor
  And Agent 显式提供了本次采集时间
When Agent 请求当前页面快照
Then 所有页面记录的 capturedAt 都等于该时间
  And 外层结果中的 capturedAt 也等于该时间

**场景 2.5：sitemap 没有任何页面时返回空快照**
Given Agent 指定了一个存在且启用中的 competitor
  And 目标 sitemap 能正常访问
  And 其中没有任何可归一化的页面 URL
When Agent 请求当前页面快照
Then Agent 收到一个成功但为空的结果
  And count 为 0
  And pages 为空列表

---

## 功能 3：归一化页面分类

> Agent 需要在不引入语义推理依赖的前提下，先用稳定规则把页面映射到基础分类。

**场景 3.1：从 URL 派生 path 与 slug**
Given 某个页面 URL 已被采集到快照中
When Agent 查看该页面记录
Then path 是该页面 URL 在域名后的路径部分
  And slug 是 path 对应的末级语义片段
  And path 与 slug 的生成规则对同一 URL 始终一致

**场景 3.2：按路径和 slug 规则判定 pageType**
Given 页面已进入归一化流程
When 系统按 Phase 1 的确定性规则判定页面类型
Then pageType 至少满足以下真值表：
  | URL 特征 | pageType |
  |---|---|
  | path 以 `/blog/` 开头 | blog |
  | path 以 `/faq/` 开头 | faq |
  | path 以 `/guides/` 开头 | guide |
  | path 以 `/use-cases/` 开头 | use_case |
  | path 以 `/compare/` 开头 | comparison |
  | slug 中包含 `-vs-` | comparison |

**场景 3.3：带语言前缀的路径仍按真实页面类型分类**
Given 页面 URL 带有语言前缀
  And 去掉语言前缀后的 path 命中了已知页面类型规则
When 系统判定页面类型
Then 该页面仍然按去掉语言前缀后的 path 得到正确 pageType
  And 例如 `/de/use-cases`、`/zh-CN/use-cases` 都应被识别为 `use_case`

**场景 3.4：按规则判定 topicCluster**
Given 页面已进入归一化流程
When 系统按 registry 中的 topic 规则判定主题簇
Then topicCluster 至少满足以下真值表：
  | URL 或 slug 命中内容 | topicCluster |
  |---|---|
  | `discord` | discord |
  | `slack` | slack |
  | `telegram` | telegram |
  | `whatsapp` | whatsapp |
  | `automation` | automation |
  | `browser` | browser |
  | `agent` | agent |
  | `email` | email |

**场景 3.5：没有命中任何分类规则时使用默认分类**
Given 页面已进入归一化流程
  And 该页面没有命中任何 pageType 规则
  And 该页面也没有命中任何 topic 规则
When 归一化完成
Then 该页面仍然保留在快照中
  And pageType 被标记为 `other`
  And topicCluster 被标记为 `unknown`

---

## 功能 4：查询单页当前事实

> Agent 有时只需要确认某个具体 URL 当前是否仍然存在于 competitor sitemap 中，而不是拉整份 pages dataset。

**场景 4.1：查询存在于快照中的单页**
Given Agent 指定了一个存在且启用中的 competitor
  And Agent 指定的页面 URL 存在于当前 sitemap 快照中
When Agent 请求单页当前事实
Then Agent 收到该 URL 对应的一条页面记录
  And 该记录字段语义与 dataset 查询中的页面记录完全一致

**场景 4.2：查询未出现在当前快照中的单页**
Given Agent 指定了一个存在且启用中的 competitor
  And Agent 指定的页面 URL 不存在于当前 sitemap 快照中
When Agent 请求单页当前事实
Then Agent 收到明确的未命中响应
  And 该响应能够与“抓取失败”区分开

---

## 功能 5：错误与恢复边界

> Agent 需要准确区分输入错误、抓取失败和解析失败，否则后续 feedback loop 会把坏数据当成真实变化。

**场景 5.1：registry 文件不存在或结构非法**
Given Agent 提供的 registry 文件不存在，或该文件结构不合法
When Agent 发起任意 sitemap-watch 请求
Then Agent 收到明确的输入错误响应
  And 不会进入任何 sitemap 抓取动作

**场景 5.2：目标 sitemap 无法访问**
Given Agent 指定了一个存在且启用中的 competitor
  And 至少一个目标 sitemap 无法访问
When Agent 请求当前页面快照
Then Agent 收到明确的网络失败响应
  And 本次结果整体失败
  And 不返回部分成功的 pages

**场景 5.3：目标 sitemap 返回无法解析的 XML**
Given Agent 指定了一个存在且启用中的 competitor
  And 至少一个目标 sitemap 返回了不可解析的 XML 内容
When Agent 请求当前页面快照
Then Agent 收到明确的解析失败响应
  And 本次结果整体失败
  And 不返回部分成功的 pages

**场景 5.4：指定的 competitor 不存在或不可用**
Given Agent 提供了一个不存在的 competitor，或该 competitor 在 registry 中被标记为停用
When Agent 发起任何依赖该 competitor 的请求
Then Agent 收到明确的输入错误响应
  And 响应里能指出是 competitor 选择无效

---

## 功能 6：Agent-first 输出契约

> 这个 CLI 的主要消费者是 Agent，不是人类，因此默认输出必须稳定、可组合、可重放。

**场景 6.1：默认输出为稳定 JSON**
Given Agent 使用默认输出模式发起请求
When 请求成功
Then Agent 收到结构稳定的 JSON 成功响应
  And 成功响应至少包含 `ok` 与 `data`
  And 人类可读文本不会混入标准输出主体

**场景 6.2：失败时输出稳定错误对象**
Given Agent 使用默认输出模式发起请求
When 请求失败
Then Agent 收到结构稳定的 JSON 失败响应
  And 失败响应至少包含 `ok` 与 `error`
  And error 中至少包含机器可区分的失败类型与可读说明

**场景 6.3：切换到 pretty 输出不会改变数据语义**
Given Agent 或人类切换到 pretty 输出模式
When 对同一请求分别查看默认输出与 pretty 输出
Then 两种模式表达的是同一份事实结果
  And pretty 输出只改变阅读方式
  And 不引入默认输出中不存在的新业务字段

---

## 功能 7：职责边界保持单一

> `sitemap-watch-cli` 只回答“当前 sitemap 是什么”，不能把状态层和决策层的职责偷偷吞进来。

**场景 7.1：CLI 不保存历史**
Given Agent 连续运行两次 snapshot 请求
When 第二次请求开始执行
Then 当前工具只基于当前输入和当前远端 sitemap 重新计算结果
  And 不依赖上一次运行留下的本地历史

**场景 7.2：CLI 不计算 diff**
Given Agent 拿到了某次 snapshot 结果
When Agent 希望知道“相比上次新增或删除了哪些页面”
Then 该问题不由当前工具直接回答
  And 需要交给上层状态层去比较两次 snapshot

**场景 7.3：CLI 不抓取页面正文**
Given Agent 拿到了某个页面 URL
When Agent 请求 sitemap-watch 提供该页面的正文、标题段落或语义摘要
Then 该请求不属于当前工具的职责范围
  And 当前工具只返回 sitemap 暴露的结构化页面事实

**场景 7.4：CLI 不生成 insight 或 action**
Given Agent 拿到了当前 snapshot 结果
When Agent 追问“这代表什么机会”或“是否应该创建 issue”
Then 当前工具不直接给出 insight、recommendation 或 action
  And 这些结论留给 feedback loop 的 derivation 与 routing 层
