import { Chess } from "chess.js";
import { normalizeFen } from "./types";

// The square of the king of the side to move when it is in check, or null
// when it is not (or the FEN cannot be read).
export function checkedKingSquare(fen: string): string | null {
	let chess: Chess;
	try {
		chess = new Chess(normalizeFen(fen));
	} catch {
		return null;
	}
	if (!chess.inCheck()) return null;
	return chess.findPiece({ type: "k", color: chess.turn() })[0] ?? null;
}
