"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Activity, ArrowLeft, Bot, Check, CircleAlert, Clock3, LoaderCircle, Play, Radio, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api, type ReplayMode, type WorkflowArtifact, type WorkflowConfigOverrides, type WorkflowEvent, type WorkflowItemDecision, type WorkflowNodeRun, type WorkflowRun, type WorkflowRunComparison, type WorkflowSnapshot } from "@/lib/api";

type NodeState = "idle" | "queued" | "running" | "succeeded" | "partial_failed" | "failed" | "skipped" | "cancelled";
type WorkflowNodeData = {
  label: string;
  description: string;
  nodeKey: string;
  state: NodeState;
  event?: WorkflowEvent;
  artifacts: WorkflowArtifact[];
};

type WorkflowCanvasProps = {
  initialRunId?: string;
  detailOnly?: boolean;
};

const NODE_ORDER = [
  { key: "trigger", label: "手动触发", description: "创建一次级联运行" },
  { key: "source_fetch", label: "资讯采集", description: "抓取启用信源并去重" },
  { key: "topic_scout", label: "Topic 生成", description: "聚类素材并提出选题" },
  { key: "topic_evaluate", label: "Topic 评分", description: "按质量 rubric 评审" },
  { key: "article_write", label: "平台写作", description: "生成各平台文章" },
  { key: "article_evaluate", label: "文章评分", description: "检查结构与发布质量" },
  { key: "human_review", label: "待人工审阅", description: "输出可发布文章" },
] as const;

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  trigger: { x: 20, y: 215 },
  source_fetch: { x: 300, y: 215 },
  topic_scout: { x: 580, y: 215 },
  topic_evaluate: { x: 860, y: 215 },
  article_write: { x: 1140, y: 215 },
  article_evaluate: { x: 1420, y: 215 },
  human_review: { x: 1700, y: 215 },
};

const nodeTypes = { workflow: WorkflowNode };

