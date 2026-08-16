/**
 * 发布平台。新增平台专家时在此扩展（SPEC-005 §3）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "Platform".
 */
export type Platform = "xiaohongshu" | "zhihu" | "wechat";
/**
 * 文章输出格式，第一阶段仅 markdown（SPEC-000 §4）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "ArticleFormat".
 */
export type ArticleFormat = "markdown";
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "SourceType".
 */
export type SourceType = "rss" | "rsshub" | "manual" | "crawler";
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "SourceCategory".
 */
export type SourceCategory = "news" | "research" | "tutorial" | "kol";
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "RawItemStatus".
 */
export type RawItemStatus = "new" | "clustered" | "discarded";
/**
 * 选题状态机（SPEC-002 §3），流转只由 core 执行
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "TopicStatus".
 */
export type TopicStatus = "candidate" | "scored" | "approved" | "in_writing" | "written" | "rejected";
/**
 * 文章状态机（SPEC-002 §3）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "ArticleStatus".
 */
export type ArticleStatus =
  "draft" | "scored" | "rewrite_queued" | "pending_review" | "approved" | "published" | "rejected";
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "MetricSource".
 */
export type MetricSource = "manual" | "import" | "api";
/**
 * 反思经验类别（SPEC-006 §4）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "InsightKind".
 */
export type InsightKind = "topic_lesson" | "writing_lesson" | "platform_lesson" | "source_lesson";
/**
 * candidate=孤证待验，active=生效，retired=被后续数据推翻（SPEC-006 §6）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "InsightStatus".
 */
export type InsightStatus = "candidate" | "active" | "retired";
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "AgentRunStatus".
 */
export type AgentRunStatus = "running" | "succeeded" | "failed";
/**
 * material=能拿到原文，可作写作素材；signal=只有二手摘要，仅供发现（SPEC-003 §2.1）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "SourceRole".
 */
export type SourceRole = "material" | "signal";
/**
 * rss_description=RSS 自带正文足够；fetch_page=需抓原文页（trafilatura）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "FullTextStrategy".
 */
export type FullTextStrategy = "rss_description" | "fetch_page";
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "TopicEvaluation".
 */
export type TopicEvaluation = EvaluationCore & {
  topicId: string;
  /**
   * 评分时生效的 weight_sets.version，用于历史回放
   */
  weightVersion?: number | null;
  /**
   * 触发一票否决的维度；没有 veto 时为空
   */
  vetoedDimension?: string | null;
  [k: string]: unknown;
};
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "ArticleEvaluation".
 */
export type ArticleEvaluation = EvaluationCore & {
  articleId: string;
  [k: string]: unknown;
};

/**
 * scholars-ai 契约单一事实来源（SPEC-002 实体 / SPEC-001§3 job / SPEC-004 rubric 结构）。修改本文件后必须运行 scripts/generate.sh 重新生成三端代码。
 */
export interface ScholarsContracts {
  [k: string]: unknown;
}
/**
 * 信源（SPEC-003 §2）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "Source".
 */
export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url: string | null;
  category: SourceCategory;
  /**
   * 信源质量权重 0–1，被反馈闭环校准（SPEC-006 §5）
   */
  weight: number;
  enabled: boolean;
  fetchConfig: SourceFetchConfig;
}
/**
 * 单个信源的采集配置（SPEC-008 §3.1）。intervalMinutes 为空表示沿用全局默认；不为空即覆盖全局。additionalProperties 保持开放以便加源专属开关而不破契约。
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "SourceFetchConfig".
 */
export interface SourceFetchConfig {
  role?: SourceRole;
  fullText?: FullTextStrategy;
  /**
   * 单次采集条目上限。arXiv 类源单次返回数百条，必须限量
   */
  maxItems?: number;
  /**
   * 早于此天数的条目直接丢弃且不做 embedding（省额度）
   */
  maxAgeDays?: number;
  /**
   * 覆盖全局采集间隔；null/缺省=沿用全局默认（SPEC-008 §3.1）
   */
  intervalMinutes?: number | null;
  [k: string]: unknown;
}
/**
 * 原始采集条目
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "RawItem".
 */
