import { describe, expect, it } from "vitest";
import { staticFenPosition, staticPgnPosition } from "../src/static-position";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

describe("staticPgnPosition", () => {
	const pgn = "1.e4 {[%cal Gg1f3]} e5 2.Nf3 Nc6 *";

	it("shows the position before the first move at start", () => {
		expect(staticPgnPosition(pgn, "start")).toEqual({ fen: START_FEN, shapes: { arrows: [], squares: [] } });
	});

	it("counts half-moves from 0 and carries that move's drawings", () => {
		const pos = staticPgnPosition(pgn, 0);
		expect(pos.fen.split(" ")[0]).toBe(AFTER_E4.split(" ")[0]);
		expect(pos.shapes.arrows).toEqual([{ from: "g1", to: "f3", color: "G" }]);
	});

	it("shows the last move at end, and past the end", () => {
		const end = staticPgnPosition(pgn, "end").fen;
		expect(end.startsWith("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/")).toBe(true);
		expect(staticPgnPosition(pgn, 99).fen).toBe(end);
	});

	it("uses the FEN tag when there are no moves", () => {
		const fen = "8/8/8/4k3/8/8/4K3/8 w - - 0 1";
		expect(staticPgnPosition(`[FEN "${fen}"]\n[SetUp "1"]\n\n*`, "end").fen).toBe(fen);
	});
});

describe("staticFenPosition", () => {
	const fens = ["a", "b", "c"];

	it("picks the start_at line", () => {
		expect(staticFenPosition(fens, "start")).toBe("a");
		expect(staticFenPosition(fens, 1)).toBe("b");
		expect(staticFenPosition(fens, "end")).toBe("c");
		expect(staticFenPosition(fens, 7)).toBe("c");
	});
});