function WorkflowNode({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  const stateLabel: Record<NodeState, string> = {
    idle: "待执行",
    queued: "排队中",
    running: "执行中",
    succeeded: "已完成",
    partial_failed: "部分失败",
    failed: "失败",
    skipped: "已跳过",
    cancelled: "已取消",
  };
  return (
    <div className={`workflow-node state-${data.state}${selected ? " is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="workflow-node-top">
        <span className="workflow-node-icon">
          {data.state === "running" ? <LoaderCircle size={15} className="spin" /> : <Bot size={15} />}
        </span>
        <span className="workflow-node-state">{stateLabel[data.state]}</span>
      </div>
      <strong>{data.label}</strong>
      <span className="workflow-node-description">{data.description}</span>
      <div className="workflow-node-meta">
        <span>{data.event?.payload?.model ? String(data.event.payload.model) : data.nodeKey}</span>
        {data.artifacts.length > 0 && <span>{data.artifacts.length} 个产物</span>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function nodeState(events: WorkflowEvent[], nodeKey: string): NodeState {
  const event = [...events].reverse().find((item) => item.nodeKey === nodeKey);
  return (event?.status as NodeState | undefined) ?? "idle";
}

function latestEvent(events: WorkflowEvent[], nodeKey: string) {
  return [...events].reverse().find((item) => item.nodeKey === nodeKey);
}

function formatTime(value?: string | null) {
  if (!value) return "未开始";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

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

function metricNumber(value: Record<string, unknown> | undefined, key: string) {
  const result = value?.[key];
  return typeof result === "number" && Number.isFinite(result) ? result : undefined;
}

function metricText(value: Record<string, unknown> | undefined, key: string, suffix = "") {
  const result = metricNumber(value, key);
  return result === undefined ? "-" : `${result}${suffix}`;
}

function metricRate(value: Record<string, unknown> | undefined) {
  const result = metricNumber(value, "passRate");
  return result === undefined ? "-" : `${Math.round(result * 100)}%`;
}

function comparisonReasonEntries(reasonCounts: Record<string, unknown> | undefined) {
  if (!reasonCounts) return [] as Array<[string, number]>;
  return Object.entries(reasonCounts)
    .map(([key, value]) => [key, typeof value === "number" ? value : Number(value)] as [string, number])
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b[1] - a[1]);
}

function triggerLabel(run: WorkflowRun) {
  if (run.triggerType === "scheduled") return "自动";
  if (run.triggerType === "replay") return "回放";
  return "手动";
}

function artifactHref(artifact: WorkflowArtifact) {
  if (artifact.artifactType === "article") return `/articles/${artifact.artifactId}`;
  if (artifact.artifactType === "topic") return `/topics/${artifact.artifactId}`;
  return "/sources";
}

function NodeExecutionModal({
  node,
  events,
  nodeRun,
  decisions,
  artifacts,
  inputSnapshot,
  outputSnapshot,
  loading,
  snapshotError,
  replayMode,
  selectedItemIds,
  overrideModel,
  overrideThreshold,
  onReplayModeChange,
  onToggleItem,
  onOverrideModelChange,
  onOverrideThresholdChange,
  onReplay,
  onClose,
}: {
  node: (typeof NODE_ORDER)[number];
  events: WorkflowEvent[];
  nodeRun?: WorkflowNodeRun;
  decisions: WorkflowItemDecision[];
  artifacts: WorkflowArtifact[];
  inputSnapshot?: WorkflowSnapshot;
  outputSnapshot?: WorkflowSnapshot;
  loading: boolean;
  snapshotError?: string;
  replayMode: ReplayMode;
  selectedItemIds: string[];
  overrideModel: string;
  overrideThreshold: string;
  onReplayModeChange: (mode: ReplayMode) => void;
  onToggleItem: (itemId: string) => void;
  onOverrideModelChange: (value: string) => void;
  onOverrideThresholdChange: (value: string) => void;
  onReplay: () => void;
  onClose: () => void;
}) {
  const event = events.at(-1);

  useEffect(() => {
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="workflow-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title">
        <div className="workflow-modal-header">
          <div><span className="section-kicker">NODE EXECUTION</span><h2 id="workflow-modal-title">{node.label}</h2><p>{node.description}</p></div>
          <button className="workflow-modal-close" onClick={onClose} aria-label="关闭节点执行记录"><X size={18} /></button>
        </div>
        <div className="workflow-modal-summary">
          <span className={`status status-${event?.status ?? "idle"}`}>{event?.status ?? "idle"}</span>
          <span>{event?.message ?? "尚未执行"}</span>
          <time>{formatTime(event?.occurredAt)}</time>
        </div>
        <div className="workflow-modal-grid">
          <div><span className="workflow-modal-label">节点运行</span><code>{nodeRun?.id ?? "-"}</code></div>
          <div><span className="workflow-modal-label">开始 / 完成</span><span>{formatTime(nodeRun?.startedAt)} / {formatTime(nodeRun?.completedAt)}</span></div>
          <div><span className="workflow-modal-label">输入快照</span><code>{nodeRun?.inputSnapshotId ?? "-"}</code></div>
          <div><span className="workflow-modal-label">输出快照</span><code>{nodeRun?.outputSnapshotId ?? "-"}</code></div>
          <div><span className="workflow-modal-label">漏斗统计</span><span>{nodeRun?.counts ? Object.entries(nodeRun.counts).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "-"}</span></div>
        </div>
        {node.key !== "trigger" && <div className="workflow-modal-replay">
          <div className="workflow-modal-section-heading"><span>从此节点重新运行</span><strong>沿用本次输入快照</strong></div>
          <div className="workflow-control-row">
            <label>重跑范围<select value={replayMode} onChange={(event) => onReplayModeChange(event.target.value as ReplayMode)}>
              <option value="full">当前节点及后续</option>
              <option value="failed_items">仅失败项</option>
              <option value="selected_items">选择条目</option>
              <option value="evaluate_only">只重新评估</option>
            </select></label>
            <label>模型覆盖<input value={overrideModel} onChange={(event) => onOverrideModelChange(event.target.value)} placeholder="沿用默认模型" /></label>
            <label>通过阈值<input type="number" min="0" max="100" value={overrideThreshold} onChange={(event) => onOverrideThresholdChange(event.target.value)} placeholder="沿用默认阈值" /></label>
            <button className="button button-primary workflow-modal-replay-button" onClick={onReplay}><RefreshCw size={14} />执行 replay</button>
          </div>
        </div>}
        {snapshotError ? <div className="workflow-modal-error"><CircleAlert size={15} />{snapshotError}</div> : loading ? <div className="workflow-modal-loading"><LoaderCircle size={18} className="spin" />正在读取快照...</div> : <div className="workflow-modal-columns">
          <div><div className="workflow-modal-label">输入</div>{inputSnapshot ? <pre>{JSON.stringify(inputSnapshot.payload, null, 2)}</pre> : <span className="muted">无输入快照</span>}</div>
          <div><div className="workflow-modal-label">输出</div>{outputSnapshot ? <pre>{JSON.stringify(outputSnapshot.payload, null, 2)}</pre> : <span className="muted">无输出快照</span>}</div>
        </div>}
        <div className="workflow-modal-section"><div className="workflow-modal-section-heading"><span>节点配置</span><strong>执行时固化</strong></div>{nodeRun && Object.keys(nodeRun.configSnapshot).length > 0 ? <pre className="workflow-modal-config">{JSON.stringify(nodeRun.configSnapshot, null, 2)}</pre> : <span className="muted">暂无节点配置快照</span>}</div>
        <div className="workflow-modal-section"><div className="workflow-modal-section-heading"><span>事件记录</span><strong>{events.length}</strong></div>{events.length === 0 ? <span className="muted">暂无事件</span> : <div className="workflow-modal-event-list">{[...events].reverse().map((item) => <details key={item.id}><summary><span className={`timeline-marker timeline-${item.status}`}>{item.status === "succeeded" ? <Check size={13} /> : item.status === "failed" ? <CircleAlert size={13} /> : item.status === "running" ? <LoaderCircle size={13} className="spin" /> : <Clock3 size={13} />}</span><span><strong>{item.message}</strong><small>{item.eventType} · {formatTime(item.occurredAt)}</small></span></summary><pre>{JSON.stringify(item.payload, null, 2)}</pre></details>)}</div>}</div>
        <div className="workflow-modal-section"><div className="workflow-modal-section-heading"><span>逐条决策</span><strong>{decisions.length}</strong></div>{decisions.length === 0 ? <span className="muted">暂无逐条决策</span> : <div className="workflow-modal-decision-list">{decisions.map((decision) => <label key={decision.id}><input type="checkbox" checked={selectedItemIds.includes(decision.itemId)} onChange={() => onToggleItem(decision.itemId)} /><span><strong>{decision.decision} · {decision.reasonCode}</strong><small>{decision.reason}</small></span><b>{decision.totalScore ?? "-"}</b></label>)}</div>}</div>
        <div className="workflow-modal-section"><div className="workflow-modal-section-heading"><span>节点产物</span><strong>{artifacts.length}</strong></div>{artifacts.length === 0 ? <span className="muted">暂无产物</span> : <div className="workflow-modal-artifacts">{artifacts.map((artifact) => <Link key={artifact.id} href={artifactHref(artifact)} onClick={onClose}>{artifact.title || artifact.artifactType} ↗</Link>)}</div>}</div>
      </section>
    </div>
  );
}

export default function WorkflowCanvas({ initialRunId, detailOnly = false }: WorkflowCanvasProps) {
  const router = useRouter();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [artifacts, setArtifacts] = useState<WorkflowArtifact[]>([]);
  const [nodeRuns, setNodeRuns] = useState<WorkflowNodeRun[]>([]);
  const [decisions, setDecisions] = useState<WorkflowItemDecision[]>([]);
  const [selectedNode, setSelectedNode] = useState("source_fetch");
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string>();
  const [connection, setConnection] = useState<"live" | "reconnecting" | "offline">("offline");
  const [replayMode, setReplayMode] = useState<ReplayMode>("full");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [overrideModel, setOverrideModel] = useState("");
  const [overrideThreshold, setOverrideThreshold] = useState("");
  const [comparison, setComparison] = useState<WorkflowRunComparison>();
  const [comparisonRunId, setComparisonRunId] = useState("");
  const [comparing, setComparing] = useState(false);
  const [inputSnapshot, setInputSnapshot] = useState<WorkflowSnapshot>();
  const [outputSnapshot, setOutputSnapshot] = useState<WorkflowSnapshot>();
  const [configSnapshot, setConfigSnapshot] = useState<WorkflowSnapshot>();
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string>();
  const [nodeModalOpen, setNodeModalOpen] = useState(false);

  const loadRuns = useCallback(async () => {
    const result = await api.listWorkflowRuns();
    setRuns(result.items);
    setSelectedRunId((current) => current ?? initialRunId ?? result.items[0]?.id);
  }, [initialRunId]);

  const loadRun = useCallback(async (id: string) => {
    const result = await api.getWorkflowRun(id);
    setRuns((current) => [result, ...current.filter((item) => item.id !== result.id)]);
    setEvents(result.events);
    setArtifacts(result.artifacts);
    setNodeRuns(result.nodeRuns);
    setDecisions(result.decisions);
  }, []);

  useEffect(() => {
    loadRuns().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "无法读取运行记录")).finally(() => setLoading(false));
  }, [loadRuns]);

  useEffect(() => {
    if (!selectedRunId) return;
    setError(undefined);
    setEvents([]);
    setArtifacts([]);
    setNodeRuns([]);
    setDecisions([]);
    setNodeModalOpen(false);
    loadRun(selectedRunId).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "无法读取运行详情"));
    const source = new EventSource(api.workflowStreamUrl(selectedRunId));
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("reconnecting");
    const onEvent = (message: MessageEvent<string>) => {
      try {
        const next = JSON.parse(message.data) as WorkflowEvent;
        setEvents((current) => current.some((item) => item.sequence === next.sequence) ? current : [...current, next]);
        setConnection("live");
        if (next.eventType === "succeeded") {
          loadRun(selectedRunId).catch(() => undefined);
        }
      } catch {
        setConnection("reconnecting");
      }
    };
    source.onmessage = onEvent;
    source.addEventListener("workflow", onEvent);
    return () => {
      source.close();
      setConnection("offline");
    };
  }, [loadRun, selectedRunId]);

  useEffect(() => {
    setInputSnapshot(undefined);
    setOutputSnapshot(undefined);
    setConfigSnapshot(undefined);
    setSnapshotError(undefined);
    const selectedNodeRun = nodeRuns.find((item) => item.nodeKey === selectedNode);
    const inputId = selectedNodeRun?.inputSnapshotId;
    const outputId = selectedNodeRun?.outputSnapshotId;
    const configId = runs.find((run) => run.id === selectedRunId)?.configSnapshotId;
    if (!selectedRunId || (!inputId && !outputId && !configId)) return;
    let active = true;
    setSnapshotsLoading(true);
    Promise.all([
      inputId ? api.getWorkflowSnapshot(selectedRunId, inputId) : Promise.resolve(undefined),
      outputId ? api.getWorkflowSnapshot(selectedRunId, outputId) : Promise.resolve(undefined),
      configId ? api.getWorkflowSnapshot(selectedRunId, configId) : Promise.resolve(undefined),
    ]).then(([input, output, config]) => {
      if (!active) return;
      setInputSnapshot(input);
      setOutputSnapshot(output);
      setConfigSnapshot(config);
    }).catch((reason: unknown) => {
      if (active) setSnapshotError(reason instanceof Error ? reason.message : "无法读取节点快照");
    }).finally(() => {
      if (active) setSnapshotsLoading(false);
    });
    return () => { active = false; };
  }, [nodeRuns, runs, selectedNode, selectedRunId]);

  const trigger = async () => {
    setTriggering(true);
    setError(undefined);
    try {
      const run = await api.createWorkflowRun();
      setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setSelectedRunId(run.id);
      setSelectedNode("source_fetch");
      setNodeModalOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法启动工作流");
    } finally {
      setTriggering(false);
    }
  };

  const replay = async () => {
    if (!selectedRunId || selectedNode === "trigger") return;
    if (replayMode === "selected_items" && selectedItemIds.length === 0) {
      setError("请选择至少一个条目再重跑");
      return;
    }
    setError(undefined);
    try {
      const scope = { mode: replayMode, ...(selectedItemIds.length ? { itemIds: selectedItemIds } : {}) };
      const configOverrides: WorkflowConfigOverrides = {};
      if (overrideModel.trim()) configOverrides.model = overrideModel.trim();
      if (overrideThreshold.trim()) {
        const value = Number(overrideThreshold);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          setError("通过阈值必须在 0 到 100 之间");
          return;
        }
        configOverrides.passThreshold = value;
      }
      const run = await api.replayWorkflowRun(selectedRunId, selectedNode, scope, `从 ${selectedNode} 以 ${replayMode} 重新运行`, configOverrides);
      setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setSelectedRunId(run.id);
      setComparison(undefined);
      setNodeModalOpen(false);
      if (detailOnly) router.push(`/workflow/${run.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法创建 replay 运行");
    }
  };

  const compare = async () => {
    if (!selectedRunId || !comparisonRunId) return;
    setComparing(true);
    setError(undefined);
    try {
      setComparison(await api.compareWorkflowRuns(selectedRunId, comparisonRunId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法比较运行");
    } finally {
      setComparing(false);
    }
  };

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);
  };

  const nodes = useMemo<Node<WorkflowNodeData>[]>(() => NODE_ORDER.map((definition) => ({
    id: definition.key,
    type: "workflow",
    position: NODE_POSITIONS[definition.key],
    data: {
      ...definition,
      nodeKey: definition.key,
      state: definition.key === "trigger" ? (selectedRunId ? "succeeded" : "idle") : nodeState(events, definition.key),
      event: latestEvent(events, definition.key),
      artifacts: artifacts.filter((item) => item.nodeKey === definition.key),
    },
  })), [artifacts, events, selectedRunId]);

  const edges = useMemo<Edge[]>(() => NODE_ORDER.slice(0, -1).map((definition, index) => {
    const target = NODE_ORDER[index + 1];
    const active = nodeState(events, definition.key) === "running" || nodeState(events, target.key) === "running";
    return {
      id: `${definition.key}-${target.key}`,
      source: definition.key,
      target: target.key,
      animated: active,
      markerEnd: { type: MarkerType.ArrowClosed, color: active ? "#d55c3e" : "#aeb7bd" },
      style: { stroke: active ? "#d55c3e" : "#aeb7bd", strokeWidth: active ? 2 : 1.5 },
    };
  }), [events]);

  const inspectorEvent = latestEvent(events, selectedNode);
  const inspectorEvents = events.filter((item) => item.nodeKey === selectedNode);
  const inspectorArtifacts = artifacts.filter((item) => item.nodeKey === selectedNode);
  const inspectorNodeRun = nodeRuns.find((item) => item.nodeKey === selectedNode);
  const inspectorDecisions = decisions.filter((item) => item.nodeRunId === inspectorNodeRun?.id);
  const selectedRun = runs.find((run) => run.id === selectedRunId);
  const closeNodeModal = useCallback(() => setNodeModalOpen(false), []);

  return (
    <main className={`workflow-page${detailOnly ? " workflow-page-detail" : ""}`}>
      <header className="workflow-header">
        {detailOnly ? <>
          <div className="workflow-detail-heading">
            <Link className="workflow-back-link" href="/"><ArrowLeft size={16} />返回任务列表</Link>
            <div className="eyebrow">WORKFLOW RUN / {selectedRunId?.slice(0, 8) ?? "-"}</div>
            <h1>运行画布</h1>
            <p>{selectedRun ? `${formatTime(selectedRun.createdAt)} · ${triggerLabel(selectedRun)}触发 · ${selectedRun.status}` : "正在读取运行信息..."}</p>
          </div>
          <div className="workflow-actions"><button className="button button-quiet workflow-detail-refresh" disabled={!selectedRunId} onClick={() => selectedRunId && loadRun(selectedRunId)}><RefreshCw size={15} />刷新运行</button></div>
        </> : <>
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
        </>}
      </header>

      {error && <div className="workflow-alert"><CircleAlert size={16} />{error}<button onClick={() => setError(undefined)} aria-label="关闭提示"><X size={15} /></button></div>}

      {!detailOnly && <section className="workflow-run-list" aria-label="工作流任务列表">
        <div className="workflow-section-heading"><div><span className="section-kicker">RUN HISTORY</span><h2>任务列表</h2></div><span className="muted">{runs.length} 次运行</span></div>
        {runs.length === 0 ? <div className="workflow-run-list-empty"><Clock3 size={18} />还没有运行记录。</div> : <div className="workflow-run-items">{runs.map((run) => {
          const funnel = summaryRecord(run.summary, "funnel");
          const total = summaryRecord(run.summary, "total");
          const observability = summaryRecord(run.summary, "observability");
          const recentFailureNode = run.summary?.recentFailureNode;
          return <Link href={`/workflow/${run.id}`} key={run.id} className={`workflow-run-item${run.id === selectedRunId ? " is-selected" : ""}`} onClick={() => { setSelectedRunId(run.id); setNodeModalOpen(false); }}>
            <span className="workflow-run-item-main"><strong>{formatTime(run.createdAt)}</strong><span>{triggerLabel(run)} · {run.status}{run.parentRunId ? " · 子运行" : ""}</span>{observability?.missing === true && <span className="workflow-run-observability"><CircleAlert size={12} />观测缺失</span>}</span>
            <span className="workflow-run-item-stages">{RUN_STAGE_LABELS.map(([key, label]) => { const stage = funnel?.[key]; return <span key={key} title={`${label}输入 / 通过 / 拒绝 / 失败`}><b>{label}</b>{summaryNumber(stage, "input")} / {summaryNumber(stage, "accepted")} / {summaryNumber(stage, "rejected")} / {summaryNumber(stage, "failed")}</span>; })}</span>
            <span className="workflow-run-item-total"><span>产物 <b>{summaryNumber(total, "artifactCount")}</b></span><span>耗时 <b>{summaryNumber(total, "durationSeconds").toFixed(1)}s</b></span><span>成本 <b>{total && typeof total.costUsd === "number" ? `$${total.costUsd.toFixed(4)}` : "-"}</b></span>{typeof recentFailureNode === "string" && recentFailureNode && <span className="workflow-run-failure"><CircleAlert size={12} />{recentFailureNode}</span>}</span>
          </Link>;
        })}</div>}
      </section>}

      <section className={`workflow-stage-band${detailOnly ? " workflow-stage-band-detail" : ""}`}>
        <div className="workflow-stage-heading">
          <div><span className="section-kicker">LIVE GRAPH</span><h2>运行画布</h2></div>
          <span className={`connection-state connection-${connection}`}><Radio size={14} />{connection === "live" ? "实时连接" : connection === "reconnecting" ? "正在重连" : "未连接"}</span>
        </div>
        <div className="workflow-graph-shell">
          {loading ? <div className="workflow-loading"><LoaderCircle className="spin" size={22} />正在读取运行记录</div> : selectedRunId ? <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.18 }} onNodeClick={(_, node) => { setSelectedNode(node.id); setNodeModalOpen(true); }} proOptions={{ hideAttribution: true }}><Background color="#e5e8e9" gap={24} size={1} /><Controls showInteractive={false} /><MiniMap nodeColor={(node) => node.data?.state === "running" ? "#d55c3e" : "#b8c0c4"} /></ReactFlow> : <div className="workflow-empty"><Activity size={24} /><strong>还没有运行记录</strong><span>点击“启动一次采集”，开始观察第一条内容生产链。</span></div>}
        </div>
      </section>

      {!detailOnly && <section className="workflow-lower-grid">
        <aside className="workflow-inspector">
          <div className="workflow-section-heading"><div><span className="section-kicker">NODE INSPECTOR</span><h2>{NODE_ORDER.find((item) => item.key === selectedNode)?.label}</h2></div><span className={`status status-${nodeState(events, selectedNode)}`}>{nodeState(events, selectedNode)}</span></div>
          <p className="workflow-description">{NODE_ORDER.find((item) => item.key === selectedNode)?.description}</p>
          {selectedRunId && selectedNode !== "trigger" && <div className="workflow-replay-controls">
            <div className="workflow-control-row">
              <label>重跑范围<select value={replayMode} onChange={(event) => { setReplayMode(event.target.value as ReplayMode); setSelectedItemIds([]); }}>
                <option value="full">当前节点及后续</option>
                <option value="failed_items">仅失败项</option>
                <option value="selected_items">选择条目</option>
                <option value="evaluate_only">只重新评估</option>
              </select></label>
              <button className="button button-quiet" onClick={replay}><RefreshCw size={14} />执行 replay</button>
            </div>
            <div className="workflow-control-row">
              <label>模型覆盖<input value={overrideModel} onChange={(event) => setOverrideModel(event.target.value)} placeholder="沿用默认模型" /></label>
              <label>通过阈值<input type="number" min="0" max="100" value={overrideThreshold} onChange={(event) => setOverrideThreshold(event.target.value)} placeholder="沿用默认阈值" /></label>
            </div>
          </div>}
          <dl className="workflow-detail-list">
            <div><dt>最近事件</dt><dd>{inspectorEvent?.message ?? "尚未执行"}</dd></div>
            <div><dt>发生时间</dt><dd>{formatTime(inspectorEvent?.occurredAt)}</dd></div>
            <div><dt>Agent 操作</dt><dd>{inspectorEvent?.payload?.queue ? `消费 ${String(inspectorEvent.payload.queue)} 队列` : "等待运行"}</dd></div>
            <div><dt>输入快照</dt><dd><code>{inspectorNodeRun?.inputSnapshotId ?? "-"}</code></dd></div>
            <div><dt>输出快照</dt><dd><code>{inspectorNodeRun?.outputSnapshotId ?? "-"}</code></dd></div>
            <div><dt>漏斗计数</dt><dd>{inspectorNodeRun?.counts ? Object.entries(inspectorNodeRun.counts).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "-"}</dd></div>
          </dl>
          {selectedRunId && <div className="workflow-artifact-block"><div className="workflow-subheading"><span>运行配置快照</span><strong>{configSnapshot ? (configSnapshot.archivedAt ? "已归档" : "已固化") : "读取中"}</strong></div>{configSnapshot ? <><div className="workflow-snapshot-meta"><span>版本 {String(configSnapshot.payload.configVersion ?? "-")}</span><span>触发 {String(configSnapshot.payload.triggerType ?? "-")}</span><code>{configSnapshot.sha256.slice(0, 12)}…</code></div><pre className="workflow-config-json">{JSON.stringify(configSnapshot.payload, null, 2)}</pre></> : <span className="muted">当前运行没有可读的配置快照。</span>}</div>}
          <div className="workflow-artifact-block"><div className="workflow-subheading"><span>节点快照</span><strong>{snapshotsLoading ? "读取中" : "输入 / 输出"}</strong></div>{snapshotError ? <span className="muted">{snapshotError}</span> : snapshotsLoading ? <span className="muted">正在读取不可变快照…</span> : <div className="workflow-snapshot-grid"><div><span>输入</span>{inputSnapshot ? <pre>{JSON.stringify(inputSnapshot.payload, null, 2)}</pre> : <span className="muted">无</span>}</div><div><span>输出</span>{outputSnapshot ? <pre>{JSON.stringify(outputSnapshot.payload, null, 2)}</pre> : <span className="muted">无</span>}</div></div>}</div>
          {selectedRunId && <div className="workflow-artifact-block"><div className="workflow-subheading"><span>Replay 血缘</span><strong>{runs.filter((run) => run.parentRunId === selectedRunId).length} 个子运行</strong></div>{(() => { const selected = runs.find((run) => run.id === selectedRunId); const parent = selected?.parentRunId ? runs.find((run) => run.id === selected.parentRunId) : undefined; const children = runs.filter((run) => run.parentRunId === selectedRunId); if (!parent && children.length === 0) return <span className="muted">这是独立运行，尚无 replay 记录。</span>; return <div className="workflow-lineage-list">{parent && <button className="workflow-lineage-link" onClick={() => { setSelectedRunId(parent.id); setSelectedNode(parent.replayFromNode ?? "source_fetch"); }}>父运行 · {formatTime(parent.createdAt)} · {parent.status}</button>}{children.map((child) => <button key={child.id} className="workflow-lineage-link" onClick={() => { setSelectedRunId(child.id); setSelectedNode(child.replayFromNode ?? "source_fetch"); }}>子运行 · {formatTime(child.createdAt)} · {child.replayFromNode ?? "-"} · {child.status}</button>)}</div>; })()}</div>}
          <div className="workflow-artifact-block"><div className="workflow-subheading"><span>节点产物</span><strong>{inspectorArtifacts.length}</strong></div>{inspectorArtifacts.length === 0 ? <span className="muted">运行后会在这里显示可追踪产物。</span> : inspectorArtifacts.map((artifact) => <Link key={artifact.id} href={artifactHref(artifact)} className="workflow-artifact-link"><span>{artifact.title || artifact.artifactType}</span><span>打开 <span aria-hidden="true">↗</span></span></Link>)}</div>
          {(selectedNode === "topic_evaluate" || selectedNode === "article_evaluate") && <div className="workflow-artifact-block"><div className="workflow-subheading"><span>逐条判定</span><strong>{inspectorDecisions.length}</strong></div>{inspectorDecisions.length === 0 ? <span className="muted">暂无判定记录。</span> : inspectorDecisions.map((decision) => <label key={decision.id} className="workflow-decision-row"><input type="checkbox" checked={selectedItemIds.includes(decision.itemId)} onChange={() => toggleItem(decision.itemId)} /><span><strong>{decision.decision} · {decision.reasonCode}</strong><small>{decision.reason}</small></span><span>{decision.totalScore ?? "-"}</span></label>)}</div>}
        </aside>

        <section className="workflow-timeline">
          <div className="workflow-section-heading"><div><span className="section-kicker">RUN TIMELINE</span><h2>执行记录</h2></div><span className="muted">{events.length} 个事件</span></div>
          {events.length === 0 ? <div className="workflow-timeline-empty"><Clock3 size={18} />选择运行后，事件会按发生顺序显示。</div> : <div className="timeline-list">{[...events].reverse().map((event) => <button key={event.id} className={`timeline-item timeline-${event.status}`} onClick={() => setSelectedNode(event.nodeKey)}><span className="timeline-marker">{event.status === "succeeded" ? <Check size={13} /> : event.status === "failed" ? <CircleAlert size={13} /> : event.status === "running" ? <LoaderCircle size={13} className="spin" /> : <Clock3 size={13} />}</span><span className="timeline-copy"><strong>{NODE_ORDER.find((item) => item.key === event.nodeKey)?.label ?? event.nodeKey}</strong><span>{event.message}</span></span><time>{formatTime(event.occurredAt)}</time></button>)}</div>}
        </section>
      </section>}

      {!detailOnly && selectedRunId && runs.length > 1 && <section className="workflow-compare">
        <div className="workflow-section-heading"><div><span className="section-kicker">RUN COMPARE</span><h2>运行对比</h2></div><span className="muted">比较漏斗、原因和产物变化</span></div>
        <div className="workflow-compare-controls">
          <select value={comparisonRunId} onChange={(event) => setComparisonRunId(event.target.value)}>
            <option value="">选择另一次运行</option>
            {runs.filter((run) => run.id !== selectedRunId).map((run) => <option key={run.id} value={run.id}>{formatTime(run.createdAt)} · {run.status}</option>)}
          </select>
          <button className="button button-quiet" disabled={!comparisonRunId || comparing} onClick={compare}>{comparing ? <LoaderCircle size={14} className="spin" /> : <Activity size={14} />}比较</button>
        </div>
        {comparison && <div className="workflow-compare-detail">
          <div className="workflow-compare-grid">
            <div><span>输入是否相同</span><strong>{comparison.sameInput ? "是" : "否"}</strong></div>
            <div><span>新增产物</span><strong>{String(comparison.artifacts?.added ?? 0)}</strong></div>
            <div><span>移除产物</span><strong>{String(comparison.artifacts?.removed ?? 0)}</strong></div>
            <div><span>阶段变化</span><strong>{Object.keys(comparison.stages).length} 个节点</strong></div>
          </div>
          <div className="workflow-compare-table-wrap"><table className="workflow-compare-table"><thead><tr><th>节点</th><th>基准运行</th><th>对比运行</th></tr></thead><tbody>{NODE_ORDER.filter((node) => node.key !== "trigger").map((node) => { const stage = comparison.stages[node.key]; const base = stage?.base as Record<string, unknown> | undefined; const other = stage?.other as Record<string, unknown> | undefined; return <tr key={node.key}><th>{node.label}</th><td><span>漏斗 {metricText(base, "inputCount")} → {metricText(base, "accepted")} / {metricText(base, "rejected")} / {metricText(base, "failed")}</span><span>通过率 {metricRate(base)} · {metricText(base, "durationSeconds", "s")}</span><span>Token {metricText(base, "tokenCount")} · 成本 {metricNumber(base, "cost") === undefined ? "-" : `$${metricNumber(base, "cost")!.toFixed(4)}`}</span></td><td><span>漏斗 {metricText(other, "inputCount")} → {metricText(other, "accepted")} / {metricText(other, "rejected")} / {metricText(other, "failed")}</span><span>通过率 {metricRate(other)} · {metricText(other, "durationSeconds", "s")}</span><span>Token {metricText(other, "tokenCount")} · 成本 {metricNumber(other, "cost") === undefined ? "-" : `$${metricNumber(other, "cost")!.toFixed(4)}`}</span></td></tr>; })}</tbody></table></div>
          <div className="workflow-compare-bottom"><div><div className="workflow-subheading"><span>拒绝原因变化</span><strong>{comparisonReasonEntries(comparison.reasonCounts).length}</strong></div>{comparisonReasonEntries(comparison.reasonCounts).length === 0 ? <span className="muted">没有可比较的原因记录。</span> : <div className="workflow-reason-list">{comparisonReasonEntries(comparison.reasonCounts).map(([reason, count]) => <span key={reason}><code>{reason}</code><b>{count}</b></span>)}</div>}</div><div><div className="workflow-subheading"><span>运行成本</span><strong>基准 / 对比</strong></div><div className="workflow-cost-list"><span>Token {metricText(comparison.cost?.base, "tokenCount")} / {metricText(comparison.cost?.other, "tokenCount")}</span><span>成本 {metricNumber(comparison.cost?.base, "costUsd") === undefined ? "-" : `$${metricNumber(comparison.cost?.base, "costUsd")!.toFixed(4)}`} / {metricNumber(comparison.cost?.other, "costUsd") === undefined ? "-" : `$${metricNumber(comparison.cost?.other, "costUsd")!.toFixed(4)}`}</span><span>耗时 {metricText(comparison.cost?.base, "durationSeconds", "s")} / {metricText(comparison.cost?.other, "durationSeconds", "s")}</span></div></div></div>
        </div>}
      </section>}

      {selectedRunId && <footer className="workflow-footer"><span>运行 ID <code>{selectedRunId}</code></span><button className="button button-quiet" onClick={() => loadRun(selectedRunId)}><RefreshCw size={14} />刷新</button></footer>}
      {nodeModalOpen && <NodeExecutionModal node={NODE_ORDER.find((item) => item.key === selectedNode) ?? NODE_ORDER[1]} events={inspectorEvents} nodeRun={inspectorNodeRun} decisions={inspectorDecisions} artifacts={inspectorArtifacts} inputSnapshot={inputSnapshot} outputSnapshot={outputSnapshot} loading={snapshotsLoading} snapshotError={snapshotError} replayMode={replayMode} selectedItemIds={selectedItemIds} overrideModel={overrideModel} overrideThreshold={overrideThreshold} onReplayModeChange={(mode) => { setReplayMode(mode); setSelectedItemIds([]); }} onToggleItem={toggleItem} onOverrideModelChange={setOverrideModel} onOverrideThresholdChange={setOverrideThreshold} onReplay={replay} onClose={closeNodeModal} />}
    </main>
  );
}
