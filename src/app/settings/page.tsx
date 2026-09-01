"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, type SchedulerSettings as Settings } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";

const defaultSettings: Settings = {
  contentWorkflow: { enabled: true, intervalHours: 12 },
  sourceFetch: { enabled: true, defaultIntervalMinutes: 120 },
  topicScout: { enabled: true, times: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"], timezone: "Asia/Shanghai", minNewItems: 5 },
  topicEvaluate: { enabled: true, maxConcurrency: 2 },
  articleWrite: { enabled: true, times: ["00:00", "08:00", "16:00"], timezone: "Asia/Shanghai", maxTopics: 3 },
  memoryReflect: { enabled: true, weekday: 1, time: "09:00", timezone: "Asia/Shanghai", lookbackDays: 7 },
  workflowSnapshots: { enabled: true, retentionHours: 168, batchSize: 100 },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.getSchedulerSettings().then(setSettings).catch((err) => setError(err instanceof Error ? err.message : "加载调度设置失败")).finally(() => setLoading(false));
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null);
    try { setSettings(await api.updateSchedulerSettings(settings)); setMessage("设置已保存，scheduler 最迟在下一个 tick 生效。"); }
    catch (err) { setError(err instanceof Error ? err.message : "保存失败，请检查时间、间隔和并发范围"); }
    finally { setSaving(false); }
  }

  async function runScout() {
    setRunning(true); setError(null); setMessage(null);
    try { const job = await api.triggerTopicScout(); setMessage(`TopicScout 已入队：${job.queue} #${job.msgId}`); }
    catch (err) { setError(err instanceof Error ? err.message : "立即运行 TopicScout 失败"); }
    finally { setRunning(false); }
  }

  return <main className="page">
    <div className="page-heading"><div><div className="eyebrow">M1 / OPERATIONS</div><h1>调度设置</h1><p className="lede">业务频率存于数据库；环境变量只负责首次 seed，重启不会覆盖这里的修改。</p></div><Button onClick={() => window.location.reload()}>重新读取</Button></div>
    {loading ? <div className="empty panel">正在读取调度配置…</div> : <form onSubmit={save}>
      {message && <div className="notice">{message}</div>}
      {error && <div className="error panel" style={{ marginBottom: 18 }}>{error}</div>}
      <div className="settings-grid">
        <section className="settings-card panel"><h2>Content Workflow</h2><div className="stack"><label className="checkbox"><Checkbox checked={settings.contentWorkflow.enabled} onCheckedChange={(checked) => update("contentWorkflow", { ...settings.contentWorkflow, enabled: checked === true })} />启用自动内容生产</label><div className="field"><label htmlFor="workflow-interval">运行间隔（小时）</label><Input id="workflow-interval" type="number" min={1} max={168} value={settings.contentWorkflow.intervalHours} onChange={(e) => update("contentWorkflow", { ...settings.contentWorkflow, intervalHours: Number(e.target.value) })} /></div><p className="meta-row">每次运行执行完整六阶段工作流；手动运行不受此开关影响。</p></div></section>
        <section className="settings-card panel"><h2>Workflow Snapshots</h2><div className="stack"><label className="checkbox"><Checkbox checked={settings.workflowSnapshots.enabled} onCheckedChange={(checked) => update("workflowSnapshots", { ...settings.workflowSnapshots, enabled: checked === true })} />启用到期归档</label><div className="field"><label htmlFor="snapshot-retention">保留时长（小时）</label><Input id="snapshot-retention" type="number" min={1} max={8760} value={settings.workflowSnapshots.retentionHours} onChange={(e) => update("workflowSnapshots", { ...settings.workflowSnapshots, retentionHours: Number(e.target.value) })} /></div><div className="field"><label htmlFor="snapshot-batch">每轮归档上限</label><Input id="snapshot-batch" type="number" min={1} max={1000} value={settings.workflowSnapshots.batchSize} onChange={(e) => update("workflowSnapshots", { ...settings.workflowSnapshots, batchSize: Number(e.target.value) })} /></div><p className="meta-row">归档保留 payload、checksum 和血缘，可通过快照 API 恢复。</p></div></section>
        <section className="settings-card panel"><h2>Source Fetch</h2><div className="stack"><label className="checkbox"><Checkbox checked={settings.sourceFetch.enabled} onCheckedChange={(checked) => update("sourceFetch", { ...settings.sourceFetch, enabled: checked === true })} />启用自动采集</label><div className="field"><label htmlFor="interval">全局间隔（分钟）</label><Input id="interval" type="number" min={5} max={10080} value={settings.sourceFetch.defaultIntervalMinutes} onChange={(e) => update("sourceFetch", { ...settings.sourceFetch, defaultIntervalMinutes: Number(e.target.value) })} /></div><p className="meta-row">单个信源可以在信源管理中覆盖此默认值。</p></div></section>
        <section className="settings-card panel"><h2>TopicScout</h2><div className="stack"><label className="checkbox"><Checkbox checked={settings.topicScout.enabled} onCheckedChange={(checked) => update("topicScout", { ...settings.topicScout, enabled: checked === true })} />启用自动聚合</label><div className="field"><label htmlFor="times">每日执行时刻（每行一个 HH:MM）</label><Textarea id="times" value={settings.topicScout.times.join("\n")} onChange={(e) => update("topicScout", { ...settings.topicScout, times: e.target.value.split(/\s+/).filter(Boolean) })} /></div><div className="field"><label htmlFor="timezone">时区</label><Input id="timezone" value={settings.topicScout.timezone} onChange={(e) => update("topicScout", { ...settings.topicScout, timezone: e.target.value })} /></div><div className="field"><label htmlFor="min-items">最低新素材数</label><Input id="min-items" type="number" min={0} max={1000} value={settings.topicScout.minNewItems} onChange={(e) => update("topicScout", { ...settings.topicScout, minNewItems: Number(e.target.value) })} /></div></div></section>
        <section className="settings-card panel"><h2>TopicJudge</h2><div className="stack"><label className="checkbox"><Checkbox checked={settings.topicEvaluate.enabled} onCheckedChange={(checked) => update("topicEvaluate", { ...settings.topicEvaluate, enabled: checked === true })} />启用评分任务</label><div className="field"><label htmlFor="concurrency">最大并发（1–32）</label><Input id="concurrency" type="number" min={1} max={32} value={settings.topicEvaluate.maxConcurrency} onChange={(e) => update("topicEvaluate", { ...settings.topicEvaluate, maxConcurrency: Number(e.target.value) })} /></div><p className="meta-row">评分采用 candidate 产生后的事件驱动，不等待固定时刻。</p><Button type="button" onClick={() => void runScout()} disabled={running}>{running ? "投递中…" : "立即运行 TopicScout"}</Button></div></section>
        <section className="settings-card panel"><h2>Article Writer</h2><div className="stack"><label className="checkbox"><Checkbox checked={settings.articleWrite.enabled} onCheckedChange={(checked) => update("articleWrite", { ...settings.articleWrite, enabled: checked === true })} />启用自动写作</label><div className="field"><label htmlFor="article-times">每日执行时刻（每行一个 HH:MM）</label><Textarea id="article-times" value={settings.articleWrite.times.join("\n")} onChange={(e) => update("articleWrite", { ...settings.articleWrite, times: e.target.value.split(/\s+/).filter(Boolean) })} /></div><div className="field"><label htmlFor="article-timezone">时区</label><Input id="article-timezone" value={settings.articleWrite.timezone} onChange={(e) => update("articleWrite", { ...settings.articleWrite, timezone: e.target.value })} /></div><div className="field"><label htmlFor="article-max-topics">每批最高分 Topic 数</label><Input id="article-max-topics" type="number" min={1} max={20} value={settings.articleWrite.maxTopics} onChange={(e) => update("articleWrite", { ...settings.articleWrite, maxTopics: Number(e.target.value) })} /></div><p className="meta-row">到点自动选择最高分 scored Topic，无需人工批准选题。</p></div></section>
        <section className="settings-card panel"><h2>Memory Reflector</h2><div className="stack"><label className="checkbox"><Checkbox checked={settings.memoryReflect.enabled} onCheckedChange={(checked) => update("memoryReflect", { ...settings.memoryReflect, enabled: checked === true })} />启用每周反思</label><div className="field"><label htmlFor="reflect-weekday">星期（1=周一，7=周日）</label><Input id="reflect-weekday" type="number" min={1} max={7} value={settings.memoryReflect.weekday} onChange={(e) => update("memoryReflect", { ...settings.memoryReflect, weekday: Number(e.target.value) })} /></div><div className="field"><label htmlFor="reflect-time">执行时刻</label><Input id="reflect-time" type="time" value={settings.memoryReflect.time} onChange={(e) => update("memoryReflect", { ...settings.memoryReflect, time: e.target.value })} /></div><div className="field"><label htmlFor="reflect-timezone">时区</label><Input id="reflect-timezone" value={settings.memoryReflect.timezone} onChange={(e) => update("memoryReflect", { ...settings.memoryReflect, timezone: e.target.value })} /></div><div className="field"><label htmlFor="reflect-lookback">回看天数</label><Input id="reflect-lookback" type="number" min={1} max={90} value={settings.memoryReflect.lookbackDays} onChange={(e) => update("memoryReflect", { ...settings.memoryReflect, lookbackDays: Number(e.target.value) })} /></div></div></section>
      </div>
      <div className="card-actions" style={{ marginTop: 20 }}><Button variant="primary" disabled={saving}>{saving ? "保存中…" : "保存调度设置"}</Button></div>
    </form>}
  </main>;
}
