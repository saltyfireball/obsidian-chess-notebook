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

// A list item's marker and the spaces after it: "- ", "1. ", "10) ", or a
// marker that ends the line.
const LIST_MARKER = /^([-*+]|\d{1,9}[.)])( +|$)/;
// A fence and its info string, once the indentation is gone.
const FENCE = /^(`{3,}|~{3,})(.*)$/;
// A thematic break: three or more -, * or _, spaces allowed between.
const BREAK = /^([-*_])(?: *\1){2,} *$/;
// A line that starts a block of its own, so it cannot be a lazy line of a
// paragraph in a list item: a fence, list marker, quote or heading.
const BLOCK_START = /^(?:`{3,}|~{3,}|[-*+](?: |$)|\d{1,9}[.)](?: |$)|>|#{1,6}(?: |$))/;

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

// A line with the tabs in its indentation expanded to four-column tab stops.
function expandIndent(line: string): string {
	const lead = /^[ \t]*/.exec(line)?.[0] ?? "";
	if (!lead.includes("\t")) return line;
	let out = "";
	for (const ch of lead) out += ch === "\t" ? " ".repeat(4 - (out.length % 4)) : ch;
	return out + line.slice(lead.length);
}

// The number of spaces a line starts with.
function indentOf(line: string): number {
	return /^ */.exec(line)?.[0].length ?? 0;
}

// Every code block in languages (lower-case, default chessboard) in a note,
// in order, read the way CommonMark reads fences: a fence sits at most three
// spaces in from its container (the note, a list item's content or a
// callout), so one indented four or more is indented code; it closes on a
// fence of the same character at least as long, as indented, in the same
// container; and the text inside any other fence (an example in a ```md or
// ```` block) is not a block. An unclosed block runs to the end of the note,
// or to the end of its callout or list item, as Obsidian renders it, and the
// line that ends the container is read again.
export function findChessBlocks(text: string, languages: readonly string[] = ["chessboard"]): ChessBlock[] {
	const lines = text.split(/\r?\n/);
	const blocks: ChessBlock[] = [];
	// The content columns of the open list items, innermost last, in the
	// callout depth they were opened at.
	let items: number[] = [];
	let itemsDepth = 0;
	// Whether the last line was paragraph text, which a less indented line may
	// continue lazily without ending its list item.
	let paragraph = false;
	let i = 0;
	while (i < lines.length) {
		const quoted = stripQuotes(lines[i], Infinity);
		const depth = quoted.depth;
		const rest = expandIndent(quoted.rest);
		i++;
		if (depth !== itemsDepth) {
			items = [];
			itemsDepth = depth;
			paragraph = false;
		}
		if (rest.trim() === "") {
			paragraph = false;
			continue;
		}
		let col = indentOf(rest);
		let line = rest.slice(col);
		const lazy = paragraph && items.length > 0 && col < items[items.length - 1];
		if (lazy && !BLOCK_START.test(line) && !BREAK.test(line)) continue;
		while (items.length && col < items[items.length - 1]) items.pop();
		let base = items.length ? items[items.length - 1] : 0;
		if (col - base <= 3 && BREAK.test(line)) {
			paragraph = false;
			continue;
		}
		// Each list marker opens an item whose content starts after it.
		for (let m = LIST_MARKER.exec(line); m && col - base <= 3; m = LIST_MARKER.exec(line)) {
			const spaces = m[2].length;
			base = col + m[1].length + (spaces === 0 || spaces > 4 ? 1 : spaces);
			items.push(base);
			col += m[0].length;
			line = line.slice(m[0].length);
		}
		const open = col - base <= 3 ? FENCE.exec(line) : null;
		// A backtick fence's info string may not hold a backtick.
		if (!open || (open[1][0] === "`" && open[2].includes("`"))) {
			if (line !== "") paragraph = col - base <= 3 ? !/^#{1,6}(?: |$)/.test(line) : paragraph;
			continue;
		}
		paragraph = false;
		const indent = col - base;
		const fence = open[1];
		const info = open[2].trim();
		const language = info.split(/\s/)[0].toLowerCase();
		const close = new RegExp("^ {0,3}" + (fence[0] === "`" ? "`" : "~") + "{" + fence.length + ",}[ \\t]*$");
		const body: string[] = [];
		let closed = false;
		let end = i;
		for (; end < lines.length; end++) {
			const inner = stripQuotes(lines[end], depth);
			// The block ends with its callout.
			if (inner.depth < depth) break;
			const content = expandIndent(inner.rest);
			const lead = indentOf(content);
			// The block ends with its list item: a line less indented than the item's content.
			if (lead < base && content.trim() !== "") break;
			const own = content.slice(Math.min(lead, base));
			if (close.test(own)) {
				closed = true;
				break;
			}
			// Content loses up to the opening fence's indentation.
			body.push(own.replace(new RegExp("^ {0," + indent + "}"), ""));
		}
		if (languages.includes(language)) {
			blocks.push({ language, fenceLine: info.slice(language.length).trim(), source: body.join("\n"), line: i - 1 });
		}
		// A container that ended leaves its closing line to be read again.
		i = closed ? end + 1 : end;
	}
	return blocks;
}

// The options of the first language block in text whose source is source,
// or "" when none matches. For a render that has no section info (PDF export):
// two blocks with the same source and different options get the first's.
export function fenceLineFor(text: string, language: string, source: string): string {
	const wanted = source.trim();
	return findChessBlocks(text, [language]).find((b) => b.source.trim() === wanted)?.fenceLine ?? "";
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
