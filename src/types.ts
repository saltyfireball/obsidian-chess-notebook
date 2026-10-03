import type { ArrowType, MarkerType } from "cm-chessboard/src/Chessboard.js";

export interface ChessSettings {
	boardTheme: string;
	showCoordinates: boolean;
	animationDuration: number;
	autoPlaySpeed: number;
	fanPieceSet: string;
}

export const DEFAULT_SETTINGS: ChessSettings = {
	boardTheme: "sfb-chess",
	showCoordinates: true,
	animationDuration: 200,
	autoPlaySpeed: 1500,
	fanPieceSet: "standard",
};

export type ChessMode = "normal" | "puzzle" | "step" | "drill";

export type Notation = "san" | "fan";

export type StartAt = "start" | "end" | number;

export interface CodeBlockOptions {
	center: boolean;
	mode: ChessMode;
	startAt: StartAt;
	flipped: boolean;
	// The side you play in drill mode; null: White, or Black when flipped.
	color: "w" | "b" | null;
	notation: Notation;
	pieces: string | null;
	title: string | null;
	white: string | null;
	black: string | null;
	event: string | null;
	site: string | null;
	date: string | null;
	round: string | null;
	eco: string | null;
	result: string | null;
	src: string | null;
	// The game to open in a PGN with several: 1-based number or "White vs Black".
	game: number | string | null;
}

export const HINT_FROM_LIGHT: MarkerType = {
	class: "marker-hint-from-light",
	slice: "markerSquare",
};

export const HINT_FROM_DARK: MarkerType = {
	class: "marker-hint-from-dark",
	slice: "markerSquare",
};

// The last hint step: the move to find, as an arrow.
export const HINT_ARROW: ArrowType = { class: "arrow-hint" };

// A drill move the PGN does not contain, shown before it is undone.
export const WRONG_ARROW: ArrowType = { class: "arrow-wrong" };

export interface ParsedCodeBlock {
	type: "fen" | "pgn";
	content: string;
	options: CodeBlockOptions;
}

export interface MoveInfo {
	index: number;
	san: string;
	fenAfter: string;
	from: string;
	to: string;
	color: "w" | "b";
	moveNumber: number;
	comment: string | null;
}

export interface PgnHeaders {
	event: string | null;
	site: string | null;
	white: string | null;
	black: string | null;
	result: string | null;
	date: string | null;
	round: string | null;
	eco: string | null;
}

export const LAST_MOVE_LIGHT: MarkerType = {
	class: "marker-lastmove-light",
	slice: "markerSquare",
};

export const LAST_MOVE_DARK: MarkerType = {
	class: "marker-lastmove-dark",
	slice: "markerSquare",
};

// Drawings from [%cal] and [%csl] in PGN comments, one type per colour letter.
export const SHAPE_ARROWS: Record<string, ArrowType> = {
	G: { class: "arrow-pgn-green" },
	R: { class: "arrow-pgn-red" },
	Y: { class: "arrow-pgn-yellow" },
	B: { class: "arrow-pgn-blue" },
};

export const SHAPE_SQUARES: Record<string, MarkerType> = {
	G: { class: "marker-pgn-green", slice: "markerSquare" },
	R: { class: "marker-pgn-red", slice: "markerSquare" },
	Y: { class: "marker-pgn-yellow", slice: "markerSquare" },
	B: { class: "marker-pgn-blue", slice: "markerSquare" },
};

export function isLightSquare(square: string): boolean {
	const file = square.charCodeAt(0) - 97;
	const rank = parseInt(square[1]) - 1;
	return (file + rank) % 2 !== 0;
}

// Pads a short FEN (e.g. board placement only, as printed in books) out to the
// six space-delimited fields chess.js requires. Fields already present win.
export function normalizeFen(fen: string): string {
	const parts = fen.trim().split(/\s+/).filter((p) => p.length > 0);
	if (parts.length === 0) {
		return fen;
	}
	const defaults = ["w", "-", "-", "0", "1"];
	return parts.slice(0, 6).concat(defaults.slice(parts.length - 1)).join(" ");
}
