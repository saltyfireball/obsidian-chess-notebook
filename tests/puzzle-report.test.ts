import { describe, expect, it } from "vitest";
import { moveLabel, PuzzleTally } from "../src/puzzle-report";

describe("PuzzleTally", () => {
	it("counts moves played and every wrong try", () => {
		const tally = new PuzzleTally();
		tally.recordWrong(4);
		tally.recordWrong(0);
		tally.recordWrong(4);
		tally.recordCorrect(0);
		tally.recordCorrect(2);
		tally.recordCorrect(4);
		expect(tally.movesPlayed).toBe(3);
		expect(tally.mistakes).toBe(3);
		expect(tally.mistakeMoves()).toEqual([
			{ idx: 0, count: 1 },
			{ idx: 4, count: 2 },
		]);
	});

	it("does not count a move twice when it is replayed", () => {
		const tally = new PuzzleTally();
		tally.recordCorrect(1);
		tally.recordCorrect(1);
		expect(tally.movesPlayed).toBe(1);
	});

	it("starts over on reset", () => {
		const tally = new PuzzleTally();
		tally.recordCorrect(1);
		tally.recordWrong(1);
		tally.reset();
		expect(tally.movesPlayed).toBe(0);
		expect(tally.mistakes).toBe(0);
		expect(tally.mistakeMoves()).toEqual([]);
	});
});

describe("moveLabel", () => {
	it("numbers white and black moves", () => {
		expect(moveLabel(12, "w", "Nf3")).toBe("12. Nf3");
		expect(moveLabel(12, "b", "Nc6")).toBe("12... Nc6");
	});
});
