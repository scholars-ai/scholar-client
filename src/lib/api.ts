// core API 的类型化 client：类型来自 scholar-shared 的 codegen 产物（gen/core-api.d.ts）。
// M0 先手动同步类型文件；M1 起在 CI 中校验与 shared 的一致性。
import type { paths } from "../../gen/core-api";
import type { components } from "../../gen/core-api";

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
};
