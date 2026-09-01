// core API 的类型化 client：类型来自 scholar-shared 发布的版本化契约包。
import type { components, paths } from "@scholars-ai/contracts/core-api";

const BASE = process.env.NEXT_PUBLIC_CORE_API_URL ?? "/api";

type TopicList =
  paths["/v1/topics"]["get"]["responses"]["200"]["content"]["application/json"];
type Topic =
  paths["/v1/topics/{topicId}"]["get"]["responses"]["200"]["content"]["application/json"];
type Evaluation = components["schemas"]["TopicEvaluation"];
type Source = components["schemas"]["SourceWithHealth"];
type SourceInput = components["schemas"]["SourceInput"];
type SourcePatch = components["schemas"]["SourcePatch"];
export type ArticleWriteSchedule = {
  enabled: boolean;
  times: string[];
  timezone: string;
  maxTopics: number;
};
export type SchedulerSettings = components["schemas"]["SchedulerSettings"] & {
  articleWrite: ArticleWriteSchedule;
};
type SchedulerSettingsPatch = components["schemas"]["SchedulerSettingsPatch"] & {
  articleWrite?: ArticleWriteSchedule;
};
type JobAccepted = components["schemas"]["JobAccepted"];
type ArticleList = components["schemas"]["ArticleList"];
type Article = components["schemas"]["Article"];
type ArticleDetail = components["schemas"]["ArticleDetail"];
type ArticleEvaluation = components["schemas"]["ArticleEvaluation"];
type Publication = components["schemas"]["Publication"];
type ArticleStatus = components["schemas"]["ArticleStatus"];
type Platform = components["schemas"]["Platform"];
type CreatePublicationRequest = components["schemas"]["CreatePublicationRequest"];
type PublicationPerformanceList = components["schemas"]["PublicationPerformanceList"];
type MetricSnapshot = components["schemas"]["MetricSnapshot"];
type CreateMetricSnapshotRequest = components["schemas"]["CreateMetricSnapshotRequest"];
type ImportMetricSnapshotsRequest = components["schemas"]["ImportMetricSnapshotsRequest"];
type ImportMetricSnapshotsResult = components["schemas"]["ImportMetricSnapshotsResult"];
type PerformanceDashboard = components["schemas"]["PerformanceDashboard"];
type Insight = components["schemas"]["Insight"];
type InsightKind = components["schemas"]["InsightKind"];
type InsightStatus = components["schemas"]["InsightStatus"];
type WeeklyReport = components["schemas"]["WeeklyReport"];
type TriggerMemoryReflectRequest = components["schemas"]["TriggerMemoryReflectRequest"];
export type WorkflowRun = {
  id: string; correlationId: string; mode: "content_production"; triggerType: "scheduled" | "manual" | "replay";
  startNode: string; status: "queued" | "running" | "waiting_human_review" | "completed" | "completed_empty" | "partial_failed" | "failed" | "cancelled";
  parentRunId: string | null; replayFromNode?: string | null; replayScope: Record<string, unknown> | null;
  inputSnapshotId: string | null; configSnapshotId: string | null; summary: Record<string, unknown>;
  errorMessage: string | null; metadata?: Record<string, unknown>; createdAt: string; startedAt: string | null; completedAt: string | null;
};
export type WorkflowEvent = { id: string; runId: string; sequence: number; nodeKey: string; eventType: string; status: string; message: string; agentRunId: string | null; payload: Record<string, unknown>; occurredAt: string };
export type WorkflowArtifact = { id: string; runId: string; nodeKey: string; artifactType: string; artifactId: string; title: string; metadata: Record<string, unknown>; createdAt: string };
export type WorkflowNodeRun = { id: string; runId: string; nodeKey: string; status: string; inputSnapshotId: string | null; outputSnapshotId: string | null; configSnapshot: Record<string, unknown>; counts: Record<string, unknown>; createdAt: string; startedAt: string | null; completedAt: string | null };
export type WorkflowItemDecision = { id: string; runId: string; nodeRunId: string; itemId: string; itemType: string; decision: string; reasonCode: string; reason: string; totalScore: number | null; createdAt: string };
export type WorkflowRunDetail = WorkflowRun & { events: WorkflowEvent[]; artifacts: WorkflowArtifact[]; nodeRuns: WorkflowNodeRun[]; decisions: WorkflowItemDecision[] };
export type CreateWorkflowRunRequest = { sourceIds?: string[]; metadata?: Record<string, unknown> };

