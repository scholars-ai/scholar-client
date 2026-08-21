"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { components } from "@scholars-ai/contracts/core-api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

type Article = components["schemas"]["Article"];
type ArticleDetail = components["schemas"]["ArticleDetail"];
type ArticleReview = components["schemas"]["ArticleReview"];
type ArticleStatus = components["schemas"]["ArticleStatus"];
type Platform = components["schemas"]["Platform"];

const statusLabels: Record<ArticleStatus, string> = {
  draft: "写作中",
  scored: "决策中",
  rewrite_queued: "已回炉",
  pending_review: "待终审",
  approved: "已通过",
  published: "已发布",
  rejected: "已拒绝",
};

const platformLabels: Record<Platform, string> = {
  xiaohongshu: "小红书",
  zhihu: "知乎",
  wechat: "公众号",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function documentMarkdown(article: Pick<Article, "title" | "contentMd">) {
  return `# ${article.title}\n\n${article.contentMd}`;
}

function buildPreviewMarkdown(title: string, content: string, originalTitle: string) {
  const displayTitle = title.trim() || originalTitle.trim() || "未命名文章";
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  while (lines[0]?.trim() === "") lines.shift();
  const firstLine = lines[0]?.replace(/^#\s+/, "").trim();
  const titleCandidates = [displayTitle, originalTitle.trim()].filter(Boolean);
  if (firstLine && titleCandidates.includes(firstLine)) {
    lines.shift();
    while (lines[0]?.trim() === "") lines.shift();
  }
  const body = lines.join("\n").trim();
  return body ? `# ${displayTitle}\n\n${body}` : `# ${displayTitle}`;
}

type DiffLine = { kind: "same" | "add" | "remove"; text: string };

function lineDiff(before: string, after: string): DiffLine[] {
  const left = before.split("\n");
  const right = after.split("\n");
  const lcs = Array.from({ length: left.length + 1 }, () =>
    new Uint16Array(right.length + 1),
  );
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = left[i] === right[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      result.push({ kind: "same", text: left[i] });
      i += 1;
      j += 1;
    } else if (j < right.length && (i === left.length || lcs[i][j + 1] > lcs[i + 1][j])) {
      result.push({ kind: "add", text: right[j] });
      j += 1;
    } else {
      result.push({ kind: "remove", text: left[i] });
      i += 1;
    }
  }
  return result;
}

function articleStatusClass(status: ArticleStatus) {
  return `status article-status-${status}`;
}

export default function ArticlesPage() {
  const [status, setStatus] = useState<ArticleStatus | "">("pending_review");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [items, setItems] = useState<ArticleReview[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArticleDetail | null>(null);
  const [finalTitle, setFinalTitle] = useState("");
  const [finalContent, setFinalContent] = useState("");
  const [reviewMode, setReviewMode] = useState<"preview" | "edit">("preview");
  const [rejectReason, setRejectReason] = useState("");
  const [postId, setPostId] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [followers, setFollowers] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listArticles({
        status: status || undefined,
        platform: platform || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载文章失败");
    } finally {
      setLoading(false);
    }
  }, [platform, status]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function selectArticle(id: string, resetEditor = true) {
    setSelectedId(id);
    setDetailLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.getArticle(id);
      setDetail(result);
      if (resetEditor) {
        setFinalTitle(result.article.title);
        setFinalContent(result.article.contentMd);
        setReviewMode("preview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载文章详情失败");
    } finally {
      setDetailLoading(false);
    }
  }

  const originalDocument = detail ? documentMarkdown(detail.article) : "";
  const finalDocument = `# ${finalTitle}\n\n${finalContent}`;
  const previewDocument = useMemo(
    () => (detail ? buildPreviewMarkdown(finalTitle, finalContent, detail.article.title) : ""),
    [detail, finalContent, finalTitle],
  );
  const diff = useMemo(
    () => (detail ? lineDiff(originalDocument, finalDocument) : []),
    [detail, finalDocument, originalDocument],
  );
  const changedLines = diff.filter((line) => line.kind !== "same").length;

  async function review(action: "approve" | "reject") {
    if (!detail) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const article = action === "approve"
        ? await api.approveArticle(detail.article.id)
        : await api.rejectArticle(detail.article.id, rejectReason.trim() || undefined);
      setDetail({
        ...detail,
        article,
        versions: detail.versions.map((version) => version.id === article.id ? article : version),
      });
      setNotice(action === "approve"
        ? "终审已通过。人工终稿仍在编辑器中，可复制或登记发布。"
        : "文章已拒绝，原因已写入状态审计。",
      );
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "终审操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(finalDocument);
    setNotice("已复制人工终稿 Markdown。");
  }

  function downloadMarkdown() {
    const blob = new Blob([finalDocument], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${finalTitle.replace(/[\\/:*?"<>|]/g, "-") || "article"}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Markdown 文件已导出。");
  }

  async function preparePublication() {
    if (!detail) return;
    await navigator.clipboard.writeText(finalDocument);
    const destinations: Record<Platform, string> = {
      xiaohongshu: "https://creator.xiaohongshu.com/",
      zhihu: "https://www.zhihu.com/creator",
      wechat: "https://mp.weixin.qq.com/",
    };
    window.open(destinations[detail.article.platform], "_blank", "noopener,noreferrer");
    setNotice("已复制当前终稿，请在新打开的平台完成发布；发布后回来登记链接。");
  }

  async function registerPublication() {
    if (!detail) return;
    if (!postId.trim()) {
      setError("请填写平台链接或帖子 ID。");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const publication = await api.createPublication(detail.article.id, {
        platformPostId: postId.trim(),
        finalTitle,
        finalContentMd: finalContent,
        ...(publishedAt ? { publishedAt: new Date(publishedAt).toISOString() } : {}),
        followerCountAtPublish: followers === "" ? null : Number(followers),
      });
      const refreshed = await api.getArticle(detail.article.id);
      setDetail(refreshed);
      setPostId("");
      setPublishedAt("");
      setFollowers("");
      setNotice(`发布已登记，权威人工修改比例为 ${publication.editRatio == null ? "—" : `${(publication.editRatio * 100).toFixed(1)}%`}。`);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "发布登记失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page article-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">M2 / HUMAN REVIEW</div>
          <h1>文章审阅与发布登记</h1>
          <p className="lede">Agent 原稿保持不可变；你编辑的是人工终稿，Core 在发布时生成权威 diff 与修改比例。</p>
        </div>
        <Button onClick={() => void loadList()} disabled={loading}>刷新数据</Button>
      </div>

      <div className="toolbar">
        <Label htmlFor="article-status">状态</Label>
        <Select value={status || "all"} onValueChange={(value) => setStatus(value === "all" ? "" : value as ArticleStatus)}>
          <SelectTrigger id="article-status" className="w-[150px]"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending_review">待终审</SelectItem><SelectItem value="approved">已通过</SelectItem><SelectItem value="published">已发布</SelectItem><SelectItem value="rejected">已拒绝</SelectItem><SelectItem value="rewrite_queued">历史回炉稿</SelectItem><SelectItem value="all">全部</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="article-platform">平台</Label>
        <Select value={platform || "all"} onValueChange={(value) => setPlatform(value === "all" ? "" : value as Platform)}>
          <SelectTrigger id="article-platform" className="w-[150px]"><SelectValue placeholder="平台" /></SelectTrigger>
          <SelectContent><SelectItem value="all">全部平台</SelectItem><SelectItem value="xiaohongshu">小红书</SelectItem><SelectItem value="zhihu">知乎</SelectItem><SelectItem value="wechat">公众号</SelectItem></SelectContent>
        </Select>
        <span className="meta-row">共 {total} 篇</span>
      </div>

      {error && <div className="error panel">{error}</div>}
      {notice && <div className="success panel">{notice}</div>}

      <div className="article-workspace">
        <aside className="article-list panel">
          {loading && <div className="empty">正在读取文章…</div>}
          {!loading && items.length === 0 && <div className="empty">当前筛选没有文章。</div>}
          {items.map((item) => (
            <Button
              variant="ghost"
              type="button"
              className={`article-list-item ${selectedId === item.article.id ? "selected" : ""}`}
              key={item.article.id}
              onClick={() => void selectArticle(item.article.id)}
            >
              <div className="article-list-meta">
                <span>{platformLabels[item.article.platform]}</span>
                <span>v{item.article.version}</span>
                <span className={articleStatusClass(item.article.status)}>{statusLabels[item.article.status]}</span>
              </div>
              <strong>{item.article.title}</strong>
              <small>{item.topicTitle}</small>
              <div className="article-list-score">
                <span>评分 {item.article.latestScore?.toFixed(1) ?? "—"}</span>
                <span>发布 {item.publicationCount} 次</span>
              </div>
            </Button>
          ))}
        </aside>

        <section className="article-review">
          {!selectedId && <div className="empty panel">从左侧选择一篇文章开始终审。</div>}
          {detailLoading && <div className="empty panel">正在加载原稿、版本链与评分…</div>}
          {detail && !detailLoading && (
            <>
              <div className="panel article-overview">
                <div>
                  <div className="article-list-meta">
                    <span>{platformLabels[detail.article.platform]}</span>
                    <span className={articleStatusClass(detail.article.status)}>{statusLabels[detail.article.status]}</span>
                    <span>Writer：{detail.article.writerAgent}</span>
                  </div>
                  <h2>{detail.topic.title}</h2>
                  <p>{detail.topic.angle}</p>
                </div>
                <div className="score">{detail.article.latestScore?.toFixed(0) ?? "—"}<small>SCORE</small></div>
              </div>

              <div className="version-tabs" aria-label="文章版本">
                {detail.versions.map((version) => (
                  <Button variant={version.id === detail.article.id ? "primary" : "default"} size="sm" key={version.id} onClick={() => void selectArticle(version.id)}>
                    v{version.version} · {statusLabels[version.status]}
                  </Button>
                ))}
              </div>

              <div className="review-columns">
                <section className="panel review-pane">
                  <div className="pane-heading"><div><div className="eyebrow">IMMUTABLE BASELINE</div><h3>Agent 原稿</h3></div></div>
                  <pre className="markdown-source">{originalDocument}</pre>
                </section>
                <section className="panel review-pane">
                  <div className="pane-heading"><div><div className="eyebrow">HUMAN FINAL</div><h3>人工终稿</h3></div><span>{changedLines} 行变更</span></div>
                  <div className="mode-toggle" role="group" aria-label="终稿视图">
                    <Button variant="ghost" size="sm" className={`mode-toggle-button ${reviewMode === "preview" ? "active" : ""}`} aria-pressed={reviewMode === "preview"} onClick={() => setReviewMode("preview")}>预览</Button>
                    <Button variant="ghost" size="sm" className={`mode-toggle-button ${reviewMode === "edit" ? "active" : ""}`} aria-pressed={reviewMode === "edit"} onClick={() => setReviewMode("edit")}>编辑</Button>
                  </div>
                  {reviewMode === "preview" ? (
                    <div className="markdown-preview" data-testid="markdown-preview">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
                        }}
                      >
                        {previewDocument}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="markdown-edit-form">
                      <label className="field"><span>最终标题</span><Input value={finalTitle} onChange={(event) => setFinalTitle(event.target.value)} /></label>
                      <label className="field review-editor-field"><span>最终 Markdown 正文</span><Textarea className="markdown-editor" value={finalContent} onChange={(event) => setFinalContent(event.target.value)} /></label>
                    </div>
                  )}
                  <div className="card-actions">
                    <Button variant="primary" onClick={() => void preparePublication()}>复制并去发布</Button>
                    <Button onClick={() => void copyMarkdown()}>复制 Markdown</Button>
                    <Button onClick={downloadMarkdown}>下载 .md</Button>
                  </div>
                </section>
              </div>

              <section className="panel diff-panel">
                <div className="pane-heading"><div><div className="eyebrow">DIFF PREVIEW</div><h3>行级修改预览</h3></div><span>这里只用于审阅；发布时 Core 会重新计算字符级 editRatio</span></div>
                <pre className="diff-view">{diff.map((line, index) => (
                  <span className={`diff-${line.kind}`} key={`${index}-${line.kind}`}>
                    {line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}{line.text}{"\n"}
                  </span>
                ))}</pre>
              </section>

              {detail.evaluations[0] && (
                <section className="panel evaluation-panel">
                  <div className="pane-heading"><div><div className="eyebrow">ARTICLE JUDGE</div><h3>最新评分与理由</h3></div><span>{detail.evaluations[0].passed ? "通过机器评分" : "v3 未通过，需人工判断"}</span></div>
                  <div className="dimension-list">
                    {Object.entries(detail.evaluations[0].dimensionScores).map(([key, score]) => (
                      <div className="dimension" key={key}><strong>{score.toFixed(1)}</strong><span>{key}</span><div className="reason">{detail.evaluations[0].dimensionReasons[key] ?? "无逐维理由"}</div></div>
                    ))}
                  </div>
                  <div className="reason"><strong>总体理由：</strong>{detail.evaluations[0].rationale}</div>
                  <div className="meta-row"><span>Rubric：{detail.evaluations[0].rubricVersion}</span><span>阈值：{detail.evaluations[0].passThreshold}</span><span>模型：{detail.evaluations[0].judgeModel}</span><span>Veto：{detail.evaluations[0].vetoedDimension ?? "无"}</span></div>
                </section>
              )}

              {detail.article.status === "pending_review" && (
                <section className="panel action-panel">
                  <div><div className="eyebrow">FINAL REVIEW</div><h3>人工终审</h3><p>通过/拒绝只推进状态，不会覆盖上方 Agent 原稿。</p></div>
                  <label className="field"><span>拒绝原因（仅拒绝时使用）</span><Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="例如：事实依据不足，暂不发布" /></label>
                  <div className="card-actions"><Button variant="primary" disabled={busy} onClick={() => void review("approve")}>终审通过</Button><Button variant="danger" disabled={busy} onClick={() => void review("reject")}>拒绝</Button></div>
                </section>
              )}

              {(detail.article.status === "approved" || detail.article.status === "published") && (
                <section className="panel publication-form">
                  <div><div className="eyebrow">PUBLICATION</div><h3>登记实际发布</h3><p>请先在目标平台发布，再登记链接和实际终稿。第一次登记会把文章标记为已发布。</p></div>
                  <div className="form-grid">
                    <label className="field full"><span>平台链接或帖子 ID</span><Input value={postId} onChange={(event) => setPostId(event.target.value)} placeholder="https://... 或平台侧 ID" /></label>
                    <label className="field"><span>发布时间（不填则用现在）</span><Input type="datetime-local" value={publishedAt} onChange={(event) => setPublishedAt(event.target.value)} /></label>
                    <label className="field"><span>发布时粉丝数（可选）</span><Input type="number" min="0" value={followers} onChange={(event) => setFollowers(event.target.value)} /></label>
                  </div>
                  <Button variant="primary" disabled={busy} onClick={() => void registerPublication()}>登记发布并保存 diff</Button>
                </section>
              )}

              {detail.publications.length > 0 && (
                <section className="panel publication-history">
                  <div className="eyebrow">PUBLICATION HISTORY</div><h3>发布记录</h3>
                  <div className="table-wrap"><table className="data-table"><thead><tr><th>发布时间</th><th>链接 / ID</th><th>修改比例</th><th>粉丝基数</th></tr></thead><tbody>{detail.publications.map((publication) => (
                    <tr key={publication.id}><td>{formatDate(publication.publishedAt)}</td><td>{publication.platformPostId?.startsWith("http") ? <a className="external-link" href={publication.platformPostId} target="_blank" rel="noreferrer">打开发布页</a> : publication.platformPostId ?? "—"}</td><td>{publication.editRatio == null ? "历史数据未计算" : `${(publication.editRatio * 100).toFixed(1)}%`}</td><td>{publication.followerCountAtPublish ?? "—"}</td></tr>
                  ))}</tbody></table></div>
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
