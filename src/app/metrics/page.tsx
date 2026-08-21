"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { components } from "@scholars-ai/contracts/core-api";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

type Platform = components["schemas"]["Platform"];
type MetricWindow = components["schemas"]["MetricWindow"];
type PublicationPerformance = components["schemas"]["PublicationPerformance"];
type PerformanceDashboard = components["schemas"]["PerformanceDashboard"];
type Insight = components["schemas"]["Insight"];
type WeeklyReport = components["schemas"]["WeeklyReport"];
type EngagementMetrics = components["schemas"]["EngagementMetrics"];
type MetricSnapshotImportItem = components["schemas"]["MetricSnapshotImportItem"];

const platformLabels: Record<Platform, string> = {
  xiaohongshu: "小红书",
  zhihu: "知乎",
  wechat: "公众号",
};

const windowLabels: Record<MetricWindow, string> = {
  h24: "24 小时",
  h72: "72 小时",
  d7: "7 天",
  custom: "自定义",
};

const metricFields: Array<{ key: keyof EngagementMetrics; label: string }> = [
  { key: "views", label: "阅读/播放" },
  { key: "likes", label: "点赞/赞同/在看" },
  { key: "favorites", label: "收藏" },
  { key: "comments", label: "评论" },
  { key: "shares", label: "分享/转发" },
  { key: "follows", label: "新增关注" },
];

const emptyMetrics: EngagementMetrics = {
  views: null,
  likes: null,
  favorites: null,
  comments: null,
  shares: null,
  follows: null,
};

function localDateTime(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

function parseMetricCsv(text: string): MetricSnapshotImportItem[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV 至少需要表头和一行数据");
  const headers = parseCsvLine(lines[0]);
  const required = [
    "publicationId", "snapshotWindow", "capturedAt", "views", "likes",
    "favorites", "comments", "shares", "follows",
  ];
  for (const name of required) {
    if (!headers.includes(name)) throw new Error(`CSV 缺少列：${name}`);
  }
  const indexOf = (name: string) => headers.indexOf(name);
  const parseMetric = (raw: string, row: number) => {
    if (raw === "") return null;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) throw new Error(`第 ${row} 行指标必须是非负整数`);
    return value;
  };
  return lines.slice(1).map((line, lineIndex) => {
    const row = lineIndex + 2;
    const cells = parseCsvLine(line);
    const snapshotWindow = cells[indexOf("snapshotWindow")] as MetricWindow;
    if (!(["h24", "h72", "d7", "custom"] as string[]).includes(snapshotWindow)) {
      throw new Error(`第 ${row} 行 snapshotWindow 必须是 h24/h72/d7/custom`);
    }
    const captured = new Date(cells[indexOf("capturedAt")]);
    if (Number.isNaN(captured.getTime())) throw new Error(`第 ${row} 行 capturedAt 不是有效时间`);
    return {
      publicationId: cells[indexOf("publicationId")],
      snapshotWindow,
      capturedAt: captured.toISOString(),
      metrics: {
        views: parseMetric(cells[indexOf("views")], row),
        likes: parseMetric(cells[indexOf("likes")], row),
        favorites: parseMetric(cells[indexOf("favorites")], row),
        comments: parseMetric(cells[indexOf("comments")], row),
        shares: parseMetric(cells[indexOf("shares")], row),
        follows: parseMetric(cells[indexOf("follows")], row),
      },
    };
  });
}