export interface RawItem {
  id: string;
  sourceId: string;
  title: string;
  url: string | null;
  author: string | null;
  /**
   * 清洗后的正文（markdown/纯文本）
   */
  content: string;
  publishedAt: string | null;
  contentHash: string;
  status: RawItemStatus;
}
/**
 * 选题（素材之上的创作视角，SPEC-003 §4）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "Topic".
 */
export interface Topic {
  id: string;
  title: string;
  /**
   * 切入角度描述
   */
  angle: string;
  /**
   * 选题简介 + 素材要点
   */
  summary: string;
  rawItemIds: string[];
  /**
   * @minItems 1
   */
  targetPlatforms: [Platform, ...Platform[]];
  status: TopicStatus;
  latestScore: number | null;
}
/**
 * 评分记录公共结构（SPEC-004 §1）。dimensionScores: 维度 key → 0–10 分
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "EvaluationCore".
 */
export interface EvaluationCore {
  id: string;
  /**
   * 如 topic@v1 / article/xiaohongshu@v3
   */
  rubricVersion: string;
  dimensionScores: {
    [k: string]: number;
  };
  totalScore: number;
  /**
   * 人可读的评审理由
   */
  rationale: string;
  judgeModel: string;
  agentRunId: string | null;
}
/**
 * 文章资产（配图/封面），M3+ 启用（SPEC-005 §4）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "ArticleAsset".
 */
export interface ArticleAsset {
  role: "cover" | "inline";
  url: string;
  caption?: string;
}
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "Article".
 */
export interface Article {
  id: string;
  topicId: string;
  platform: Platform;
  /**
   * 同一 topic+platform 的重写版本号，从 1 起
   */
  version: number;
  format: ArticleFormat;
  title: string;
  contentMd: string;
  assets: ArticleAsset[];
  /**
   * 产出它的专家 Agent 标识 + prompt 版本，如 writer/xiaohongshu@v2
   */
  writerAgent: string;
  status: ArticleStatus;
  latestScore: number | null;
}
/**
 * 发布记录（人工发布后登记）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "Publication".
 */
export interface Publication {
  id: string;
  articleId: string;
  platform: Platform;
  platformPostId: string | null;
  publishedAt: string;
  /**
   * 人工发布前的修改 diff，衡量人工修改量指标
   */
  finalContentDiff: string | null;
  /**
   * 发布时账号粉丝数，表现分基数修正用（SPEC-006 §3）
   */
  followerCountAtPublish: number | null;
}
/**
 * 平台指标，各平台字段不齐，缺失置 null
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "EngagementMetrics".
 */
export interface EngagementMetrics {
  views: number | null;
  likes: number | null;
  favorites: number | null;
  comments: number | null;
  shares: number | null;
  follows: number | null;
}
/**
 * 数据快照，同一发布多次采样看增长曲线（24h/72h/7d，SPEC-006 §2）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "MetricSnapshot".
 */
export interface MetricSnapshot {
  id: string;
  publicationId: string;
  capturedAt: string;
  metrics: EngagementMetrics;
  source: MetricSource;
}
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "InsightEvidence".
 */
export interface InsightEvidence {
  articleIds: string[];
  publicationIds: string[];
  /**
   * 数据摘要，如：标题含数字的 5 篇 24h 收藏率均值 2.3x
   */
  note: string;
}
/**
 * 反思产出的经验条目。必须可执行且有证据（SPEC-006 §4：evidence 非空）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "Insight".
 */
export interface Insight {
  id: string;
  kind: InsightKind;
  platform: Platform | null;
  content: string;
  /**
   * @minItems 1
   */
  evidence: [InsightEvidence, ...InsightEvidence[]];
  confidence: number;
  status: InsightStatus;
}
/**
 * Agent 运行留痕（成本/溯源，SPEC-002）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "AgentRun".
 */
export interface AgentRun {
  id: string;
  jobType: string;
  entityType: string | null;
  entityId: string | null;
  langfuseTraceId: string | null;
  model: string | null;
  promptVersion: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  status: AgentRunStatus;
}
/**
 * 跨队列传播的可选遥测元数据。旧消息可以不包含 _meta；Consumer 缺失时创建新的 root trace。
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "JobTelemetryMeta".
 */
