# scholar-client

scholars-ai 控制台（Next.js 15 App Router + Tailwind）：选题看板 / 文章审阅 / 数据面板。部署于 Vercel。架构见 [spec/SPEC-001](https://github.com/scholars-ai/spec/blob/main/specs/SPEC-001-architecture.md)。

## 结构

```
src/app/            页面：/（导航）/topics（M1）/articles（M2）/metrics（M3）
src/lib/api.ts      core API 类型化 client（类型来自 shared 的 codegen 产物）
```

## 开发

```bash
cp .env.example .env.local     # 指向本地 core
pnpm install
pnpm dev
```

shadcn/ui 与 TanStack Query 随 M1 选题看板一起引入（骨架阶段不预装）。

## 契约版本

Client 通过 npmjs.com 上的 `@scholars-ai/contracts` 使用 Shared 发布的固定版本类型包。它是公开包，因此本地、CI 和 Vercel 都不需要 package token；发布端通过 npm Trusted Publishing/OIDC 鉴权，不保存长期 npm token。

升级契约时，先在 `scholar-shared` 更新版本并推送 `contracts-vX.Y.Z` tag，再更新 `package.json` 中的 npm 版本并运行 `pnpm install`。固定版本让 Shared 的后续提交不会无意间改变 Client 的构建输入。
