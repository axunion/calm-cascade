export type JuiceTier = "small" | "medium" | "large";

// Discriminated on `text` so callers narrow `tier`/`trauma` to their active
// shape with a plain truthiness check on `text`, no cast needed.
export type ComboJuice =
  | { text: null; tier: null; trauma: 0 }
  | { text: string; tier: JuiceTier; trauma: number };

const NO_JUICE: ComboJuice = { text: null, tier: null, trauma: 0 };

// spec/01 §5 combo tier table; trauma values are spec/04 §2.4's screen-shake
// additions (applied when the effect lands in a later phase).
export function comboJuice(combo: number): ComboJuice {
  switch (combo) {
    case 0:
    case 1:
      return NO_JUICE;
    case 2:
      return { text: "Combo 2!", tier: "small", trauma: 0 };
    case 3:
      return { text: "Combo 3!", tier: "small", trauma: 0 };
    case 4:
      return { text: "FABULOUS!!", tier: "medium", trauma: 0.25 };
    case 5:
      return { text: "AMAZING!!", tier: "medium", trauma: 0.25 };
    default:
      return { text: "TRANSCENDENT!!", tier: "large", trauma: 0.45 };
  }
}
