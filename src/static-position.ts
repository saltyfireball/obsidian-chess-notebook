import { parsePgn } from "./pgn-parser";
import type { BoardShapes } from "./pgn-parser";
import type { StartAt } from "./types";

export interface StaticPosition {
	fen: string;
	shapes: BoardShapes;
}

// Index into a list of n positions for start_at: start is the first, end the
// last, and a number past the end is the last.
function pickIndex(startAt: StartAt, n: number): number {
	if (startAt === "start") return 0;
	if (startAt === "end") return n - 1;
	return Math.min(startAt, n - 1);
}

// The one position a static diagram of a FEN block shows: its start_at line.
export function staticFenPosition(fens: string[], startAt: StartAt): string {
	return fens[pickIndex(startAt, fens.length)];
}

// The one position a static diagram of a PGN shows, with that move's comment
// drawings. start_at counts half-moves on the main line as in the viewer:
// start is the position before the first move, 0 the one after it.
export function staticPgnPosition(pgn: string, startAt: StartAt): StaticPosition {
	const parsed = parsePgn(pgn);
	const moves = parsed.moves;
	if (startAt === "start" || moves.length === 0) {
		return { fen: parsed.startingFen, shapes: parsed.startingShapes };
	}
	const move = moves[pickIndex(startAt, moves.length)];
	return { fen: move.fen, shapes: move.shapes };
}
