# scholar-client

scholars-ai 控制台（Next.js 15 App Router + Tailwind）：选题看板 / 文章审阅 / 数据面板。部署于 Vercel。架构见 [spec/SPEC-001](https://github.com/scholars-ai/spec/blob/main/specs/SPEC-001-architecture.md)。

## 结构

```
src/app/            页面：/（导航）/topics（M1）/articles（M2）/metrics（M3）
src/lib/api.ts      core API 类型化 client（类型来自 shared 的 codegen 产物）
gen/                scholar-shared gen/ts 的暂存副本；CI 会跨仓库逐字节校验
scripts/             本地/CI 的契约一致性检查
```

## 开发

```bash
cp .env.example .env.local     # 指向本地 core
pnpm install
pnpm dev
```

shadcn/ui 与 TanStack Query 随 M1 选题看板一起引入（骨架阶段不预装）。

## 契约同步

在六仓并列检出的开发目录中，同步 shared 生成物后检查：

```bash
cp ../scholar-shared/gen/ts/*.d.ts gen/
./scripts/check-contracts.sh ../scholar-shared
```

CI 会独立检出 `scholars-ai/scholar-shared` 并执行同一检查。跨仓库联调分支可以通过仓库变量 `SCHOLAR_SHARED_REF` 指向 shared 的对应分支；默认检查 `main`。

`scholar-shared/gen/ts/package.json` 已定义版本化类型包元数据。等组织确认 GitHub Packages 的发布和权限策略后，client 可直接依赖 `@scholars-ai/contracts`，届时删除 `gen/` 暂存副本和复制步骤。
