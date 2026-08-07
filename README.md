# scholar-console

scholars-ai 控制台（Next.js 15 App Router + Tailwind）：选题看板 / 文章审阅 / 数据面板。部署于 Vercel。架构见 [spec/SPEC-001](https://github.com/scholars-ai/spec/blob/main/specs/SPEC-001-architecture.md)。

## 结构

```
src/app/            页面：/（导航）/topics（M1）/articles（M2）/metrics（M3）
src/lib/api.ts      core API 类型化 client（类型来自 shared 的 codegen 产物）
gen/                scholar-shared gen/ts 的拷贝（M0 手动同步；M1 起 CI 校验一致性）
```

## 开发

```bash
cp .env.example .env.local     # 指向本地 core
pnpm install
pnpm dev
```

shadcn/ui 与 TanStack Query 随 M1 选题看板一起引入（骨架阶段不预装）。
