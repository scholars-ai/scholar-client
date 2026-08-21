"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type PipelineRun, type PipelineSummary } from "../../lib/api";
import { Button } from "../../components/ui/button";

const stageLinks: Record<string, string> = {
  source_fetch: "/sources",
  topic_scout: "/topics",
  article_write: "/articles",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function cadenceLabel(minutes: number) {
  return minutes >= 60 ? `每 ${minutes / 60} 小时` : `每 ${minutes} 分钟`;
}

function runTimestamp(run: PipelineRun) {
  return Date.parse(run.plannedAt) > 0 ? run.plannedAt : run.enqueuedAt;
}

export default function PipelinePage() {
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextSummary, nextRuns] = await Promise.all([api.getPipelineSummary(), api.listPipelineRuns(30)]);
      setSummary(nextSummary);
      setRuns(nextRuns.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载流水线总览失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return <main className="page">
    <div className="page-heading">
      <div><div className="eyebrow">CONTROL ROOM / PIPELINE</div><h1>内容流水线</h1><p className="lede">不维护库存，只追踪三段固定节奏：采集资讯 → 生成 Topic → 生成平台文章。</p></div>
      <Button onClick={() => void load()} disabled={loading}>{loading ? "读取中…" : "刷新总览"}</Button>
    </div>

    {error && <div className="error panel">{error}</div>}
    {loading && !summary ? <div className="empty panel">正在读取流水线状态…</div> : summary && <>
      <section className="pipeline-grid">
        {summary.stages.map((stage) => <Link href={stageLinks[stage.key]} className="pipeline-stage panel" key={stage.key}>
          <div className="stage-top"><div><div className="eyebrow">{stage.key.replaceAll("_", " ")}</div><h2>{stage.label}</h2></div><span className="status status-approved">{cadenceLabel(stage.cadenceMinutes)}</span></div>
          <div className="stage-number">{stage.total}</div><div className="meta-row">累计实体</div>
          <div className="stage-stats"><span><strong>{stage.ready}</strong>待处理</span><span><strong>{stage.passed}</strong>通过</span><span><strong>{stage.failed}</strong>失败</span>{stage.rewrites > 0 && <span><strong>{stage.rewrites}</strong>回炉</span>}</div>
          <div className="stage-times"><span>上次 {formatDate(stage.lastRunAt)}</span><span>下次 {formatDate(stage.nextRunAt)}</span></div>
        </Link>)}
      </section>

      <div className="pipeline-columns">
        <section className="panel pipeline-runs"><div className="section-heading"><div><div className="eyebrow">SCHEDULE RUNS</div><h2>最近运行</h2></div><span>{runs.length} 条</span></div>{runs.length === 0 ? <div className="empty">还没有调度留痕。</div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>触发时间</th><th>调度键</th><th>队列</th><th>备注</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td>{formatDate(runTimestamp(run))}</td><td><code>{run.scheduleKey}</code></td><td>{run.queue}</td><td>{run.note ?? "—"}</td></tr>)}</tbody></table></div>}</section>
        <section className="panel pipeline-errors"><div className="section-heading"><div><div className="eyebrow">FAILURE LOG</div><h2>近期失败</h2></div><span>{summary.recentErrors.length} 条</span></div>{summary.recentErrors.length === 0 ? <div className="empty">当前没有未归档失败。</div> : <div className="stack">{summary.recentErrors.map((failure) => <article className="error-row" key={failure.id}><div><strong>{failure.queue}</strong><div className="meta-row">{failure.errorType} · {formatDate(failure.createdAt)}</div></div><p>{failure.message}</p></article>)}</div>}</section>
      </div>
      <p className="meta-row pipeline-footnote">数据更新时间：{formatDate(summary.generatedAt)}。这里展示业务状态与调度留痕；发布后的平台数据仍可在“数据回流”中随时补录。</p>
    </>}
  </main>;
}
