// Text for screen readers: the move announced as you step through a game,
// and the label of each square on the board.

const PIECE_NAMES: Record<string, string> = {
	K: "king",
	Q: "queen",
	R: "rook",
	B: "bishop",
	N: "knight",
	P: "pawn",
};

const SAN_MOVE = /^([KQRBN])?[a-h]?[1-8]?(x)?([a-h][1-8])(?:=?([QRBN]))?$/;

// "12. Nf3, knight to f3", "12... exd4, pawn takes d4", "30. Qh7#, queen to h7, checkmate".
export function moveSpeech(san: string, color: "w" | "b", moveNumber: number): string {
	const prefix = moveNumber + (color === "w" ? ". " : "... ") + san;
	const clean = san.replace(/[!?]+$/, "");
	const body = clean.replace(/[+#]+$/, "");
	const parts = [prefix];

	if (/^[O0]-[O0]-[O0]$/.test(body)) {
		parts.push("castles queenside");
	} else if (/^[O0]-[O0]$/.test(body)) {
		parts.push("castles kingside");
	} else {
		const m = SAN_MOVE.exec(body);
		if (m) {
			const piece = PIECE_NAMES[m[1] ?? "P"];
			parts.push(piece + (m[2] ? " takes " : " to ") + m[3]);
			if (m[4]) parts.push("promotes to " + PIECE_NAMES[m[4]]);
		}
	}

	if (clean.endsWith("#")) parts.push("checkmate");
	else if (clean.endsWith("+")) parts.push("check");
	return parts.join(", ");
}

export const START_SPEECH = "Start position";

// piece is the board's code for it, e.g. "wn" for a white knight.
export function squareLabel(square: string, piece: string | null): string {
	if (!piece || piece.length !== 2) return square + ", empty";
	const color = piece[0] === "w" ? "white" : "black";
	const name = PIECE_NAMES[piece[1].toUpperCase()] ?? piece;
	return `${square}, ${color} ${name}`;
}
