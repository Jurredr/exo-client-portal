import { StatusOption } from "@/components/status-combobox";

export const CLIENT_PROJECT_STAGES: StatusOption[] = [
  { value: "kick_off", label: "Kick Off", state: "bg-blue-500" },
  { value: "pay_first", label: "Pay First", state: "bg-yellow-500" },
  { value: "deliver", label: "Deliver", state: "bg-purple-500" },
  { value: "revise", label: "Revise", state: "bg-orange-500" },
  { value: "pay_final", label: "Pay Final", state: "bg-cyan-500" },
  { value: "completed", label: "Completed", state: "bg-green-500" },
];

export const LABS_PROJECT_STAGES: StatusOption[] = [
  { value: "concept", label: "Concept", state: "bg-purple-500" },
  { value: "mvp", label: "Building MVP", state: "bg-orange-500" },
  { value: "development", label: "Development", state: "bg-yellow-500" },
  { value: "launched", label: "Launched", state: "bg-green-500" },
];

export function getProjectStages(
  projectType: "client" | "labs"
): StatusOption[] {
  return projectType === "labs" ? LABS_PROJECT_STAGES : CLIENT_PROJECT_STAGES;
}

export function getDefaultStage(projectType: "client" | "labs"): string {
  return projectType === "labs" ? "concept" : "kick_off";
}

export function formatStage(
  stage: string,
  projectType?: "client" | "labs"
): string {
  // If projectType is provided, use the appropriate stages
  if (projectType) {
    const stages = getProjectStages(projectType);
    const stageConfig = stages.find((s) => s.value === stage);
    if (stageConfig) return stageConfig.label;
  }

  // Fallback: try both stage arrays
  const clientStage = CLIENT_PROJECT_STAGES.find((s) => s.value === stage);
  if (clientStage) return clientStage.label;

  const labsStage = LABS_PROJECT_STAGES.find((s) => s.value === stage);
  if (labsStage) return labsStage.label;

  // Default formatting
  return stage
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getStageColor(
  stage: string,
  projectType?: "client" | "labs"
): string {
  if (projectType) {
    const stages = getProjectStages(projectType);
    const stageConfig = stages.find((s) => s.value === stage);
    if (stageConfig) return stageConfig.state;
  }

  // Fallback: try both stage arrays
  const clientStage = CLIENT_PROJECT_STAGES.find((s) => s.value === stage);
  if (clientStage) return clientStage.state;

  const labsStage = LABS_PROJECT_STAGES.find((s) => s.value === stage);
  if (labsStage) return labsStage.state;

  return "bg-gray-500";
}