export interface JobTelemetryMeta {
  jobId: string;
  correlationId: string;
  parentJobId?: string | null;
  traceparent?: string | null;
  tracestate?: string | null;
  baggage?: string | null;
  enqueuedAt: string;
  triggerType: "api" | "scheduler" | "harvester" | "worker";
}
/**
 * queue: topic_evaluate（SPEC-001 §3。队列名注册表见 queues.json）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "TopicEvaluateJob".
 */
export interface TopicEvaluateJob {
  _meta?: JobTelemetryMeta;
  topicId: string;
  /**
   * 缺省用当前生效版本
   */
  rubricVersion?: string;
}
/**
 * 回炉重写上下文（SPEC-005 §2）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "RewriteContext".
 */
export interface RewriteContext {
  previousArticleId: string;
  evaluationFeedback: string;
  /**
   * 结构维度不达标时才重跑大纲
   */
  redoOutline: boolean;
}
/**
 * queue: article_write
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "ArticleWriteJob".
 */
export interface ArticleWriteJob {
  _meta?: JobTelemetryMeta;
  topicId: string;
  platform: Platform;
  rewrite?: RewriteContext;
}
/**
 * queue: article_evaluate
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "ArticleEvaluateJob".
 */
export interface ArticleEvaluateJob {
  _meta?: JobTelemetryMeta;
  articleId: string;
  rubricVersion?: string;
}
/**
 * queue: source_fetch（core cron 投递，agents 采集，SPEC-003 §3）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "SourceFetchJob".
 */
export interface SourceFetchJob {
  _meta?: JobTelemetryMeta;
  sourceId: string;
  /**
   * 手动投喂时只抓取这一条 URL；普通 source_fetch 不传
   */
  url?: string | null;
  /**
   * 手动投喂备注，供留痕使用
   */
  note?: string | null;
}
/**
 * queue: topic_scout（聚合 status=new 的素材为选题，SPEC-003 §4；rawItemIds 用于手动投喂定向处理）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "TopicScoutJob".
 */
export interface TopicScoutJob {
  _meta?: JobTelemetryMeta;
  maxTopics?: number;
  /**
   * 仅处理指定的 new 素材；手动投喂链路使用
   *
   * @minItems 1
   */
  rawItemIds?: [string, ...string[]];
}
/**
 * queue: memory_reflect（SPEC-006 §4；periodStart 含、periodEnd 不含）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "MemoryReflectJob".
 */
export interface MemoryReflectJob {
  _meta?: JobTelemetryMeta;
  periodStart: string;
  periodEnd: string;
}
/**
 * worker 回报结构：core 据此收割结果并推进状态机
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "JobResult".
 */
export interface JobResult {
  agentRunId: string;
  entityIds: string[];
  langfuseTraceId: string | null;
}
/**
 * 全局调度设置（SPEC-008 §3.1）。存 DB、由 client 修改；DEFAULT_* 环境变量只用于首次 seed，运行时真相只在 DB。
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "SchedulerSettings".
 */
export interface SchedulerSettings {
  sourceFetch: SourceFetchSchedule;
  topicScout: TopicScoutSchedule;
  topicEvaluate: TopicEvaluateSchedule;
}
/**
 * 采集调度：全局默认间隔，可被 sources.fetchConfig.intervalMinutes 逐源覆盖
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "SourceFetchSchedule".
 */
export interface SourceFetchSchedule {
  enabled: boolean;
  /**
   * 下限 5 分钟：防止误配成高频轮询触发上游限流（RSSHub / X 尤其敏感）
   */
  defaultIntervalMinutes: number;
}
/**
 * 选题聚合调度：按每日固定时刻触发
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "TopicScoutSchedule".
 */
export interface TopicScoutSchedule {
  enabled: boolean;
  /**
   * 每日执行时刻（HH:MM，24 小时制）。client 用表单生成，不让用户手写 cron 表达式
   *
   * @minItems 1
   * @maxItems 24
   */
  times: [string, ...string[]];
  /**
   * IANA 时区名，如 Asia/Shanghai
   */
  timezone: string;
  /**
   * 新素材不足此数则跳过本次运行并留痕（避免为几条素材烧一次 LLM）
   */
  minNewItems: number;
}
/**
 * 评分调度：**事件驱动**，candidate 产生即投递，不设固定时刻（SPEC-008 §3.1 纪律 2）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "TopicEvaluateSchedule".
 */
