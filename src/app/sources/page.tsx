"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { components } from "@scholars-ai/contracts/core-api";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

type Source = components["schemas"]["SourceWithHealth"];
type SourceType = components["schemas"]["SourceType"];
type SourceCategory = components["schemas"]["SourceCategory"];

const categories: SourceCategory[] = ["news", "research", "tutorial", "kol"];

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", url: "", type: "rss" as SourceType, category: "news" as SourceCategory });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setSources(await api.listSources()); }
    catch (err) { setError(err instanceof Error ? err.message : "加载信源失败"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function toggle(source: Source) {
    setBusy(source.id); setError(null);
    try {
      const updated = await api.updateSource(source.id, { enabled: !source.enabled });
      setSources((current) => current.map((item) => item.id === source.id ? updated : item));
    } catch (err) { setError(err instanceof Error ? err.message : "更新信源失败"); }
    finally { setBusy(null); }
  }

  async function fetchSource(source: Source) {
    setBusy(source.id); setError(null);
    try { await api.triggerSourceFetch(source.id); }
    catch (err) { setError(err instanceof Error ? err.message : "投递采集任务失败"); }
    finally { setBusy(null); }
  }

  async function updateInterval(source: Source, value: string) {
    setBusy(source.id); setError(null);
    try {
      const intervalMinutes = value.trim() ? Number(value) : null;
      const updated = await api.updateSource(source.id, {
        fetchConfig: { ...source.fetchConfig, intervalMinutes },
      });
      setSources((current) => current.map((item) => item.id === source.id ? updated : item));
    } catch (err) { setError(err instanceof Error ? err.message : "更新采集频率失败"); }
    finally { setBusy(null); }
  }

  async function remove(source: Source) {
    if (!window.confirm(`确认删除信源“${source.name}”？已采集素材会保留。`)) return;
    setBusy(source.id); setError(null);
    try {
      await api.deleteSource(source.id);
      setSources((current) => current.filter((item) => item.id !== source.id));
    } catch (err) { setError(err instanceof Error ? err.message : "删除信源失败"); }
    finally { setBusy(null); }
  }

  async function ingest(event: FormEvent) {
    event.preventDefault(); if (!url.trim()) return;
    setIngesting(true); setError(null);
    try { await api.ingestUrl(url.trim(), note.trim() || undefined); setUrl(""); setNote(""); }
    catch (err) { setError(err instanceof Error ? err.message : "手动投喂失败"); }
    finally { setIngesting(false); }
  }

  async function create(event: FormEvent) {
    event.preventDefault(); if (!newSource.name.trim()) return;
    setBusy("create"); setError(null);
    try {
      await api.createSource({ name: newSource.name.trim(), url: newSource.url.trim() || null, type: newSource.type, category: newSource.category, weight: 0.5, enabled: true });
      await load();
      setNewSource({ name: "", url: "", type: "rss", category: "news" });
    } catch (err) { setError(err instanceof Error ? err.message : "新增信源失败"); }
    finally { setBusy(null); }
  }

  return <main className="page">
    <div className="page-heading"><div><div className="eyebrow">M1 / SOURCING</div><h1>信源管理</h1><p className="lede">控制采集开关、单源频率和即时投喂；采集失败会保留在健康状态中。</p></div><Button onClick={() => void load()} disabled={loading}>刷新数据</Button></div>
    {error && <div className="error panel">{error}</div>}
    <div className="detail-grid">
      <form className="panel settings-card" onSubmit={ingest}>
        <div className="eyebrow">QUICK INGEST</div><h2>手动投喂 URL</h2>
        <div className="stack"><div className="field"><label htmlFor="ingest-url">URL</label><Input id="ingest-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required /></div><div className="field"><label htmlFor="ingest-note">备注（可选）</label><Textarea id="ingest-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="为什么觉得值得写？" /></div><Button variant="primary" disabled={ingesting}>{ingesting ? "投递中…" : "投递采集任务"}</Button></div>
      </form>
      <form className="panel settings-card" onSubmit={create}>
        <div className="eyebrow">SUBSCRIBE</div><h2>新增信源</h2>
        <div className="stack"><div className="field"><label htmlFor="source-name">名称</label><Input id="source-name" value={newSource.name} onChange={(e) => setNewSource({ ...newSource, name: e.target.value })} required /></div><div className="field"><label htmlFor="source-url">URL</label><Input id="source-url" type="url" value={newSource.url} onChange={(e) => setNewSource({ ...newSource, url: e.target.value })} /></div><div className="form-grid"><div className="field"><label htmlFor="source-type">类型</label><Select value={newSource.type} onValueChange={(value) => setNewSource({ ...newSource, type: value as SourceType })}><SelectTrigger id="source-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rss">RSS</SelectItem><SelectItem value="rsshub">RSSHub</SelectItem><SelectItem value="manual">手动</SelectItem><SelectItem value="crawler">Crawler</SelectItem></SelectContent></Select></div><div className="field"><label htmlFor="source-category">类别</label><Select value={newSource.category} onValueChange={(value) => setNewSource({ ...newSource, category: value as SourceCategory })}><SelectTrigger id="source-category"><SelectValue /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></div><Button disabled={busy === "create"}>{busy === "create" ? "保存中…" : "添加信源"}</Button></div>
      </form>
    </div>
    <div className="panel table-wrap" style={{ marginTop: 16 }}>
      {loading ? <div className="empty">正在加载信源…</div> : sources.length === 0 ? <div className="empty">暂无信源。</div> : <table className="data-table"><thead><tr><th>信源</th><th>类别</th><th>状态</th><th>频率覆盖</th><th>最近运行</th><th>健康</th><th>操作</th></tr></thead><tbody>{sources.map((source) => <tr key={source.id}><td><strong>{source.name}</strong><div className="meta-row">{source.url || "无 URL"}</div></td><td>{source.category}</td><td><span className={source.enabled ? "status status-approved" : "status status-rejected"}>{source.enabled ? "运行中" : "已暂停"}</span></td><td><div style={{ alignItems: "center", display: "flex", gap: 6 }}><Input className="max-w-[100px]" type="number" min={5} max={10080} placeholder="全局" defaultValue={source.fetchConfig.intervalMinutes ?? ""} onBlur={(event) => { const value = event.target.value; const old = source.fetchConfig.intervalMinutes == null ? "" : String(source.fetchConfig.intervalMinutes); if (value !== old) void updateInterval(source, value); }} /><span>分钟</span></div></td><td>{date(source.health.lastRunAt)}</td><td>{source.health.consecutiveFailures > 0 ? <span className="status status-rejected">失败 {source.health.consecutiveFailures} 次</span> : <span className="status status-approved">正常</span>}</td><td><div className="card-actions"><Button size="sm" disabled={busy === source.id} onClick={() => void toggle(source)}>{source.enabled ? "暂停" : "启用"}</Button><Button size="sm" disabled={busy === source.id || !source.enabled} onClick={() => void fetchSource(source)}>立即采集</Button><Button size="sm" variant="danger" disabled={busy === source.id} onClick={() => void remove(source)}>删除</Button></div></td></tr>)}</tbody></table>}
    </div>
  </main>;
}
