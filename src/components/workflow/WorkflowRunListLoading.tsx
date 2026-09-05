import { LoaderCircle, Play } from "lucide-react";

export function WorkflowRunSkeletonRows() {
  return <div className="workflow-run-loading" role="status" aria-label="正在加载工作流任务">
    {[0, 1, 2].map((item) => <div className="workflow-run-skeleton" key={item}>
      <span className="workflow-skeleton-block workflow-skeleton-main" />
      <span className="workflow-skeleton-block workflow-skeleton-stages" />
      <span className="workflow-skeleton-block workflow-skeleton-total" />
    </div>)}
  </div>;
}

export default function WorkflowRunListLoading() {
  return <main className="workflow-page">
    <header className="workflow-header">
      <div>
        <div className="eyebrow">SCHOLARS AI / WORKFLOW CONTROL</div>
        <h1>内容生产工作流</h1>
        <p>从资讯采集到可发布文章，每一步都留下可追踪的 Agent 记录。</p>
      </div>
      <div className="workflow-actions">
        <button className="button button-primary workflow-trigger" disabled><Play size={16} />启动一次采集</button>
      </div>
    </header>
    <section className="workflow-run-list" aria-label="工作流任务列表" aria-busy="true">
      <div className="workflow-section-heading">
        <div><span className="section-kicker">RUN HISTORY</span><h2>任务列表</h2></div>
        <span className="muted"><LoaderCircle size={13} className="spin" />正在加载</span>
      </div>
      <WorkflowRunSkeletonRows />
    </section>
  </main>;
}
