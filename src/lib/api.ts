// core API 的类型化 client：类型来自 scholar-shared 的 codegen 产物（gen/core-api.d.ts）。
// M0 先手动同步类型文件；M1 起在 CI 中校验与 shared 的一致性。
import type { paths } from "../../gen/core-api";

const BASE = process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:8080/api";

type TopicList =
  paths["/v1/topics"]["get"]["responses"]["200"]["content"]["application/json"];
type Topic =
  paths["/v1/topics/{topicId}"]["get"]["responses"]["200"]["content"]["application/json"];

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<{ status: string; db: string }>(`/healthz`),
  listTopics: (status?: string) =>
    get<TopicList>(`/v1/topics${status ? `?status=${status}` : ""}`),
  getTopic: (id: string) => get<Topic>(`/v1/topics/${id}`),
};
