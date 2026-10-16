import { PlanningWorkspace } from "@/components/planning/planning-workspace"
export default async function StagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PlanningWorkspace stageId={id} />
}
