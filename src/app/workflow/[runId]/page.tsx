import WorkflowCanvas from "@/components/workflow/WorkflowCanvas";

export default async function WorkflowRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <WorkflowCanvas initialRunId={runId} detailOnly />;
}
