import { describe, expect, it } from "vitest";
import { parsePgn } from "../src/pgn-parser";
import { normalizeFen } from "../src/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("parsePgn", () => {
	it("reads headers and the mainline", () => {
		const parsed = parsePgn('[Event "Test"]\n[White "A"]\n[Black "B"]\n\n1.e4 e5 2.Nf3 Nc6 1-0');

		expect(parsed.headers).toEqual({ Event: "Test", White: "A", Black: "B" });
		expect(parsed.startingFen).toBe(START_FEN);
		expect(parsed.moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
		expect(parsed.result).toBe("1-0");
	});

	it("records squares, colour, move number and the position after each move", () => {
		const [e4, e5] = parsePgn("1.e4 e5 *").moves;

		expect(e4).toMatchObject({ from: "e2", to: "e4", color: "w", moveNumber: 1 });
		expect(e5).toMatchObject({ from: "e7", to: "e5", color: "b", moveNumber: 1 });
		expect(e5.fen).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
	});

	it("attaches comments to the preceding move, and a leading comment to the start", () => {
		const parsed = parsePgn("{Opening} 1.e4 {Best by test} e5 {Symmetric} *");

		expect(parsed.startingComment).toBe("Opening");
		expect(parsed.moves[0].comment).toBe("Best by test");
		expect(parsed.moves[1].comment).toBe("Symmetric");
	});

	it("maps $N codes and move suffixes to NAG symbols", () => {
		const parsed = parsePgn("1.e4 $1 e5?! 2.Qh5?? Nc6 +- *");

		expect(parsed.moves.map((m) => m.nag)).toEqual(["!", "?!", "??", "+-"]);
	});

	it("parses a variation as an alternative to its parent move", () => {
		const parsed = parsePgn("1.e4 e5 (1...c5 2.Nf3) 2.Nf3 *");

		expect(parsed.moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3"]);
		const variation = parsed.moves[1].variations[0];
		expect(variation.map((m) => m.san)).toEqual(["c5", "Nf3"]);
		expect(variation[0].color).toBe("b");
	});

	it("starts from a FEN header, padding a board-only FEN", () => {
		const parsed = parsePgn('[FEN "4k3/8/8/8/8/8/4P3/4K3"]\n\n1.e4 *');

		expect(parsed.startingFen).toBe("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
		expect(parsed.moves.map((m) => m.san)).toEqual(["e4"]);
	});

	it("skips illegal moves and keeps an unclosed comment", () => {
		const parsed = parsePgn("1.e4 Ke7 e5 {never closed");

		expect(parsed.moves.map((m) => m.san)).toEqual(["e4", "e5"]);
		expect(parsed.moves[1].comment).toBe("never closed");
	});

	it("reads [%cal] arrows and [%csl] squares out of comments", () => {
		const parsed = parsePgn("1.e4 {Aim at f7 [%cal Gf1c4,Rd8h4] [%csl Yf7]} e5 *");

		expect(parsed.moves[0].comment).toBe("Aim at f7");
		expect(parsed.moves[0].shapes).toEqual({
			arrows: [
				{ from: "f1", to: "c4", color: "G" },
				{ from: "d8", to: "h4", color: "R" },
			],
			squares: [{ square: "f7", color: "Y" }],
		});
		expect(parsed.moves[1].shapes).toEqual({ arrows: [], squares: [] });
	});

	it("leaves no comment when a comment holds only drawings", () => {
		const parsed = parsePgn("{[%csl Bd4, Be5]} 1.e4 {[%cal Bg1f3]} e5 *");

		expect(parsed.startingComment).toBeNull();
		expect(parsed.startingShapes.squares).toEqual([
			{ square: "d4", color: "B" },
			{ square: "e5", color: "B" },
		]);
		expect(parsed.moves[0].comment).toBeNull();
		expect(parsed.moves[0].shapes.arrows).toEqual([{ from: "g1", to: "f3", color: "B" }]);
	});

	it("reads drawings in variations and skips malformed entries", () => {
		const parsed = parsePgn("1.e4 e5 (1...c5 {[%cal Gg1f3,Xa1a2,Gz9a1,Ge4e4]}) *");
		const c5 = parsed.moves[1].variations[0][0];

		expect(c5.shapes.arrows).toEqual([{ from: "g1", to: "f3", color: "G" }]);
	});

	it("returns no moves for text that is not a game", () => {
		const parsed = parsePgn("hello world");

		expect(parsed.moves).toEqual([]);
		expect(parsed.result).toBeNull();
	});
});

describe("normalizeFen", () => {
	it("pads a board-only FEN to six fields", () => {
		expect(normalizeFen("8/8/8/8/8/8/8/8")).toBe("8/8/8/8/8/8/8/8 w - - 0 1");
	});

	it("keeps fields that are present", () => {
		expect(normalizeFen("8/8/8/8/8/8/8/8 b")).toBe("8/8/8/8/8/8/8/8 b - - 0 1");
		expect(normalizeFen(START_FEN)).toBe(START_FEN);
	});
});
