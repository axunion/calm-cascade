import { BOARD_SIZE, type Board, type Cell, idx } from "../engine/board.ts";
import { gemShapePath, type Theme } from "./theme.ts";

export interface RenderOptions {
  cellSize: number;
  theme: Theme;
  selected: Cell | null;
}

// Draw order per spec/04 §1.3 (shake/beam/particles land in later phases):
// clear -> board background -> gems -> selection ring.
export function renderBoard(
  ctx: CanvasRenderingContext2D,
  board: Board,
  options: RenderOptions,
): void {
  const { cellSize, theme, selected } = options;
  const boardPx = cellSize * BOARD_SIZE;

  ctx.clearRect(0, 0, boardPx, boardPx);
  drawBackground(ctx, theme, cellSize);
  drawGems(ctx, board, theme, cellSize);
  if (selected) {
    drawSelectionRing(ctx, selected, theme, cellSize);
  }
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  cellSize: number,
): void {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      ctx.fillStyle =
        (row + col) % 2 === 0 ? theme.boardTileA : theme.boardTileB;
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    }
  }
}

function drawGems(
  ctx: CanvasRenderingContext2D,
  board: Board,
  theme: Theme,
  cellSize: number,
): void {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const gem = board[idx(row, col)];
      if (!gem) {
        continue;
      }
      const x = (col + 0.5) * cellSize;
      const y = (row + 0.5) * cellSize;
      ctx.translate(x, y);
      ctx.fillStyle = theme.gemColors[gem.kind];
      ctx.fill(gemShapePath(gem.kind, cellSize));
      ctx.translate(-x, -y);
    }
  }
}

function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  theme: Theme,
  cellSize: number,
): void {
  ctx.save();
  ctx.strokeStyle = theme.selectionRing;
  ctx.lineWidth = Math.max(2, cellSize * 0.05);
  ctx.beginPath();
  ctx.arc(
    (cell.col + 0.5) * cellSize,
    (cell.row + 0.5) * cellSize,
    cellSize * 0.46,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}
