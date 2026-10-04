import type { MoveNode } from "./pgn-parser";

// Where a drill run is in the PGN: before line[idx]. The line is the mainline
// or a variation the run has gone into.
export interface DrillCursor {
	line: MoveNode[];
	idx: number;
}

export interface DrillChoice {
	node: MoveNode;
	next: DrillCursor;
	// True for the move the line itself gives, false for a variation's.
	main: boolean;
}

// The moves the PGN gives from the cursor, all by the side to move: the
// line's own next move first, then every alternative to it. A variation on a
// move by the same side replaces that move; a variation on a move by the other
// side continues after it (1.e4 (1...c5) e5), so it is offered at the cursor
// after its parent. Variations nested on an alternative's first move are
// alternatives too.
export function drillChoices(cursor: DrillCursor): DrillChoice[] {
	const node = cursor.line[cursor.idx];
	const prev = cursor.idx > 0 ? cursor.line[cursor.idx - 1] : null;
	const side = prev ? (prev.color === "w" ? "b" : "w") : node?.color;
	if (!side) return [];

	const choices: DrillChoice[] = [];
	const addVariations = (variations: MoveNode[][]): void => {
		for (const variation of variations) {
			const first = variation[0];
			if (!first || first.color !== side) continue;
			choices.push({ node: first, next: { line: variation, idx: 1 }, main: false });
			addVariations(first.variations);
		}
	};
	if (node && node.color === side) {
		choices.push({ node, next: { line: cursor.line, idx: cursor.idx + 1 }, main: true });
		addVariations(node.variations);
	}
	if (prev) addVariations(prev.variations);
	return choices;
}

// The choice that matches a played move, if the PGN has it.
export function findChoice(choices: DrillChoice[], from: string, to: string): DrillChoice | null {
	return choices.find((c) => c.node.from === from && c.node.to === to) ?? null;
}

// One of the choices at random: the board's reply, so each run can take a
// different line. random returns [0, 1) like Math.random.
export function pickChoice(choices: DrillChoice[], random: () => number): DrillChoice | null {
	if (choices.length === 0) return null;
	return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

// Counts drill (or puzzle) runs so a callback timed in one run does nothing
// once another has started (Restart, Reset) or the mode is left.
export class DrillRuns {
	private current = 0;

	next(): void {
		this.current++;
	}

	// fn, bound to the run it was made in: calling it later in another run is
	// a no-op.
	guard(fn: () => void): () => void {
		const run = this.current;
		return () => {
			if (run === this.current) fn();
		};
	}
}
