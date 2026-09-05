"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, Clock3, LoaderCircle, Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { api, type WorkflowRun } from "@/lib/api";
import { WorkflowRunSkeletonRows } from "@/components/workflow/WorkflowRunListLoading";

const RUN_STAGE_LABELS = [
  ["source_fetch", "采集"],
  ["topic_scout", "选题"],
  ["topic_evaluate", "题评"],
  ["article_write", "写作"],
  ["article_evaluate", "文评"],
  ["human_review", "审阅"],
] as const;

function summaryRecord(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result = (value as Record<string, unknown>)[key];
  return result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : undefined;
}

function summaryNumber(value: unknown, key: string) {
  const result = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined;
  return typeof result === "number" && Number.isFinite(result) ? result : 0;
}

function triggerLabel(run: WorkflowRun) {
  if (run.triggerType === "scheduled") return "自动";
  if (run.triggerType === "replay") return "回放";
  return "手动";
}

function formatTime(value?: string | null) {
  if (!value) return "未开始";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(value));
}

export default function WorkflowRunList({ initialRuns }: { initialRuns?: WorkflowRun[] }) {
  const router = useRouter();
  const [runs, setRuns] = useState(initialRuns ?? []);
  const [loading, setLoading] = useState(initialRuns === undefined);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string>();

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await api.listWorkflowRuns();
      setRuns(result.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取运行记录");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRuns === undefined) void loadRuns();
  }, [initialRuns, loadRuns]);

  const trigger = async () => {
    setTriggering(true);
    setError(undefined);
    try {
      const run = await api.createWorkflowRun();
      router.push(`/workflow/${run.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法启动工作流");
      setTriggering(false);
    }
  };

  return <main className="workflow-page">
    <header className="workflow-header">
      <div>
        <div className="eyebrow">SCHOLARS AI / WORKFLOW CONTROL</div>
        <h1>内容生产工作流</h1>
        <p>从资讯采集到可发布文章，每一步都留下可追踪的 Agent 记录。</p>
      </div>
      <div className="workflow-actions">
        <button className="button button-primary workflow-trigger" disabled={triggering} onClick={trigger}>
          {triggering ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
          启动一次采集
        </button>
      </div>
    </header>

    {error && <div className="workflow-alert"><CircleAlert size={16} /><span>{error}</span><button className="button button-quiet" onClick={loadRuns}><RefreshCw size={14} />重试</button></div>}

    <section className="workflow-run-list" aria-label="工作流任务列表" aria-busy={loading}>
      <div className="workflow-section-heading">
        <div><span className="section-kicker">RUN HISTORY</span><h2>任务列表</h2></div>
        <span className="muted">{loading ? <><LoaderCircle size={13} className="spin" />正在加载</> : error ? "加载失败" : `${runs.length} 次运行`}</span>
      </div>
      {loading ? <WorkflowRunSkeletonRows /> : error ? null : runs.length === 0 ? <div className="workflow-run-list-empty"><Clock3 size={18} />还没有运行记录。</div> : <div className="workflow-run-items">{runs.map((run) => {
        const funnel = summaryRecord(run.summary, "funnel");
        const total = summaryRecord(run.summary, "total");
        const observability = summaryRecord(run.summary, "observability");
        const recentFailureNode = run.summary?.recentFailureNode;
        return <Link prefetch={false} href={`/workflow/${run.id}`} key={run.id} className="workflow-run-item">
          <span className="workflow-run-item-main"><strong>{formatTime(run.createdAt)}</strong><span>{triggerLabel(run)} · {run.status}{run.parentRunId ? " · 子运行" : ""}</span>{observability?.missing === true && <span className="workflow-run-observability"><CircleAlert size={12} />观测缺失</span>}</span>
          <span className="workflow-run-item-stages">{RUN_STAGE_LABELS.map(([key, label]) => { const stage = funnel?.[key]; return <span key={key} title={`${label}输入 / 通过 / 拒绝 / 失败`}><b>{label}</b>{summaryNumber(stage, "input")} / {summaryNumber(stage, "accepted")} / {summaryNumber(stage, "rejected")} / {summaryNumber(stage, "failed")}</span>; })}</span>
          <span className="workflow-run-item-total"><span>产物 <b>{summaryNumber(total, "artifactCount")}</b></span><span>耗时 <b>{summaryNumber(total, "durationSeconds").toFixed(1)}s</b></span><span>成本 <b>{total && typeof total.costUsd === "number" ? `$${total.costUsd.toFixed(4)}` : "-"}</b></span>{typeof recentFailureNode === "string" && recentFailureNode && <span className="workflow-run-failure"><CircleAlert size={12} />{recentFailureNode}</span>}</span>
        </Link>;
      })}</div>}
    </section>
  </main>;
}
