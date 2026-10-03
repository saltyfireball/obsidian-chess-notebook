import type { ArrowType, MarkerType } from "cm-chessboard/src/Chessboard.js";

export interface ChessSettings {
	boardTheme: string;
	showCoordinates: boolean;
	animationDuration: number;
	autoPlaySpeed: number;
	fanPieceSet: string;
	moveSounds: boolean;
	soundVolume: number;
	announceMoves: boolean;
	// Also render chess, pgn and fen code blocks. Read once at load.
	chessBlocks: boolean;
	pgnBlocks: boolean;
	fenBlocks: boolean;
	// small, medium or large; a block's size: option overrides it.
	boardSize: string;
}

export const DEFAULT_SETTINGS: ChessSettings = {
	boardTheme: "sfb-chess",
	showCoordinates: true,
	animationDuration: 200,
	autoPlaySpeed: 1500,
	fanPieceSet: "standard",
	moveSounds: false,
	soundVolume: 50,
	announceMoves: false,
	chessBlocks: true,
	pgnBlocks: true,
	fenBlocks: true,
	boardSize: "medium",
};

export type ChessMode = "normal" | "puzzle" | "step" | "drill";

export type Notation = "san" | "fan";

// A number is a zero-based index: a mainline half-move in a PGN (0 is the
// position after White's first move), a step in a FEN sequence. Kept as an
// index so existing notes keep opening on the same position.
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
	// Board width in pixels from size:; null: the settings default.
	size: number | null;
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
}

export const HINT_FROM_LIGHT: MarkerType = {
	class: "marker-hint-from-light",
	slice: "markerSquare",
};

export const HINT_FROM_DARK: MarkerType = {
	class: "marker-hint-from-dark",
	slice: "markerSquare",
};

// Where the picked-up piece can go in puzzle and drill mode: a dot on an
// empty square, a ring around a piece it can take.
export const LEGAL_MOVE_DOT: MarkerType = {
	class: "marker-legal-dot",
	slice: "markerDot",
	position: "above",
};

export const LEGAL_MOVE_CAPTURE: MarkerType = {
	class: "marker-legal-capture",
	slice: "markerCircle",
	position: "above",
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

// The square of a king in check.
export const CHECK_MARKER: MarkerType = {
	class: "marker-check",
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
