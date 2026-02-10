// Helper to capture entity state for audit diffs
export function captureState(entity: unknown): string | null {
  if (!entity) return null;
  return JSON.stringify(entity);
}
