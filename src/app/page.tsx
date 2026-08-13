import Link from "next/link";

const sections = [
  { href: "/topics", title: "选题看板", desc: "候选选题、评分理由、确认与否决（M1）" },
  { href: "/articles", title: "文章审阅", desc: "平台文章 diff 编辑、终审、导出 md（M2）" },
  { href: "/metrics", title: "数据面板", desc: "发帖数据录入、表现分、归因周报（M3）" },
];

export default function Home() {
  return (
    <main className="page">
      <div className="page-heading"><div><div className="eyebrow">SCHOLARS AI / CONTROL ROOM</div><h1>把信号变成<br />可写的选题。</h1><p className="lede">M1 选题闭环控制台：采集、聚合、评分、人工确认。每次 LLM 环节都可从 Langfuse 追溯。</p></div></div>
      <div className="topic-grid">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="topic-card panel"
          >
            <h2>{s.title}</h2>
            <p>{s.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
