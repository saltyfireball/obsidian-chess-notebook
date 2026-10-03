// A chessboard code block found in a note's text.
export interface ChessBlock {
	// What follows "chessboard" on the opening fence, trimmed: the block's options.
	fenceLine: string;
	// The lines between the fences.
	source: string;
	// Zero-based line of the opening fence in the note.
	line: number;
}

const OPEN_FENCE = /^(`{3,}|~{3,})\s*chessboard\b\s*(.*)$/i;

// Every chessboard block in a note, in order. A block closes on a fence of
// the same character at least as long as its opening one; an unclosed block
// runs to the end of the note, as Obsidian renders it.
export function findChessBlocks(text: string): ChessBlock[] {
	const lines = text.split(/\r?\n/);
	const blocks: ChessBlock[] = [];
	let i = 0;
	while (i < lines.length) {
		const open = OPEN_FENCE.exec(lines[i]);
		if (!open) {
			i++;
			continue;
		}
		const fence = open[1];
		const close = new RegExp("^" + (fence[0] === "`" ? "`" : "~") + "{" + fence.length + ",}\\s*$");
		let end = i + 1;
		while (end < lines.length && !close.test(lines[end])) end++;
		blocks.push({ fenceLine: open[2].trim(), source: lines.slice(i + 1, end).join("\n"), line: i });
		i = end + 1;
	}
	return blocks;
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
