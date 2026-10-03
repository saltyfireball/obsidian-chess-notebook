import { Chess } from "chess.js";

// A position for repetition counting: placement, side to move, castling and
// en passant. The two move counters do not make a position different.
export function positionKey(fen: string): string {
	return fen.split(" ").slice(0, 4).join(" ");
}

export interface Draw {
	reason: string;
	// Threefold repetition and the fifty-move rule only let a player claim a
	// draw (FIDE 9.2, 9.3). The others end the game on their own.
	claimable: boolean;
}

// Why the position is drawn, or null when it is not. repeats is how many
// times this position has occurred in the line so far, this time included.
export function drawReason(fen: string, repeats: number): Draw | null {
	let chess: Chess;
	try {
		chess = new Chess(fen);
	} catch {
		return null;
	}
	if (chess.isCheckmate()) return null;
	const halfMoves = parseInt(fen.split(" ")[4] ?? "0");
	if (chess.isStalemate()) return { reason: "Stalemate", claimable: false };
	if (chess.isInsufficientMaterial()) return { reason: "Insufficient material", claimable: false };
	if (repeats >= 5) return { reason: "Fivefold repetition", claimable: false };
	if (halfMoves >= 150) return { reason: "75-move rule", claimable: false };
	if (repeats >= 3) return { reason: "Threefold repetition", claimable: true };
	if (halfMoves >= 100) return { reason: "Fifty-move rule", claimable: true };
	return null;
}

// The badge text, such as "1/2 Stalemate" or "1/2 claimable: threefold repetition".
export function drawLabel(draw: Draw): string {
	return draw.claimable ? "1/2 claimable: " + draw.reason.toLowerCase() : "1/2 " + draw.reason;
}
