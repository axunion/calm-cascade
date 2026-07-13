// spec/04 §6: no abstraction layer, just a gated call to the vibration API.
// iOS Safari lacks navigator.vibrate and silently no-ops.
const MATCH_PATTERN_MS = 10;
const COMBO_TIER_PATTERN_MS = 20;

export function vibrateMatch(enabled: boolean, tierUp: boolean): void {
  if (!enabled || typeof navigator === "undefined" || !navigator.vibrate) {
    return;
  }
  navigator.vibrate(tierUp ? COMBO_TIER_PATTERN_MS : MATCH_PATTERN_MS);
}
