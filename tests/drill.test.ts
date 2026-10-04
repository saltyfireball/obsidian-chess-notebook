import { describe, expect, it } from "vitest";
import { drillChoices, findChoice, pickChoice } from "../src/drill";
import { parsePgn } from "../src/pgn-parser";

const ITALIAN = "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 (3...Nf6 4.Ng5 d5) (3...Be7) 4.c3 *";

describe("drillChoices", () => {
	const moves = parsePgn(ITALIAN).moves;

	it("gives the line's move first, then each variation's first move", () => {
		const choices = drillChoices({ line: moves, idx: 5 });
		expect(choices.map((c) => c.node.san)).toEqual(["Bc5", "Nf6", "Be7"]);
		expect(choices.map((c) => c.main)).toEqual([true, false, false]);
	});

	it("continues inside the variation it went into", () => {
		const nf6 = drillChoices({ line: moves, idx: 5 })[1];
		const after = drillChoices(nf6.next);
		expect(after.map((c) => c.node.san)).toEqual(["Ng5"]);
		expect(drillChoices(drillChoices(after[0].next)[0].next)).toEqual([]);
	});

	it("is empty past the end of the line", () => {
		expect(drillChoices({ line: moves, idx: moves.length })).toEqual([]);
	});
});

describe("findChoice", () => {
	it("matches a move by its squares", () => {
		const choices = drillChoices({ line: parsePgn(ITALIAN).moves, idx: 5 });
		expect(findChoice(choices, "g8", "f6")?.node.san).toBe("Nf6");
		expect(findChoice(choices, "d7", "d6")).toBeNull();
	});
});

describe("pickChoice", () => {
	const choices = drillChoices({ line: parsePgn(ITALIAN).moves, idx: 5 });

	it("spreads the pick over every choice", () => {
		expect(pickChoice(choices, () => 0)?.node.san).toBe("Bc5");
		expect(pickChoice(choices, () => 0.5)?.node.san).toBe("Nf6");
		expect(pickChoice(choices, () => 0.999)?.node.san).toBe("Be7");
	});

	it("returns null when there is nothing to pick", () => {
		expect(pickChoice([], () => 0)).toBeNull();
	});
});

describe("drillChoices nested alternatives", () => {
	it("offers a variation nested on another variation's first move", () => {
		const moves = parsePgn("1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 (3...Nf6 (3...Be7) 4.Ng5) 4.c3 *").moves;
		const choices = drillChoices({ line: moves, idx: 5 });
		expect(choices.map((c) => c.node.san)).toEqual(["Bc5", "Nf6", "Be7"]);
		expect(drillChoices(choices[1].next).map((c) => c.node.san)).toEqual(["Ng5"]);
	});

	it("collects nesting at any depth", () => {
		const moves = parsePgn("1.e4 (1.d4 (1.c4 (1.Nf3)) d5) e5 *").moves;
		const choices = drillChoices({ line: moves, idx: 0 });
		expect(choices.map((c) => c.node.san)).toEqual(["e4", "d4", "c4", "Nf3"]);
		expect(drillChoices(choices[1].next).map((c) => c.node.san)).toEqual(["d5"]);
		expect(drillChoices(choices[3].next)).toEqual([]);
	});
});

describe("drillChoices continuation variations", () => {
	const moves = parsePgn("1.e4 (1...c5 2.Nf3) e5 2.Nf3 *").moves;

	it("offers only the side to move", () => {
		const start = drillChoices({ line: moves, idx: 0 });
		expect(start.map((c) => c.node.san)).toEqual(["e4"]);
	});

	it("offers the continuation after its parent, beside the line's move", () => {
		const after = drillChoices(drillChoices({ line: moves, idx: 0 })[0].next);
		expect(after.map((c) => c.node.san)).toEqual(["e5", "c5"]);
		expect(after.map((c) => c.main)).toEqual([true, false]);
		expect(drillChoices(after[1].next).map((c) => c.node.san)).toEqual(["Nf3"]);
	});

	it("offers a continuation at the end of a line", () => {
		const line = parsePgn("1.e4 e5 2.Nf3 (2...Nc6 3.Bb5) *").moves;
		const end = drillChoices({ line, idx: line.length });
		expect(end.map((c) => c.node.san)).toEqual(["Nc6"]);
		expect(end[0].main).toBe(false);
	});

	it("works for a continuation on Black's move with White to reply", () => {
		const line = parsePgn("1.e4 e5 (2.d4 exd4) 2.Nf3 *").moves;
		expect(drillChoices({ line, idx: 1 }).map((c) => c.node.san)).toEqual(["e5"]);
		expect(drillChoices({ line, idx: 2 }).map((c) => c.node.san)).toEqual(["Nf3", "d4"]);
	});
});
