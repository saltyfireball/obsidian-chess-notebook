import { Chess } from "chess.js";

// A position for repetition counting: placement, side to move, castling and
// en passant. The two move counters do not make a position different.
export function positionKey(fen: string): string {
	return fen.split(" ").slice(0, 4).join(" ");
}

// Why the position is drawn, or null when it is not. repeats is how many
// times this position has occurred in the line so far, this time included.
export function drawReason(fen: string, repeats: number): string | null {
	let chess: Chess;
	try {
		chess = new Chess(fen);
	} catch {
		return null;
	}
	if (chess.isCheckmate()) return null;
	if (chess.isStalemate()) return "Stalemate";
	if (chess.isInsufficientMaterial()) return "Insufficient material";
	if (repeats >= 3) return "Threefold repetition";
	if (parseInt(fen.split(" ")[4] ?? "0") >= 100) return "Fifty-move rule";
	return null;
}
