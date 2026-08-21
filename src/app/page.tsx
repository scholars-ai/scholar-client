import Link from "next/link";

const sections = [
  { href: "/pipeline", title: "内容流水线", desc: "2h 采集、4h Topic、8h 平台文章，全链路可追踪" },
  { href: "/topics", title: "选题质量", desc: "查看 Topic 来源、评分理由与素材依据" },
  { href: "/articles", title: "文章工作台", desc: "复制、下载、去发布，回来登记真实发布" },
  { href: "/metrics", title: "数据面板", desc: "发帖数据录入、表现分、归因周报（M3）" },
];

export default function Home() {
  return (
    <main className="page">
      <div className="page-heading"><div><div className="eyebrow">SCHOLARS AI / CONTROL ROOM</div><h1>让 Agent 持续产出<br />可发布的文章。</h1><p className="lede">人只判断最终文章是否发布；系统负责准确采集、优质选题、平台化写作，以及每一步的可视化追踪。</p></div></div>
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
