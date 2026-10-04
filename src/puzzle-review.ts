import { parsePgn } from "./pgn-parser";

// A chess code block found in a note's text.
export interface ChessBlock {
	// The block's language as written on the fence, lower-cased: "chessboard" or an alias.
	language: string;
	// What follows the language on the opening fence, trimmed: the block's options.
	fenceLine: string;
	// The lines between the fences.
	source: string;
	// Zero-based line of the opening fence in the note.
	line: number;
}

// An opening fence after its callout markers: an optional list marker, then
// the fence and its info string.
const OPEN_FENCE = /^(\s*(?:(?:[-*+]|\d{1,9}[.)])\s+)?\s*)(`{3,}|~{3,})(.*)$/;

// Strips up to max callout markers ("> ") from a line.
function stripQuotes(line: string, max: number): { depth: number; rest: string } {
	let depth = 0;
	let rest = line;
	while (depth < max) {
		const m = /^ {0,3}> ?/.exec(rest);
		if (!m) break;
		rest = rest.slice(m[0].length);
		depth++;
	}
	return { depth, rest };
}

// Every code block in languages (lower-case, default chessboard) in a note,
// in order, read the way CommonMark reads fences: a fence may be indented, in
// a list item or in a callout; it closes on a fence of the same character at
// least as long, in the same callout; and the text inside any other fence
// (an example in a ```md or ```` block) is not a block. An unclosed block
// runs to the end of the note, or of its callout, as Obsidian renders it.
export function findChessBlocks(text: string, languages: readonly string[] = ["chessboard"]): ChessBlock[] {
	const lines = text.split(/\r?\n/);
	const blocks: ChessBlock[] = [];
	let i = 0;
	while (i < lines.length) {
		const { depth, rest } = stripQuotes(lines[i], Infinity);
		const open = OPEN_FENCE.exec(rest);
		// A backtick fence's info string may not hold a backtick.
		if (!open || (open[2][0] === "`" && open[3].includes("`"))) {
			i++;
			continue;
		}
		const indent = open[1].length;
		const fence = open[2];
		const info = open[3].trim();
		const language = info.split(/\s/)[0].toLowerCase();
		const close = new RegExp("^\\s*" + (fence[0] === "`" ? "`" : "~") + "{" + fence.length + ",}\\s*$");
		const body: string[] = [];
		let end = i + 1;
		for (; end < lines.length; end++) {
			const inner = stripQuotes(lines[end], depth);
			if (inner.depth < depth || close.test(inner.rest)) break;
			// Content loses up to the opening fence's indentation.
			body.push(inner.rest.replace(new RegExp("^ {0," + indent + "}"), ""));
		}
		if (languages.includes(language)) {
			blocks.push({ language, fenceLine: info.slice(language.length).trim(), source: body.join("\n"), line: i });
		}
		// A callout that ended leaves its closing line to be read again.
		i = end < lines.length && stripQuotes(lines[end], depth).depth < depth ? end : end + 1;
	}
	return blocks;
}

// Whether a puzzle's PGN has moves to play: a malformed one is not a puzzle.
export function isPlayablePgn(pgn: string): boolean {
	try {
		return parsePgn(pgn).moves.length > 0;
	} catch {
		return false;
	}
}

// Runs fn over items in batches of size, each batch in parallel, and calls
// onBatch with how many are done after each. Results keep the input order.
export async function mapInBatches<T, R>(
	items: readonly T[],
	size: number,
	fn: (item: T) => Promise<R>,
	onBatch?: (done: number) => void,
): Promise<R[]> {
	const out: R[] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
		onBatch?.(out.length);
	}
	return out;
}

// A shuffled copy of items (Fisher-Yates). random returns [0, 1) like Math.random.
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
	const out = items.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.min(i, Math.floor(random() * (i + 1)));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

// "Puzzle 3 of 12" for the puzzle at index 2.
export function reviewCount(index: number, total: number): string {
	return "Puzzle " + (index + 1) + " of " + total;
}
