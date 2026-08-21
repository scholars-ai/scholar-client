"use client";

import { useParams } from "next/navigation";
import ArticleReview from "../../../components/articles/article-review";

export default function ArticleDetailPage() {
  const params = useParams<{ articleId: string }>();
  return <ArticleReview articleId={params.articleId} />;
}