export type PipelineStageSummary = {
  key: "source_fetch" | "topic_scout" | "article_write";
  label: string;
  cadenceMinutes: number;
  total: number;
  ready: number;
  passed: number;
  failed: number;
  rewrites: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
};
export type PipelineSummary = {
  generatedAt: string;
  stages: PipelineStageSummary[];
  recentErrors: Array<{
    id: string;
    queue: string;
    errorType: string;
    message: string;
    retryable: boolean;
    createdAt: string;
  }>;
};
export type PipelineRun = {
  id: string;
  scheduleKey: string;
  plannedAt: string;
  enqueuedAt: string;
  queue: string;
  msgId: number | null;
  note: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `${init?.method ?? "GET"} ${path}: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; db: string }>(`/healthz`),
  getPipelineSummary: () => request<PipelineSummary>(`/v1/pipeline/summary`),
  listPipelineRuns: (limit = 50) =>
    request<{ items: PipelineRun[] }>(`/v1/pipeline/runs?limit=${limit}`),
  listTopics: (status?: string) =>
    request<TopicList>(`/v1/topics${status ? `?status=${status}` : ""}`),
  getTopic: (id: string) => request<Topic>(`/v1/topics/${id}`),
  listEvaluations: (id: string) => request<Evaluation[]>(`/v1/topics/${id}/evaluations`),
  approveTopic: (id: string) => request<Topic>(`/v1/topics/${id}/approve`, { method: "POST" }),
  rejectTopic: (id: string, reason?: string) =>
    request<Topic>(`/v1/topics/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  listSources: () => request<Source[]>(`/v1/sources`),
  createSource: (input: SourceInput) =>
    request<components["schemas"]["Source"]>(`/v1/sources`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateSource: (id: string, patch: SourcePatch) =>
    request<Source>(`/v1/sources/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteSource: (id: string) => request<void>(`/v1/sources/${id}`, { method: "DELETE" }),
  triggerSourceFetch: (id: string) =>
    request<JobAccepted>(`/v1/sources/${id}/fetch`, { method: "POST" }),
  ingestUrl: (url: string, note?: string) =>
    request<JobAccepted>(`/v1/ingest/url`, {
      method: "POST",
      body: JSON.stringify(note ? { url, note } : { url }),
    }),
  getSchedulerSettings: () => request<SchedulerSettings>(`/v1/settings/schedules`),
  updateSchedulerSettings: (patch: SchedulerSettingsPatch) =>
    request<SchedulerSettings>(`/v1/settings/schedules`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  triggerTopicScout: () => request<JobAccepted>(`/v1/scout/run`, { method: "POST" }),
  listArticles: (filters?: { status?: ArticleStatus; platform?: Platform; topicId?: string }) => {
    const query = new URLSearchParams();
    if (filters?.status) query.set("status", filters.status);
    if (filters?.platform) query.set("platform", filters.platform);
    if (filters?.topicId) query.set("topicId", filters.topicId);
    const suffix = query.size ? `?${query.toString()}` : "";
    return request<ArticleList>(`/v1/articles${suffix}`);
  },
  getArticle: (id: string) => request<ArticleDetail>(`/v1/articles/${id}`),
  listArticleEvaluations: (id: string) =>
    request<ArticleEvaluation[]>(`/v1/articles/${id}/evaluations`),
  approveArticle: (id: string) =>
    request<Article>(`/v1/articles/${id}/approve`, { method: "POST" }),
  rejectArticle: (id: string, reason?: string) =>
    request<Article>(`/v1/articles/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  createPublication: (id: string, input: CreatePublicationRequest) =>
    request<Publication>(`/v1/articles/${id}/publications`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listPublications: (filters?: { platform?: Platform; remindersOnly?: boolean }) => {
    const query = new URLSearchParams();
    if (filters?.platform) query.set("platform", filters.platform);
    if (filters?.remindersOnly) query.set("remindersOnly", "true");
    const suffix = query.size ? `?${query.toString()}` : "";
    return request<PublicationPerformanceList>(`/v1/publications${suffix}`);
  },
  listMetricSnapshots: (publicationId: string) =>
    request<MetricSnapshot[]>(`/v1/publications/${publicationId}/metrics`),
  createMetricSnapshot: (publicationId: string, input: CreateMetricSnapshotRequest) =>
    request<MetricSnapshot>(`/v1/publications/${publicationId}/metrics`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  importMetricSnapshots: (input: ImportMetricSnapshotsRequest) =>
    request<ImportMetricSnapshotsResult>(`/v1/metrics/import`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getPerformanceDashboard: (filters?: { platform?: Platform; days?: number }) => {
    const query = new URLSearchParams();
    if (filters?.platform) query.set("platform", filters.platform);
    if (filters?.days) query.set("days", String(filters.days));
    const suffix = query.size ? `?${query.toString()}` : "";
    return request<PerformanceDashboard>(`/v1/performance/dashboard${suffix}`);
  },
  listInsights: (filters?: { kind?: InsightKind; status?: InsightStatus; platform?: Platform }) => {
    const query = new URLSearchParams();
    if (filters?.kind) query.set("kind", filters.kind);
    if (filters?.status) query.set("status", filters.status);
    if (filters?.platform) query.set("platform", filters.platform);
    const suffix = query.size ? `?${query.toString()}` : "";
    return request<Insight[]>(`/v1/insights${suffix}`);
  },
  updateInsight: (id: string, status: "active" | "retired") =>
    request<Insight>(`/v1/insights/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  listWeeklyReports: () => request<WeeklyReport[]>(`/v1/reports/weekly`),
  triggerMemoryReflect: (input: TriggerMemoryReflectRequest = {}) =>
    request<JobAccepted>(`/v1/reflections/run`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listWorkflowRuns: (limit = 30) =>
    request<{ items: WorkflowRun[] }>(`/v1/workflow/runs?limit=${limit}`),
  createWorkflowRun: (input: CreateWorkflowRunRequest = {}) =>
    request<WorkflowRun>(`/v1/workflow/runs`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getWorkflowRun: (id: string) => request<WorkflowRunDetail>(`/v1/workflow/runs/${id}`),
  listWorkflowNodeDecisions: (id: string, nodeKey: string, decision?: string) =>
    request<WorkflowItemDecision[]>(`/v1/workflow/runs/${id}/nodes/${nodeKey}/decisions${decision ? `?decision=${decision}` : ""}`),
  replayWorkflowRun: (id: string, replayFromNode: string, replayScope: Record<string, unknown>, reason?: string) =>
    request<WorkflowRun>(`/v1/workflow/runs/${id}/replay`, {
      method: "POST",
      body: JSON.stringify({ replayFromNode, replayScope, ...(reason ? { reason } : {}) }),
    }),
  compareWorkflowRuns: (id: string, otherRunId: string) =>
    request<{ baseRunId: string; otherRunId: string; sameInput: boolean; stages: Record<string, unknown>; reasonCounts: Record<string, unknown> }>(`/v1/workflow/runs/${id}/compare`, {
      method: "POST",
      body: JSON.stringify({ otherRunId }),
    }),
  listWorkflowEvents: (id: string, after = 0) =>
    request<WorkflowEvent[]>(`/v1/workflow/runs/${id}/events?after=${after}`),
  workflowStreamUrl: (id: string) => `${BASE}/v1/workflow/runs/${id}/stream`,
};
