import type { MoveNode } from "./pgn-parser";

// An engine evaluation from [%eval]: pawns from White's side, or mate in
// `moves` (positive: White mates, negative: Black mates).
export type Evaluation = { kind: "cp"; pawns: number } | { kind: "mate"; moves: number; white: boolean };

const EVAL_REGEX = /\[%eval\s+([^\]\s,]+)[^\]]*\]/g;
const CLOCK_REGEX = /\[%clk\s+([^\]\s]+)\s*\]/g;

// "0.35", "-1.2", "+3", "#3", "#-2"; null for anything else.
export function parseEval(value: string): Evaluation | null {
	const mate = /^#([+-]?)(\d+)$/.exec(value);
	if (mate) {
		const moves = parseInt(mate[2]);
		return { kind: "mate", moves: mate[1] === "-" ? -moves : moves, white: mate[1] !== "-" };
	}
	if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(value)) return null;
	return { kind: "cp", pawns: parseFloat(value) };
}

// "0:03:00", "1:02:03.4", "4:59" to seconds; null for anything else.
export function parseClock(value: string): number | null {
	if (!/^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(value)) return null;
	return value.split(":").reduce((total, part) => total * 60 + parseFloat(part), 0);
}

// 3:00, 1:02:03, and tenths under ten seconds: 0:09.8.
export function formatClock(seconds: number): string {
	// In whole tenths, through hundredths first: 4.6 - 4 is 0.5999...
	const allTenths = Math.floor(Math.round(seconds * 100) / 10);
	const whole = Math.floor(allTenths / 10);
	const h = Math.floor(whole / 3600);
	const m = Math.floor((whole % 3600) / 60);
	const s = whole % 60;
	const ss = String(s).padStart(2, "0");
	const tenths = whole < 10 && allTenths % 10 !== 0 ? "." + (allTenths % 10) : "";
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}${tenths}`;
}

// "+0.4", "-1.2", "#3", "#-2".
export function evalLabel(evaluation: Evaluation): string {
	if (evaluation.kind === "mate") {
		return evaluation.white || evaluation.moves === 0 ? `#${Math.abs(evaluation.moves)}` : `#-${Math.abs(evaluation.moves)}`;
	}
	const pawns = Math.round(evaluation.pawns * 10) / 10;
	return (pawns > 0 ? "+" : "") + pawns.toFixed(1);
}

// White's share of the eval bar, 0 to 1. Mate scores are pinned to the end of
// the side that mates; pawn scores follow a winning-chances curve.
export function whiteShare(evaluation: Evaluation | null): number {
	if (evaluation === null) return 0.5;
	if (evaluation.kind === "mate") return evaluation.white ? 1 : 0;
	return 1 / (1 + Math.exp(-0.368208 * evaluation.pawns));
}

// Takes [%eval] and [%clk] out of a comment. The text left over is what is
// shown; null when the comment held nothing else.
export function extractEvalClock(comment: string | null): {
	text: string | null;
	evaluation: Evaluation | null;
	clock: number | null;
} {
	if (comment === null) return { text: null, evaluation: null, clock: null };
	let evaluation: Evaluation | null = null;
	let clock: number | null = null;
	const text = comment
		.replace(EVAL_REGEX, (_m, value: string) => {
			evaluation = parseEval(value) ?? evaluation;
			return " ";
		})
		.replace(CLOCK_REGEX, (_m, value: string) => {
			clock = parseClock(value) ?? clock;
			return " ";
		})
		.replace(/\s+/g, " ")
		.trim();
	return { text: text.length > 0 ? text : null, evaluation, clock };
}

// The moves from the start up to the viewer's move id ("m-3v0-2": the main
// line's moves before the variation, then the variation's first three).
export function pathTo(mainline: MoveNode[], id: string): MoveNode[] {
	return linePath(mainline, id).path;
}

// True for the start (null) and main-line move ids ("m-3"); variation ids
// carry a "v" ("m-0v0-1").
export function onMainline(id: string | null): boolean {
	return id === null || !id.includes("v");
}

// pathTo, plus where the innermost line starts in it: the moves before
// lineStart belong to the lines the variation branched from.
export function linePath(mainline: MoveNode[], id: string): { path: MoveNode[]; lineStart: number } {
	const path: MoveNode[] = [];
	let lineStart = 0;
	let line = mainline;
	let idx = -1;
	for (const part of id.slice(1).match(/-\d+|v\d+/g) ?? []) {
		const n = parseInt(part.slice(1));
		if (part[0] === "-") {
			idx = n;
			continue;
		}
		const parent = line[idx];
		if (!parent || !parent.variations[n]) break;
		const variation = parent.variations[n];
		// A variation replaces its parent move, unless it continues after it.
		const replaces = variation[0]?.color === parent.color;
		path.push(...line.slice(0, replaces ? idx : idx + 1));
		lineStart = path.length;
		line = variation;
		idx = -1;
	}
	path.push(...line.slice(0, idx + 1));
	return { path, lineStart };
}

// The latest eval and each side's latest clock along a line. The eval is
// taken from path[lineStart] on only, so a variation does not show the eval of
// the line it branched from. Stale: the eval is from a move before the last.
export function latestEvalClock(
	path: MoveNode[],
	lineStart = 0,
): {
	evaluation: Evaluation | null;
	stale: boolean;
	white: number | null;
	black: number | null;
} {
	let evaluation: Evaluation | null = null;
	let stale = false;
	let white: number | null = null;
	let black: number | null = null;
	for (let i = 0; i < path.length; i++) {
		const node = path[i];
		if (i >= lineStart) {
			if (node.evaluation) evaluation = moverMates(node.evaluation, node.color);
			stale = evaluation !== null && !node.evaluation;
		}
		if (node.clock !== null) {
			if (node.color === "w") white = node.clock;
			else black = node.clock;
		}
	}
	return { evaluation, stale, white, black };
}

// [%eval #0]: the side to move is mated, so the side that just moved mates.
function moverMates(evaluation: Evaluation, color: "w" | "b"): Evaluation {
	if (evaluation.kind !== "mate" || evaluation.moves !== 0) return evaluation;
	return { kind: "mate", moves: 0, white: color === "w" };
}

// Whether any move in the game or its variations carries an eval / a clock.
export function hasEvalClock(moves: MoveNode[]): { evaluation: boolean; clock: boolean } {
	const found = { evaluation: false, clock: false };
	const walk = (line: MoveNode[]): void => {
		for (const node of line) {
			if (node.evaluation) found.evaluation = true;
			if (node.clock !== null) found.clock = true;
			for (const v of node.variations) walk(v);
		}
	};
	walk(moves);
	return found;
}
