import Link from "next/link";

const sections = [
  { href: "/topics", title: "选题看板", desc: "候选选题、评分理由、确认与否决（M1）" },
  { href: "/articles", title: "文章审阅", desc: "平台文章 diff 编辑、终审、导出 md（M2）" },
  { href: "/metrics", title: "数据面板", desc: "发帖数据录入、表现分、归因周报（M3）" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">scholars-ai console</h1>
      <p className="mt-2 text-sm text-gray-500">
        选题 → 评分 → 写作 → 评分 → 发布 → 数据回流的控制台
      </p>
      <div className="mt-8 grid gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border p-4 hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            <div className="font-medium">{s.title}</div>
            <div className="mt-1 text-sm text-gray-500">{s.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
