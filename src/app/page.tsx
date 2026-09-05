import { Suspense } from "react";

import WorkflowRunList from "@/components/workflow/WorkflowRunList";
import WorkflowRunListLoading from "@/components/workflow/WorkflowRunListLoading";
import type { WorkflowRun } from "@/lib/api";

export const dynamic = "force-dynamic";

async function loadInitialRuns(): Promise<WorkflowRun[] | undefined> {
  const origin = process.env.CORE_API_ORIGIN ?? "http://127.0.0.1:8080";
  try {
    const response = await fetch(`${origin}/api/v1/workflow/runs?limit=30`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return undefined;
    const result = await response.json() as { items: WorkflowRun[] };
    return result.items;
  } catch {
    return undefined;
  }
}

async function WorkflowRunListData() {
  return <WorkflowRunList initialRuns={await loadInitialRuns()} />;
}

export default function Home() {
  return <Suspense fallback={<WorkflowRunListLoading />}><WorkflowRunListData /></Suspense>;
}