export default function MetricsPage() {
  const [platform, setPlatform] = useState<Platform | "">("");
  const [publications, setPublications] = useState<PublicationPerformance[]>([]);
  const [dashboard, setDashboard] = useState<PerformanceDashboard | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [selected, setSelected] = useState<PublicationPerformance | null>(null);
  const [snapshotWindow, setSnapshotWindow] = useState<MetricWindow>("h24");
  const [capturedAt, setCapturedAt] = useState(localDateTime());
  const [metrics, setMetrics] = useState<EngagementMetrics>(emptyMetrics);
  const [csvText, setCsvText] = useState("");
  const [csvRows, setCsvRows] = useState<MetricSnapshotImportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [publicationData, dashboardData, insightData, reportData] = await Promise.all([
        api.listPublications(platform ? { platform } : undefined),
        api.getPerformanceDashboard(platform ? { platform } : undefined),
        api.listInsights(platform ? { platform } : undefined),
        api.listWeeklyReports(),
      ]);
      setPublications(publicationData.items);
      setDashboard(dashboardData);
      setInsights(insightData);
      setReports(reportData);
      setSelected((current) => current
        ? publicationData.items.find((item) => item.publication.id === current.publication.id) ?? null
        : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载 M3 数据失败");
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => { void load(); }, [load]);

  const due = useMemo(
    () => publications.filter((item) => item.reminders.length > 0),
    [publications],
  );

  function choosePublication(item: PublicationPerformance, window?: MetricWindow) {
    setSelected(item);
    setSnapshotWindow(window ?? item.reminders[0]?.snapshotWindow ?? "custom");
    setCapturedAt(localDateTime());
    setMetrics(emptyMetrics);
    setMessage(null);
    setError(null);
  }

  async function submitMetric(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setWorking(true); setError(null); setMessage(null);
    try {
      await api.createMetricSnapshot(selected.publication.id, {
        snapshotWindow,
        capturedAt: new Date(capturedAt).toISOString(),
        metrics,
      });
      setMessage(`${windowLabels[snapshotWindow]}快照已保存，表现分百分位已重算。`);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存快照失败");
    } finally { setWorking(false); }
  }

  function previewCsv(text: string) {
    setCsvText(text); setError(null);
    try { setCsvRows(parseMetricCsv(text)); }
    catch (parseError) {
      setCsvRows([]);
      setError(parseError instanceof Error ? parseError.message : "CSV 解析失败");
    }
  }

  async function readCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) previewCsv(await file.text());
  }

  async function importCsv() {
    if (csvRows.length === 0) return;
    setWorking(true); setError(null); setMessage(null);
    try {
      const result = await api.importMetricSnapshots({ items: csvRows });
      setMessage(`已原子导入 ${result.imported} 条快照。`);
      setCsvText(""); setCsvRows([]); await load();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "CSV 导入失败");
    } finally { setWorking(false); }
  }

  function downloadTemplate() {
    const header = "publicationId,snapshotWindow,capturedAt,views,likes,favorites,comments,shares,follows\n";
    const id = publications[0]?.publication.id ?? "publication-uuid";
    const example = `${id},h24,${new Date().toISOString()},1000,80,45,12,6,3\n`;
    const url = URL.createObjectURL(new Blob([header + example], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "scholars-metrics-template.csv"; link.click();
    URL.revokeObjectURL(url);
  }

  async function triggerReflection() {
    setWorking(true); setError(null); setMessage(null);
    try {
      const job = await api.triggerMemoryReflect();
      setMessage(`Reflector 已入队：${job.queue} #${job.msgId}。完成后刷新查看周报。`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "触发 Reflector 失败");
    } finally { setWorking(false); }
  }

  async function updateInsight(id: string, status: "active" | "retired") {
    setWorking(true); setError(null);
    try { await api.updateInsight(id, status); await load(); }
    catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新 Insight 失败");
    } finally { setWorking(false); }
  }

  return <main className="page metrics-page">
    <div className="page-heading"><div><div className="eyebrow">M3 / FEEDBACK LOOP</div><h1>数据回流与记忆</h1><p className="lede">补录标准窗口数据，查看平台内表现分，再由 Reflector 把真实结果提炼成可执行经验。</p></div><div className="toolbar"><Select value={platform || "all"} onValueChange={(value) => setPlatform(value === "all" ? "" : value as Platform)}><SelectTrigger className="w-[150px]"><SelectValue placeholder="全部平台" /></SelectTrigger><SelectContent><SelectItem value="all">全部平台</SelectItem>{Object.entries(platformLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button onClick={() => void load()} disabled={loading}>刷新</Button><Button variant="primary" onClick={() => void triggerReflection()} disabled={working}>立即反思最近 7 天</Button></div></div>
    {message && <div className="notice success">{message}</div>}
    {error && <div className="error panel" style={{ marginBottom: 18 }}>{error}</div>}
    {loading ? <div className="empty panel">正在加载发布数据与记忆…</div> : <>
      <section className="metric-summary-grid">
        {(dashboard?.summaries ?? []).map((summary) => <article className="metric-stat panel" key={summary.platform}><span>{platformLabels[summary.platform]}</span><strong>{summary.publications}</strong><small>发布 · {summary.snapshots} 快照</small><div className="meta-row"><span>24h {summary.complete24h}</span><span>72h {summary.complete72h}</span><span>7d {summary.complete7d}</span></div><div className="meta-row"><span className="performance-high">高表现 {summary.highCount}</span><span className="performance-low">低表现 {summary.lowCount}</span></div></article>)}
        <article className="metric-stat panel"><span>待录提醒</span><strong>{due.reduce((count, item) => count + item.reminders.length, 0)}</strong><small>到期但缺少标准快照</small></article>
        <article className="metric-stat panel"><span>Active Insights</span><strong>{insights.filter((item) => item.status === "active").length}</strong><small>已注入 Scout / Writer</small></article>
      </section>
      <div className="metrics-layout">
        <section className="panel metric-section"><div className="section-heading"><div><div className="eyebrow">REMINDERS</div><h2>待录快照</h2></div><span>{due.length} 篇发布</span></div>{due.length === 0 ? <div className="empty">当前没有到期未录的数据。</div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>文章</th><th>平台</th><th>发布时间</th><th>缺失窗口</th><th></th></tr></thead><tbody>{due.map((item) => <tr key={item.publication.id}><td><strong>{item.articleTitle}</strong><div className="meta-row">{item.topicTitle}</div></td><td>{platformLabels[item.publication.platform]}</td><td>{formatDate(item.publication.publishedAt)}</td><td>{item.reminders.map((reminder) => <span className="status status-candidate" key={reminder.snapshotWindow}>{windowLabels[reminder.snapshotWindow]}</span>)}</td><td><Button variant="primary" onClick={() => choosePublication(item)}>录入</Button></td></tr>)}</tbody></table></div>}</section>
        <section className="panel metric-section"><div className="section-heading"><div><div className="eyebrow">30 SECOND ENTRY</div><h2>单篇录入</h2></div></div>{!selected ? <div className="empty">从待录列表选择，或从下方全部发布中点击“录入”。</div> : <form className="stack" onSubmit={submitMetric}><div><strong>{selected.articleTitle}</strong><div className="meta-row">{platformLabels[selected.publication.platform]} · {selected.publication.id}</div></div><div className="form-grid"><div className="field"><label>快照窗口</label><Select value={snapshotWindow} onValueChange={(value) => setSnapshotWindow(value as MetricWindow)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(windowLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="field"><label>采集时间</label><Input type="datetime-local" value={capturedAt} onChange={(event) => setCapturedAt(event.target.value)} /></div>{metricFields.map((field) => <div className="field" key={field.key}><label>{field.label}</label><Input type="number" min={0} placeholder="可留空" value={metrics[field.key] ?? ""} onChange={(event) => setMetrics((current) => ({ ...current, [field.key]: event.target.value === "" ? null : Number(event.target.value) }))} /></div>)}</div><Button variant="primary" disabled={working}>{working ? "保存中…" : "保存并重算表现分"}</Button></form>}</section>
      </div>
      <section className="panel metric-section"><div className="section-heading"><div><div className="eyebrow">CSV IMPORT</div><h2>批量导入</h2></div><div className="toolbar"><Button onClick={downloadTemplate}>下载模板</Button><Button asChild><label>选择 CSV<input hidden type="file" accept=".csv,text/csv" onChange={(event) => void readCsvFile(event)} /></label></Button></div></div><Textarea className="csv-editor" value={csvText} onChange={(event) => previewCsv(event.target.value)} placeholder="粘贴 CSV，或选择文件。整批通过 Core 事务写入，任一行失败则全部回滚。" /><div className="card-actions"><span className="meta-row">预检查通过：{csvRows.length} 行</span><Button variant="primary" disabled={working || csvRows.length === 0} onClick={() => void importCsv()}>导入全部</Button></div></section>
      <section className="panel metric-section"><div className="section-heading"><div><div className="eyebrow">PERFORMANCE P</div><h2>近期高低表现 Case</h2></div><span>同平台 · 同窗口 · 近 {dashboard?.days ?? 90} 天</span></div>{(dashboard?.cases.length ?? 0) === 0 ? <div className="empty">至少录入同平台同窗口样本后，这里会显示 P75 / P25 case。</div> : <div className="case-grid">{dashboard?.cases.map((item) => <article className={`case-card ${item.band}`} key={`${item.publicationId}-${item.snapshotWindow}`}><div><span className={`performance-${item.band}`}>{item.band === "high" ? "HIGH" : "LOW"} · P{item.percentile.toFixed(0)}</span><h3>{item.title}</h3></div><div className="meta-row"><span>{platformLabels[item.platform]}</span><span>{windowLabels[item.snapshotWindow]}</span><span>raw {item.performanceRaw.toFixed(1)}</span><span>{formatDate(item.capturedAt)}</span></div></article>)}</div>}</section>
      <div className="metrics-layout reports-layout"><section className="panel metric-section"><div className="section-heading"><div><div className="eyebrow">WEEKLY REPORT</div><h2>归因与校准报告</h2></div></div>{reports.length === 0 ? <div className="empty">尚无周报。录入数据后可手动运行 Reflector。</div> : reports.map((report) => <article className="report-card" key={report.id}><div className="meta-row"><span>{formatDate(report.periodStart)} – {formatDate(report.periodEnd)}</span><span>{report.sampleCount} 样本</span><span>{report.calibration.coldStart ? "冷启动" : "可校准"}</span></div><pre>{report.summaryMarkdown}</pre><details><summary>查看确定性相关性</summary><div className="correlation-list">{report.calibration.correlations.map((correlation) => <div key={correlation.key}><code>{correlation.key}</code><span>n={correlation.sampleSize}</span><strong>{correlation.coefficient === null ? "不足" : correlation.coefficient.toFixed(3)}</strong></div>)}</div></details></article>)}</section><section className="panel metric-section"><div className="section-heading"><div><div className="eyebrow">AGENT MEMORY</div><h2>Insights</h2></div><span>{insights.length} 条</span></div>{insights.length === 0 ? <div className="empty">Reflector 尚未提炼经验。</div> : <div className="insight-list">{insights.map((insight) => <article className="insight-card" key={insight.id}><div className="meta-row"><span className={`status insight-${insight.status}`}>{insight.status}</span><span>{insight.kind}</span><span>{insight.platform ? platformLabels[insight.platform] : "跨平台"}</span><span>confidence {insight.confidence.toFixed(2)}</span></div><p>{insight.content}</p><small>{insight.evidence.length} 组证据</small><div className="card-actions">{insight.status === "retired" ? <Button disabled={working} onClick={() => void updateInsight(insight.id, "active")}>人工启用</Button> : <Button variant="danger" disabled={working} onClick={() => void updateInsight(insight.id, "retired")}>人工退役</Button>}</div></article>)}</div>}</section></div>
      <section className="panel metric-section"><div className="section-heading"><div><div className="eyebrow">ALL PUBLICATIONS</div><h2>全部发布与快照</h2></div></div>{publications.length === 0 ? <div className="empty">还没有登记真实 Publication。先在文章审阅页终审并登记发布。</div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>文章</th><th>平台</th><th>快照</th><th>最新表现</th><th></th></tr></thead><tbody>{publications.map((item) => { const latest = item.snapshots.at(-1); return <tr key={item.publication.id}><td><strong>{item.articleTitle}</strong><div className="meta-row">{item.topicTitle}</div></td><td>{platformLabels[item.publication.platform]}</td><td>{item.snapshots.map((snapshot) => <span className="status status-approved" key={snapshot.id}>{windowLabels[snapshot.snapshotWindow]}</span>)}</td><td>{latest?.performancePercentile == null ? "—" : `P${latest.performancePercentile.toFixed(0)}`}</td><td><Button onClick={() => choosePublication(item, "custom")}>录入</Button></td></tr>; })}</tbody></table></div>}</section>
    </>}
  </main>;
}
