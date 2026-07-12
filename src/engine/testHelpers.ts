import { BOARD_SIZE, type Board, type Gem, type Special } from "./board.ts";

// Readable fixture notation for tests (spec/06 §2): one letter per gem kind,
// '.' for an empty cell, and an optional trailing modifier for specials
// ('>' = laserH, '^' = laserV). Each row string must expand to BOARD_SIZE cells.
const KIND_CHARS = ["R", "O", "Y", "G", "B", "P"];
const SPECIAL_BY_SUFFIX: Record<string, Special> = {
  ">": "laserH",
  "^": "laserV",
};
const SUFFIX_BY_SPECIAL: Partial<Record<Special, string>> = {
  laserH: ">",
  laserV: "^",
};

// A full 8x8 board with no matches and no adjacent swap that creates one —
// shared across test files that just need "some stable board" as a base.
export const STABLE = [
  "ROYGBPRO",
  "OYGBPROY",
  "YGBPROYG",
  "GBPROYGB",
  "BPROYGBP",
  "PROYGBPR",
  "ROYGBPRO",
  "OYGBPROY",
];

let fixtureId = 0;

export function boardFromStrings(rows: string[]): Board {
  if (rows.length !== BOARD_SIZE) {
    throw new Error(
      `boardFromStrings expects ${BOARD_SIZE} rows, got ${rows.length}`,
    );
  }

  const board: Board = [];
  for (const row of rows) {
    const cells: (Gem | null)[] = [];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ".") {
        cells.push(null);
        continue;
      }
      const kind = KIND_CHARS.indexOf(ch);
      if (kind === -1) {
        throw new Error(`Unknown gem character: ${ch}`);
      }
      const suffix = row[i + 1];
      const special = SPECIAL_BY_SUFFIX[suffix] ?? "none";
      if (special !== "none") {
        i++;
      }
      cells.push({ id: fixtureId++, kind, special });
    }
    if (cells.length !== BOARD_SIZE) {
      throw new Error(
        `Row "${row}" expands to ${cells.length} cells, expected ${BOARD_SIZE}`,
      );
    }
    board.push(...cells);
  }
  return board;
}

export function boardToStrings(board: Board): string[] {
  const rows: string[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    let line = "";
    for (let col = 0; col < BOARD_SIZE; col++) {
      const gem = board[row * BOARD_SIZE + col];
      if (!gem) {
        line += ".";
        continue;
      }
      line += KIND_CHARS[gem.kind] + (SUFFIX_BY_SPECIAL[gem.special] ?? "");
    }
    rows.push(line);
  }
  return rows;
}
