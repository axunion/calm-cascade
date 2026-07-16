export function stepScore(clearedCount: number, combo: number): number {
  return clearedCount * 10 * combo;
}