export interface TopicEvaluateSchedule {
  enabled: boolean;
  maxConcurrency: number;
}
/**
 * 信源采集健康状态（client 信源管理页展示；连续失败需告警）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "SourceHealth".
 */
export interface SourceHealth {
  sourceId: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  nextRunAt: string | null;
}
/**
 * TopicJudge 的结构化输出契约（供 runtime.complete_structured 校验）。**维度 key 必须与 rubrics/topic.v1.yaml 完全一致**——rubric 是唯一事实来源，此处不得另立一套。totalScore 由代码按生效权重重算，不信任模型自报（SPEC-004 §1.2）。
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "TopicJudgeOutput".
 */
export interface TopicJudgeOutput {
  dimensionScores: {
    timeliness: DimensionScore;
    audience_value: DimensionScore;
    platform_fit: DimensionScore;
    differentiation: DimensionScore;
    material_richness: DimensionScore;
    history_signal: DimensionScore;
  };
  /**
   * 人可读的总体评审理由：评分不可信时人要能一眼看出是 rubric 问题还是模型问题（SPEC-004 §1.5）
   */
  rationale: string;
  /**
   * Judge 认为该选题更适合的平台（可与 TopicScout 的建议不同）
   */
  suggestedPlatforms?: Platform[];
}
/**
 * 单维度评分：分数 + 该维度的具体理由（强制逐维给理由，抑制笼统打分）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "DimensionScore".
 */
export interface DimensionScore {
  score: number;
  reason: string;
}
/**
 * TopicScout 的结构化输出契约：一簇素材 → 1–3 个选题角度（SPEC-003 §4）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "TopicScoutOutput".
 */
export interface TopicScoutOutput {
  /**
   * @minItems 0
   * @maxItems 3
   */
  topics: [] | [TopicDraft] | [TopicDraft, TopicDraft] | [TopicDraft, TopicDraft, TopicDraft];
  /**
   * 本簇未产出任何选题时的原因（留痕，便于调 prompt）
   */
  discardReason?: string;
}
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "TopicDraft".
 */
export interface TopicDraft {
  title: string;
  /**
   * 切入角度：同一事件对小红书和知乎的写法角度可能完全不同
   */
  angle: string;
  /**
   * 选题简介 + 素材要点
   */
  summary: string;
  /**
   * @minItems 1
   */
  rawItemIds: [string, ...string[]];
  /**
   * @minItems 1
   */
  targetPlatforms: [Platform, ...Platform[]];
}
/**
 * 锚定样例：抑制 LLM 评分中心化（SPEC-004 §1.3）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "RubricAnchor".
 */
export interface RubricAnchor {
  score: number;
  example: string;
  why: string;
}
/**
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "RubricDimension".
 */
export interface RubricDimension {
  key: string;
  name: string;
  description: string;
  /**
   * 初始权重；生效权重存 DB（WeightSet），由校准环节调整（SPEC-004 §4）
   */
  initialWeight: number;
  anchors: RubricAnchor[];
  /**
   * 一票否决线：任一维度低于此分整体不通过，不参与加权（如文章 accuracy<6，SPEC-004 §3）
   */
  vetoBelow: number | null;
}
/**
 * rubric 定义（rubrics/*.yaml 的结构约束）。完整版本号 = {id}@{version}
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "RubricDefinition".
 */
export interface RubricDefinition {
  /**
   * 如 topic / article/xiaohongshu
   */
  id: string;
  version: string;
  /**
   * @minItems 1
   */
  dimensions: [RubricDimension, ...RubricDimension[]];
  /**
   * 总分阈值：选题推荐线/文章过审线
   */
  passThreshold: number;
}
/**
 * 校准后的生效权重（存 DB，版本递增，人工确认后生效，SPEC-004 §4）
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "WeightSet".
 */
export interface WeightSet {
  rubricId: string;
  version: number;
  weights: {
    [k: string]: number;
  };
  note: string;
}
/**
 * 表现分 P 的平台权重（SPEC-006 §3），定义见 rubrics/performance-weights.v1.yaml
 *
 * This interface was referenced by `ScholarsContracts`'s JSON-Schema
 * via the `definition` "PerformanceWeights".
 */
export interface PerformanceWeights {
  platform: Platform;
  version: number;
  weights: {
    [k: string]: number;
  };
}
