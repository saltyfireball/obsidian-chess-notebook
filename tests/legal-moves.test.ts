import { describe, expect, it } from "vitest";
import { legalTargets } from "../src/legal-moves";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("legalTargets", () => {
	it("lists a knight's moves from the start", () => {
		expect(legalTargets(START, "g1").map((t) => t.square).sort()).toEqual(["f3", "h3"]);
	});

	it("is empty for a piece of the side not to move, or an empty square", () => {
		expect(legalTargets(START, "e7")).toEqual([]);
		expect(legalTargets(START, "e4")).toEqual([]);
	});

	it("marks captures", () => {
		const fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
		const targets = legalTargets(fen, "e4");
		expect(targets).toHaveLength(2);
		expect(targets).toEqual(expect.arrayContaining([
			{ square: "e5", capture: false },
			{ square: "d5", capture: true },
		]));
	});

	it("marks an en passant capture, though its square is empty", () => {
		const fen = "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3";
		expect(legalTargets(fen, "e5")).toEqual(expect.arrayContaining([
			{ square: "e6", capture: false },
			{ square: "f6", capture: true },
		]));
	});

	it("lists a promotion square once", () => {
		expect(legalTargets("8/4P3/8/8/8/8/k7/7K w - - 0 1", "e7")).toEqual([{ square: "e8", capture: false }]);
	});

	it("is empty for a FEN it cannot read", () => {
		expect(legalTargets("not a fen", "e2")).toEqual([]);
	});
});
