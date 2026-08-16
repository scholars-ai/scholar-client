// core API 的类型化 client：类型来自 scholar-shared 发布的版本化契约包。
import type { components, paths } from "@scholars-ai/contracts/core-api";

const BASE = process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:8080/api";

type TopicList =
  paths["/v1/topics"]["get"]["responses"]["200"]["content"]["application/json"];
type Topic =
  paths["/v1/topics/{topicId}"]["get"]["responses"]["200"]["content"]["application/json"];
type Evaluation = components["schemas"]["TopicEvaluation"];
type Source = components["schemas"]["SourceWithHealth"];
type SourceInput = components["schemas"]["SourceInput"];
type SourcePatch = components["schemas"]["SourcePatch"];
type SchedulerSettings = components["schemas"]["SchedulerSettings"];
type SchedulerSettingsPatch = components["schemas"]["SchedulerSettingsPatch"];
type JobAccepted = components["schemas"]["JobAccepted"];
type ArticleList = components["schemas"]["ArticleList"];
type Article = components["schemas"]["Article"];
type ArticleDetail = components["schemas"]["ArticleDetail"];
type ArticleEvaluation = components["schemas"]["ArticleEvaluation"];
type Publication = components["schemas"]["Publication"];
type ArticleStatus = components["schemas"]["ArticleStatus"];
type Platform = components["schemas"]["Platform"];
type CreatePublicationRequest = components["schemas"]["CreatePublicationRequest"];

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
};
