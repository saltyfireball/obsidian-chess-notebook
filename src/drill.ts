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

// The moves the PGN gives from the cursor: the line's own next move first,
// then the first move of each variation on it. A variation's MoveNode list
// starts with the alternative to line[idx].
export function drillChoices(cursor: DrillCursor): DrillChoice[] {
	const node = cursor.line[cursor.idx];
	if (!node) return [];
	const choices: DrillChoice[] = [{ node, next: { line: cursor.line, idx: cursor.idx + 1 }, main: true }];
	for (const variation of node.variations) {
		if (variation.length > 0) {
			choices.push({ node: variation[0], next: { line: variation, idx: 1 }, main: false });
		}
	}
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
