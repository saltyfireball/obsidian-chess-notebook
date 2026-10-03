// Tells a FEN from a PGN, for the chess code block alias and anything else
// that gets text without a type:.

export type ChessFormat = "fen" | "pgn";

// The code block names rendered besides chessboard, each behind a setting.
export const BLOCK_ALIASES = ["chess", "pgn", "fen"] as const;
export type BlockAlias = (typeof BLOCK_ALIASES)[number];

export function looksLikeFen(text: string): boolean {
	const parts = text.split(/\s+/);
	if (parts.length < 1 || parts.length > 6) {
		return false;
	}
	const ranks = parts[0].split("/");
	return ranks.length === 8;
}

// "fen" when every line is a FEN, "pgn" when the text has [Tags] or move
// numbers, null when it is neither.
export function detectChessFormat(text: string): ChessFormat | null {
	const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
	if (lines.length === 0) return null;
	if (lines.every((l) => looksLikeFen(l))) return "fen";
	if (/^\[\w+\s+"/m.test(text.trim()) || /\b\d+\.\s*(\.\.\s*)?[a-hKQRBNO]/.test(text)) return "pgn";
	return null;
}

// The type an alias block renders as: pgn and fen are fixed, chess goes by
// the src: file's extension or the block's text, and falls back to FEN, so a
// bad FEN shows the FEN error.
export function aliasType(alias: BlockAlias, source: string, src: string | null = null): ChessFormat {
	if (alias === "pgn" || alias === "fen") return alias;
	const ext = /\.(pgn|fen)$/i.exec(src ?? "");
	if (ext) return ext[1].toLowerCase() as ChessFormat;
	return detectChessFormat(source) ?? "fen";
}
