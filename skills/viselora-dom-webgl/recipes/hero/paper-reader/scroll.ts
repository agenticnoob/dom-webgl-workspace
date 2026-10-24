/** Native document scroll mapped to the distance travelled by this sticky stage. */
export function resolvePaperReaderProgress(
  top: number,
  sectionHeight: number,
  stageHeight: number,
  stickyTop = 0,
): number {
  const distance = sectionHeight - stageHeight;
  if (distance <= 0) return 0;
  return Math.max(0, Math.min(1, (stickyTop - top) / distance));
}
