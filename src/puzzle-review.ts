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
// paragraph: a fence, list marker, quote or heading.
const BLOCK_START = /^(?:`{3,}|~{3,}|[-*+](?: |$)|\d{1,9}[.)](?: |$)|>|#{1,6}(?: |$))/;

// An open container a line has to continue: a callout ("> ") or a list item,
// whose content sits width columns in from where the item starts.
type Container = { quote: true } | { quote: false; width: number };

// A line with the tabs in its structure (the indentation, callout markers and
// list markers it starts with) expanded to four-column tab stops, so a column
// is a character.
function expandIndent(line: string): string {
	const lead = /^[ \t>*+\-\d.)]*/.exec(line)?.[0] ?? "";
	if (!lead.includes("\t")) return line;
	let out = "";
	for (const ch of lead) out += ch === "\t" ? " ".repeat(4 - (out.length % 4)) : ch;
	return out + line.slice(lead.length);
}

// The number of spaces a line starts with.
function indentOf(line: string): number {
	return /^ */.exec(line)?.[0].length ?? 0;
}

// How far into line its open containers reach, in order: a callout needs its
// marker (up to three spaces in), a list item its content indentation or a
// blank line. matched counts the containers the line continues.
function continueContainers(line: string, stack: readonly Container[]): { matched: number; pos: number } {
	let pos = 0;
	let matched = 0;
	for (const c of stack) {
		const rest = line.slice(pos);
		if (c.quote) {
			const m = /^ {0,3}> ?/.exec(rest);
			if (!m) break;
			pos += m[0].length;
		} else if (rest.trim() !== "") {
			if (indentOf(rest) < c.width) break;
			pos += c.width;
		} else {
			pos += Math.min(rest.length, c.width);
		}
		matched++;
	}
	return { matched, pos };
}

// Every code block in languages (lower-case, default chessboard) in a note,
// in order, read the way CommonMark reads fences: a fence sits at most three
// spaces in from its container (the note, a list item's content or a
// callout, nested in any order), so one indented four or more is indented
// code; it closes on a fence of the same character at least as long, as
// indented, in the same container; and the text inside any other fence (an
// example in a ```md or ```` block) is not a block. An unclosed block runs to
// the end of the note, or to the end of its callout or list item, as
// Obsidian renders it, and the line that ends the container is read again.
export function findChessBlocks(text: string, languages: readonly string[] = ["chessboard"]): ChessBlock[] {
	const lines = text.split(/\r?\n/).map(expandIndent);
	const blocks: ChessBlock[] = [];
	// The open callouts and list items, outermost first.
	let stack: Container[] = [];
	// Whether the last line was paragraph text, which a line that does not
	// continue every container may continue lazily without ending them.
	let paragraph = false;
	let i = 0;
	while (i < lines.length) {
		const raw = lines[i];
		i++;
		const { matched, pos } = continueContainers(raw, stack);
		let line = raw.slice(pos);
		if (matched < stack.length) {
			const start = line.trimStart();
			const lazy = paragraph && start !== "" && (indentOf(line) > 3 || (!BLOCK_START.test(start) && !BREAK.test(start)));
			if (lazy) continue;
			stack = stack.slice(0, matched);
		}
		// Each callout marker or list marker opens a container inside the last.
		for (;;) {
			const col = indentOf(line);
			const after = line.slice(col);
			if (col > 3 || BREAK.test(after)) break;
			if (after.startsWith(">")) {
				stack.push({ quote: true });
				line = after.slice(after.startsWith("> ") ? 2 : 1);
				paragraph = false;
				continue;
			}
			const m = LIST_MARKER.exec(after);
			if (!m) break;
			const spaces = m[2].length;
			// Five or more spaces after the marker: the content starts after one
			// and the rest indent it.
			const gap = spaces === 0 ? 0 : spaces > 4 ? 1 : spaces;
			stack.push({ quote: false, width: col + m[1].length + (gap || 1) });
			line = after.slice(m[1].length + gap);
			paragraph = false;
		}
		if (line.trim() === "") {
			paragraph = false;
			continue;
		}
		const indent = indentOf(line);
		line = line.slice(indent);
		if (indent <= 3 && BREAK.test(line)) {
			paragraph = false;
			continue;
		}
		const open = indent <= 3 ? FENCE.exec(line) : null;
		// A backtick fence's info string may not hold a backtick.
		if (!open || (open[1][0] === "`" && open[2].includes("`"))) {
			if (indent <= 3) paragraph = !/^#{1,6}(?: |$)/.test(line);
			continue;
		}
		paragraph = false;
		const fence = open[1];
		const info = open[2].trim();
		const language = info.split(/\s/)[0].toLowerCase();
		const close = new RegExp("^ {0,3}" + (fence[0] === "`" ? "`" : "~") + "{" + fence.length + ",}[ \\t]*$");
		const body: string[] = [];
		let closed = false;
		let end = i;
		for (; end < lines.length; end++) {
			const inner = continueContainers(lines[end], stack);
			// The block ends with its callout or list item.
			if (inner.matched < stack.length) break;
			const own = lines[end].slice(inner.pos);
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

// The options of a language block in text whose source is source, or "" when
// none matches. For a render that has no section info (PDF export): blocks
// with the same source are told apart by order, occurrence 0 being the first.
// An occurrence past the last wraps around.
export function fenceLineFor(text: string, language: string, source: string, occurrence = 0): string {
	const wanted = source.trim();
	const matches = findChessBlocks(text, [language]).filter((b) => b.source.trim() === wanted);
	if (matches.length === 0) return "";
	return matches[occurrence % matches.length].fenceLine;
}

// Counts, per note, how many times each block source has been rendered
// without section info, so the nth render of a source gets the nth block that
// has it. A note rendered again after gapMs of quiet starts from zero: a new
// export pass.
export class SourceOccurrences {
	private notes = new Map<string, { last: number; counts: Map<string, number> }>();

	constructor(private gapMs = 2000) {}

	// The occurrence of this render: 0 for the first of the pass, then 1, ...
	next(path: string, language: string, source: string, now: number): number {
		for (const [p, note] of this.notes) {
			if (now - note.last > this.gapMs) this.notes.delete(p);
		}
		let note = this.notes.get(path);
		if (!note) {
			note = { last: now, counts: new Map() };
			this.notes.set(path, note);
		}
		note.last = now;
		const key = language + "\n" + source.trim();
		const occurrence = note.counts.get(key) ?? 0;
		note.counts.set(key, occurrence + 1);
		return occurrence;
	}
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
