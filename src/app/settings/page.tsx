"use client";

import { FormEvent, useEffect, useState } from "react";
import type { components } from "../../../gen/core-api";
import { api } from "../../lib/api";

type Settings = components["schemas"]["SchedulerSettings"];

const defaultSettings: Settings = {
  sourceFetch: { enabled: true, defaultIntervalMinutes: 60 },
  topicScout: { enabled: true, times: ["08:00", "20:00"], timezone: "Asia/Shanghai", minNewItems: 5 },
  topicEvaluate: { enabled: true, maxConcurrency: 2 },
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
    <div className="page-heading"><div><div className="eyebrow">M1 / OPERATIONS</div><h1>调度设置</h1><p className="lede">业务频率存于数据库；环境变量只负责首次 seed，重启不会覆盖这里的修改。</p></div><button className="button" onClick={() => window.location.reload()}>重新读取</button></div>
    {loading ? <div className="empty panel">正在读取调度配置…</div> : <form onSubmit={save}>
      {message && <div className="notice">{message}</div>}
      {error && <div className="error panel" style={{ marginBottom: 18 }}>{error}</div>}
      <div className="settings-grid">
        <section className="settings-card panel"><h2>Source Fetch</h2><div className="stack"><label className="checkbox"><input type="checkbox" checked={settings.sourceFetch.enabled} onChange={(e) => update("sourceFetch", { ...settings.sourceFetch, enabled: e.target.checked })} />启用自动采集</label><div className="field"><label htmlFor="interval">全局间隔（分钟）</label><input className="input" id="interval" type="number" min={5} max={10080} value={settings.sourceFetch.defaultIntervalMinutes} onChange={(e) => update("sourceFetch", { ...settings.sourceFetch, defaultIntervalMinutes: Number(e.target.value) })} /></div><p className="meta-row">单个信源可以在信源管理中覆盖此默认值。</p></div></section>
        <section className="settings-card panel"><h2>TopicScout</h2><div className="stack"><label className="checkbox"><input type="checkbox" checked={settings.topicScout.enabled} onChange={(e) => update("topicScout", { ...settings.topicScout, enabled: e.target.checked })} />启用自动聚合</label><div className="field"><label htmlFor="times">每日执行时刻（每行一个 HH:MM）</label><textarea className="textarea" id="times" value={settings.topicScout.times.join("\n")} onChange={(e) => update("topicScout", { ...settings.topicScout, times: e.target.value.split(/\s+/).filter(Boolean) })} /></div><div className="field"><label htmlFor="timezone">时区</label><input className="input" id="timezone" value={settings.topicScout.timezone} onChange={(e) => update("topicScout", { ...settings.topicScout, timezone: e.target.value })} /></div><div className="field"><label htmlFor="min-items">最低新素材数</label><input className="input" id="min-items" type="number" min={0} max={1000} value={settings.topicScout.minNewItems} onChange={(e) => update("topicScout", { ...settings.topicScout, minNewItems: Number(e.target.value) })} /></div></div></section>
        <section className="settings-card panel"><h2>TopicJudge</h2><div className="stack"><label className="checkbox"><input type="checkbox" checked={settings.topicEvaluate.enabled} onChange={(e) => update("topicEvaluate", { ...settings.topicEvaluate, enabled: e.target.checked })} />启用评分任务</label><div className="field"><label htmlFor="concurrency">最大并发（1–32）</label><input className="input" id="concurrency" type="number" min={1} max={32} value={settings.topicEvaluate.maxConcurrency} onChange={(e) => update("topicEvaluate", { ...settings.topicEvaluate, maxConcurrency: Number(e.target.value) })} /></div><p className="meta-row">评分采用 candidate 产生后的事件驱动，不等待固定时刻。</p><button type="button" className="button" onClick={() => void runScout()} disabled={running}>{running ? "投递中…" : "立即运行 TopicScout"}</button></div></section>
      </div>
      <div className="card-actions" style={{ marginTop: 20 }}><button className="button primary" disabled={saving}>{saving ? "保存中…" : "保存调度设置"}</button></div>
    </form>}
  </main>;
}
