"use client";

import Link from "next/link";
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
import { Activity, Bot, Check, CircleAlert, Clock3, LoaderCircle, Play, Radio, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api, type WorkflowArtifact, type WorkflowEvent, type WorkflowItemDecision, type WorkflowNodeRun, type WorkflowRun } from "@/lib/api";

type NodeState = "idle" | "queued" | "running" | "succeeded" | "failed";
type WorkflowNodeData = {
  label: string;
  description: string;
  nodeKey: string;
  state: NodeState;
  event?: WorkflowEvent;
  artifacts: WorkflowArtifact[];
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
    failed: "失败",
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

function artifactHref(artifact: WorkflowArtifact) {
  if (artifact.artifactType === "article") return `/articles/${artifact.artifactId}`;
  if (artifact.artifactType === "topic") return `/topics/${artifact.artifactId}`;
  return "/sources";
}

export default function WorkflowCanvas() {
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

  const loadRuns = useCallback(async () => {
    const result = await api.listWorkflowRuns();
    setRuns(result.items);
    if (!selectedRunId && result.items[0]) setSelectedRunId(result.items[0].id);
  }, [selectedRunId]);

  const loadRun = useCallback(async (id: string) => {
    const result = await api.getWorkflowRun(id);
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

  const trigger = async () => {
    setTriggering(true);
    setError(undefined);
    try {
      const run = await api.createWorkflowRun();
      setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setSelectedRunId(run.id);
      setSelectedNode("source_fetch");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法启动工作流");
    } finally {
      setTriggering(false);
    }
  };

  const replay = async () => {
    if (!selectedRunId || selectedNode === "trigger") return;
    setError(undefined);
    try {
      const run = await api.replayWorkflowRun(selectedRunId, selectedNode, { mode: "full" }, `从 ${selectedNode} 重新运行`);
      setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setSelectedRunId(run.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法创建 replay 运行");
    }
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
  const inspectorArtifacts = artifacts.filter((item) => item.nodeKey === selectedNode);
  const inspectorNodeRun = nodeRuns.find((item) => item.nodeKey === selectedNode);
  const inspectorDecisions = decisions.filter((item) => item.nodeRunId === inspectorNodeRun?.id);

  return (
    <main className="workflow-page">
      <header className="workflow-header">
        <div>
          <div className="eyebrow">SCHOLARS AI / WORKFLOW CONTROL</div>
          <h1>内容生产工作流</h1>
          <p>从资讯采集到可发布文章，每一步都留下可追踪的 Agent 记录。</p>
        </div>
        <div className="workflow-actions">
          <label className="workflow-run-select">
            <span>运行记录</span>
            <select value={selectedRunId ?? ""} onChange={(event) => setSelectedRunId(event.target.value)}>
              <option value="">选择一次运行</option>
              {runs.map((run) => <option key={run.id} value={run.id}>{formatTime(run.createdAt)} · {run.status}</option>)}
            </select>
          </label>
          <button className="button button-primary workflow-trigger" disabled={triggering} onClick={trigger}>
            {triggering ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
            启动一次采集
          </button>
        </div>
      </header>

      {error && <div className="workflow-alert"><CircleAlert size={16} />{error}<button onClick={() => setError(undefined)} aria-label="关闭提示"><X size={15} /></button></div>}

      <section className="workflow-stage-band">
        <div className="workflow-stage-heading">
          <div><span className="section-kicker">LIVE GRAPH</span><h2>运行画布</h2></div>
          <span className={`connection-state connection-${connection}`}><Radio size={14} />{connection === "live" ? "实时连接" : connection === "reconnecting" ? "正在重连" : "未连接"}</span>
        </div>
        <div className="workflow-graph-shell">
          {loading ? <div className="workflow-loading"><LoaderCircle className="spin" size={22} />正在读取运行记录</div> : selectedRunId ? <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.18 }} onNodeClick={(_, node) => setSelectedNode(node.id)} proOptions={{ hideAttribution: true }}><Background color="#e5e8e9" gap={24} size={1} /><Controls showInteractive={false} /><MiniMap nodeColor={(node) => node.data?.state === "running" ? "#d55c3e" : "#b8c0c4"} /></ReactFlow> : <div className="workflow-empty"><Activity size={24} /><strong>还没有运行记录</strong><span>点击“启动一次采集”，开始观察第一条内容生产链。</span></div>}
        </div>
      </section>

      <section className="workflow-lower-grid">
        <aside className="workflow-inspector">
          <div className="workflow-section-heading"><div><span className="section-kicker">NODE INSPECTOR</span><h2>{NODE_ORDER.find((item) => item.key === selectedNode)?.label}</h2></div><span className={`status status-${nodeState(events, selectedNode)}`}>{nodeState(events, selectedNode)}</span></div>
          <p className="workflow-description">{NODE_ORDER.find((item) => item.key === selectedNode)?.description}</p>
          {selectedRunId && selectedNode !== "trigger" && <button className="button button-quiet" onClick={replay}><RefreshCw size={14} />从此节点 replay</button>}
          <dl className="workflow-detail-list">
            <div><dt>最近事件</dt><dd>{inspectorEvent?.message ?? "尚未执行"}</dd></div>
            <div><dt>发生时间</dt><dd>{formatTime(inspectorEvent?.occurredAt)}</dd></div>
            <div><dt>Agent 操作</dt><dd>{inspectorEvent?.payload?.queue ? `消费 ${String(inspectorEvent.payload.queue)} 队列` : "等待运行"}</dd></div>
          </dl>
          <div className="workflow-artifact-block"><div className="workflow-subheading"><span>节点产物</span><strong>{inspectorArtifacts.length}</strong></div>{inspectorArtifacts.length === 0 ? <span className="muted">运行后会在这里显示可追踪产物。</span> : inspectorArtifacts.map((artifact) => <Link key={artifact.id} href={artifactHref(artifact)} className="workflow-artifact-link"><span>{artifact.title || artifact.artifactType}</span><span>打开 <span aria-hidden="true">↗</span></span></Link>)}</div>
          {(selectedNode === "topic_evaluate" || selectedNode === "article_evaluate") && <div className="workflow-artifact-block"><div className="workflow-subheading"><span>逐条判定</span><strong>{inspectorDecisions.length}</strong></div>{inspectorDecisions.length === 0 ? <span className="muted">暂无判定记录。</span> : inspectorDecisions.map((decision) => <div key={decision.id} className="workflow-artifact-link"><span>{decision.decision} · {decision.reasonCode}</span><span>{decision.totalScore ?? "-"}</span></div>)}</div>}
        </aside>

        <section className="workflow-timeline">
          <div className="workflow-section-heading"><div><span className="section-kicker">RUN TIMELINE</span><h2>执行记录</h2></div><span className="muted">{events.length} 个事件</span></div>
          {events.length === 0 ? <div className="workflow-timeline-empty"><Clock3 size={18} />选择运行后，事件会按发生顺序显示。</div> : <div className="timeline-list">{[...events].reverse().map((event) => <button key={event.id} className={`timeline-item timeline-${event.status}`} onClick={() => setSelectedNode(event.nodeKey)}><span className="timeline-marker">{event.status === "succeeded" ? <Check size={13} /> : event.status === "failed" ? <CircleAlert size={13} /> : event.status === "running" ? <LoaderCircle size={13} className="spin" /> : <Clock3 size={13} />}</span><span className="timeline-copy"><strong>{NODE_ORDER.find((item) => item.key === event.nodeKey)?.label ?? event.nodeKey}</strong><span>{event.message}</span></span><time>{formatTime(event.occurredAt)}</time></button>)}</div>}
        </section>
      </section>

      {selectedRunId && <footer className="workflow-footer"><span>运行 ID <code>{selectedRunId}</code></span><button className="button button-quiet" onClick={() => loadRun(selectedRunId)}><RefreshCw size={14} />刷新</button></footer>}
    </main>
  );
}
