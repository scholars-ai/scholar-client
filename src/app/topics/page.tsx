"use client";

import { useCallback, useEffect, useState } from "react";
import type { components } from "@scholars-ai/contracts/core-api";
import { api } from "../../lib/api";

type Topic = components["schemas"]["Topic"];
type Evaluation = components["schemas"]["TopicEvaluation"];
type Status = components["schemas"]["TopicStatus"];

const statusLabels: Record<Status, string> = {
  candidate: "待评分",
  scored: "待确认",
  approved: "已确认",
  in_writing: "写作中",
  written: "已成稿",
  rejected: "已否决",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function statusClass(status: Status) {
  return `status status-${status}`;
}

export default function TopicsPage() {
  const [status, setStatus] = useState<Status | "">("scored");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [total, setTotal] = useState(0);
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listTopics(status || undefined);
      setTopics(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载选题失败");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleEvaluation(topicId: string) {
    if (expanded === topicId) {
      setExpanded(null);
      return;
    }
    setExpanded(topicId);
    if (evaluations[topicId]) return;
    try {
      const result = await api.listEvaluations(topicId);
      setEvaluations((current) => ({ ...current, [topicId]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载评分详情失败");
    }
  }

  async function transition(topic: Topic, action: "approve" | "reject") {
    setBusy(topic.id);
    setError(null);
    try {
      const updated = action === "approve" ? await api.approveTopic(topic.id) : await api.rejectTopic(topic.id);
      setTopics((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (status && updated.status !== status) {
        setTopics((current) => current.filter((item) => item.id !== updated.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "状态更新失败，请刷新后重试");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">M1 / TOPIC LOOP</div>
          <h1>选题看板</h1>
          <p className="lede">从素材聚合到评分理由，逐条审阅并决定哪些选题进入写作。</p>
        </div>
        <button className="button" onClick={() => void load()} disabled={loading}>
          {loading ? "刷新中…" : "刷新数据"}
        </button>
      </div>

      <div className="toolbar">
        <label htmlFor="topic-status">筛选状态</label>
        <select
          className="select"
          id="topic-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as Status | "")}
        >
          <option value="scored">待确认</option>
          <option value="candidate">待评分</option>
          <option value="approved">已确认</option>
          <option value="rejected">已否决</option>
          <option value="">全部</option>
        </select>
        <span className="meta-row">共 {total} 条</span>
      </div>

      {error && <div className="error panel">{error}</div>}
      {loading && <div className="empty panel">正在读取候选选题…</div>}
      {!loading && !error && topics.length === 0 && <div className="empty panel">当前筛选没有选题。</div>}
      <div className="topic-grid">
        {topics.map((topic) => {
          const latest = evaluations[topic.id]?.[0];
          const isExpanded = expanded === topic.id;
          return (
            <article className="topic-card panel" key={topic.id}>
              <div className="topic-card-head">
                <div>
                  <span className={statusClass(topic.status)}>{statusLabels[topic.status]}</span>
                  <h2>{topic.title}</h2>
                  <p>{topic.angle}</p>
                </div>
                <div className="score">
                  {topic.latestScore == null ? "—" : topic.latestScore.toFixed(0)}
                  <small>SCORE</small>
                </div>
              </div>
              <p>{topic.summary}</p>
              <div className="meta-row">
                <span>平台：{topic.targetPlatforms.join(" / ")}</span>
                <span>素材：{topic.rawItemIds.length} 条</span>
                <span>ID：{topic.id.slice(0, 8)}</span>
              </div>
              <div className="card-actions">
                <button className="button" onClick={() => void toggleEvaluation(topic.id)}>
                  {isExpanded ? "收起评分" : "查看评分与理由"}
                </button>
                {topic.status === "scored" && (
                  <button className="button primary" disabled={busy === topic.id} onClick={() => void transition(topic, "approve")}>
                    {busy === topic.id ? "处理中…" : "确认进入写作"}
                  </button>
                )}
                {(topic.status === "candidate" || topic.status === "scored") && (
                  <button className="button danger" disabled={busy === topic.id} onClick={() => void transition(topic, "reject")}>
                    否决
                  </button>
                )}
              </div>
              {isExpanded && (
                <div className="detail-grid">
                  <div>
                    <h3>评分维度</h3>
                    {latest ? (
                      <>
                        <div className="dimension-list">
                          {Object.entries(latest.dimensionScores).map(([dimension, score]) => (
                            <div className="dimension" key={dimension}>
                              <strong>{score.toFixed(1)}</strong>
                              <span>{dimension}</span>
                              {latest.dimensionReasons?.[dimension] && <div className="reason">{latest.dimensionReasons[dimension]}</div>}
                            </div>
                          ))}
                        </div>
                        <div className="reason"><strong>总体理由：</strong>{latest.rationale}</div>
                      </>
                    ) : (
                      <div className="empty panel">正在加载评分历史…</div>
                    )}
                  </div>
                  {latest && (
                    <aside className="panel" style={{ padding: 18 }}>
                      <div className="eyebrow">TRACEABLE RUN</div>
                      <p className="meta-row">Rubric：{latest.rubricVersion}</p>
                      <p className="meta-row">权重版本：{latest.weightVersion ?? "—"}</p>
                      <p className="meta-row">模型：{latest.judgeModel}</p>
                      <p className="meta-row">Veto：{latest.vetoedDimension ?? "无"}</p>
                      <p className="meta-row">时间：{formatDate(latest.createdAt)}</p>
                      <p className="meta-row">Agent Run：{latest.agentRunId?.slice(0, 8) ?? "—"}</p>
                    </aside>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
