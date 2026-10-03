import { detectChessFormat } from "./chess-format";

type FenceState = "in" | "close" | null;

// Each line's place in the fenced code blocks of lines up to `last`: "in"
// for a line inside a block or opening one, "close" for a closing fence,
// null outside. A fence opens and closes with the same character, and the
// closing run is at least as long as the opening one.
function fenceStates(lines: string[], last: number): FenceState[] {
	const states: FenceState[] = [];
	let open: string | null = null;
	for (let i = 0; i <= last && i < lines.length; i++) {
		const m = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[i]);
		if (open !== null && m && m[1][0] === open[0] && m[1].length >= open.length && lines[i].trim() === m[1]) {
			open = null;
			states.push("close");
			continue;
		}
		if (open === null && m) open = m[1];
		states.push(open !== null ? "in" : null);
	}
	return states;
}

// True when line `at` is inside a fenced code block or opens one, so a paste
// there would edit that block.
export function insideCodeBlock(lines: string[], at: number): boolean {
	return fenceStates(lines, at)[at] === "in";
}

export interface EditorPos {
	line: number;
	ch: number;
}

// True when replacing the text from..to would edit a fenced code block: a
// line in the range is inside or opens one, or an end of the range sits on a
// closing fence before its end (before the backticks is still in the block).
export function editsCodeBlock(lines: string[], from: EditorPos, to: EditorPos): boolean {
	const states = fenceStates(lines, to.line);
	for (let i = from.line; i <= to.line; i++) {
		if (states[i] === "in") return true;
	}
	for (const pos of [from, to]) {
		if (states[pos.line] === "close" && pos.ch < lines[pos.line].trimEnd().length) return true;
	}
	return false;
}

// The chessboard block for pasted text, or null when the text is neither a
// FEN nor a PGN. midLine starts the block on a new line, since a fence must
// open a line.
export function boardBlockFor(text: string, midLine = false): string | null {
	const content = text.replace(/\r\n?/g, "\n").trim();
	const type = detectChessFormat(content);
	if (!type) return null;
	// The fence must be longer than any backtick run inside, or it closes early.
	const longest = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
	const fence = "`".repeat(Math.max(3, longest + 1));
	return `${midLine ? "\n" : ""}${fence}chessboard type:${type}\n${content}\n${fence}\n`;
}
