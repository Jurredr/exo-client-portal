export type ProjectStage =
  | "kick_off"
  | "pay_first"
  | "deliver"
  | "revise"
  | "pay_final"
  | "completed";

const STAGES: ProjectStage[] = [
  "kick_off",
  "pay_first",
  "deliver",
  "revise",
  "pay_final",
  "completed",
];

export function getStageProgress(stage: string | null | undefined): number {
  const currentStage = (stage || "kick_off") as ProjectStage;
  const currentIndex = STAGES.indexOf(currentStage);
  if (currentIndex === -1) return 0;
  // Calculate progress: each stage is 20% (5 stages total)
  // kick_off = 20%, pay_first = 40%, deliver = 60%, revise = 80%, pay_final = 100%
  return ((currentIndex + 1) / STAGES.length) * 100;
}

export function isStageCompleted(
  currentStage: string | null | undefined,
  checkStage: ProjectStage
): boolean {
  const current = (currentStage || "kick_off") as ProjectStage;
  const currentIndex = STAGES.indexOf(current);
  const checkIndex = STAGES.indexOf(checkStage);
  return checkIndex < currentIndex;
}

export function isStageActive(
  currentStage: string | null | undefined,
  checkStage: ProjectStage
): boolean {
  return (currentStage || "kick_off") === checkStage;
}
