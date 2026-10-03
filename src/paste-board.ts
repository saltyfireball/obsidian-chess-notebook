import { detectChessFormat } from "./chess-format";

// True when line `at` is inside a fenced code block or opens one, so a paste
// there would edit that block. A fence opens and closes with the same
// character, and the closing run is at least as long as the opening one.
export function insideCodeBlock(lines: string[], at: number): boolean {
	let open: string | null = null;
	for (let i = 0; i <= at && i < lines.length; i++) {
		const m = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[i]);
		if (!m) continue;
		if (open === null) open = m[1];
		else if (m[1][0] === open[0] && m[1].length >= open.length && lines[i].trim() === m[1]) open = null;
	}
	return open !== null;
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
