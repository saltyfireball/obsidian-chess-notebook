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
