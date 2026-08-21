"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { components } from "@scholars-ai/contracts/core-api";
import { ArrowRight } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

type ArticleReview = components["schemas"]["ArticleReview"];
type ArticleStatus = components["schemas"]["ArticleStatus"];
type Platform = components["schemas"]["Platform"];

const statusLabels: Record<ArticleStatus, string> = {
  draft: "写作中", scored: "决策中", rewrite_queued: "已回炉", pending_review: "待终审",
  approved: "已通过", published: "已发布", rejected: "已拒绝",
};
const platformLabels: Record<Platform, string> = { xiaohongshu: "小红书", zhihu: "知乎", wechat: "公众号" };
function articleStatusClass(status: ArticleStatus) { return `status article-status-${status}`; }

export default function ArticlesPage() {
  const [status, setStatus] = useState<ArticleStatus | "">("pending_review");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [items, setItems] = useState<ArticleReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await api.listArticles({ status: status || undefined, platform: platform || undefined });
      setItems(result.items); setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载文章失败");
    } finally { setLoading(false); }
  }, [platform, status]);

  useEffect(() => { void loadList(); }, [loadList]);

  return <main className="page article-index-page">
    <div className="page-heading"><div><div className="eyebrow">M2 / HUMAN REVIEW</div><h1>文章工作台</h1><p className="lede">按状态和平台查找 Agent 产出的文章，进入单篇页面完成审阅、终审与发布登记。</p></div><Button onClick={() => void loadList()} disabled={loading}>刷新数据</Button></div>
    <div className="toolbar"><Label htmlFor="article-status">状态</Label><Select value={status || "all"} onValueChange={(value) => setStatus(value === "all" ? "" : value as ArticleStatus)}><SelectTrigger id="article-status" className="w-[150px]"><SelectValue placeholder="状态" /></SelectTrigger><SelectContent><SelectItem value="pending_review">待终审</SelectItem><SelectItem value="approved">已通过</SelectItem><SelectItem value="published">已发布</SelectItem><SelectItem value="rejected">已拒绝</SelectItem><SelectItem value="rewrite_queued">历史回炉稿</SelectItem><SelectItem value="all">全部</SelectItem></SelectContent></Select><Label htmlFor="article-platform">平台</Label><Select value={platform || "all"} onValueChange={(value) => setPlatform(value === "all" ? "" : value as Platform)}><SelectTrigger id="article-platform" className="w-[150px]"><SelectValue placeholder="平台" /></SelectTrigger><SelectContent><SelectItem value="all">全部平台</SelectItem><SelectItem value="xiaohongshu">小红书</SelectItem><SelectItem value="zhihu">知乎</SelectItem><SelectItem value="wechat">公众号</SelectItem></SelectContent></Select><span className="meta-row">共 {total} 篇</span></div>
    {error && <div className="error panel">{error}</div>}
    <section className="article-index-list panel" aria-label="文章列表">
      {loading && <div className="empty">正在读取文章…</div>}
      {!loading && items.length === 0 && <div className="empty">当前筛选没有文章。</div>}
      {items.map((item) => <article className="article-index-item" key={item.article.id}><div className="article-index-content"><div className="article-list-meta"><span>{platformLabels[item.article.platform]}</span><span>v{item.article.version}</span><span className={articleStatusClass(item.article.status)}>{statusLabels[item.article.status]}</span></div><h2>{item.article.title}</h2><p>{item.topicTitle}</p><div className="article-list-score"><span>评分 {item.article.latestScore?.toFixed(1) ?? "—"}</span><span>发布 {item.publicationCount} 次</span></div></div><Button asChild variant="outline"><Link href={`/articles/${item.article.id}`}>进入审阅 <ArrowRight aria-hidden="true" /></Link></Button></article>)}
    </section>
  </main>;
}
