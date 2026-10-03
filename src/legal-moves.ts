import { Chess } from "chess.js";
import type { Square } from "chess.js";

export interface LegalTarget {
	square: string;
	// A piece stands there, so the move takes it.
	capture: boolean;
}

// The squares the piece on square can move to in the position, one entry per
// square (the four promotions to one square are one target).
export function legalTargets(fen: string, square: string): LegalTarget[] {
	let chess: Chess;
	try {
		chess = new Chess(fen);
	} catch {
		return [];
	}
	const targets: LegalTarget[] = [];
	const seen = new Set<string>();
	let moves;
	try {
		moves = chess.moves({ square: square as Square, verbose: true });
	} catch {
		return [];
	}
	for (const move of moves) {
		if (seen.has(move.to)) continue;
		seen.add(move.to);
		targets.push({ square: move.to, capture: chess.get(move.to) !== undefined });
	}
	return targets;
}
