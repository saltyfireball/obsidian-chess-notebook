import { describe, expect, it } from "vitest";
import { ExploreLine } from "../src/explore";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// After 1.e4 e5 ... 12.Re1: Black to move on move 12.
const BLACK_12 = "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQR1K1 b - - 6 12";

describe("ExploreLine", () => {
	it("plays legal moves and refuses illegal ones", () => {
		const line = new ExploreLine(START);
		expect(line.push("e2", "e5")).toBeNull();
		expect(line.moves).toHaveLength(0);
		const move = line.push("e2", "e4");
		expect(move?.san).toBe("e4");
		expect(line.sideToMove()).toBe("b");
		expect(line.lastMove).toEqual(move);
	});

	it("knows which pieces the side to move can pick up", () => {
		const line = new ExploreLine(START);
		expect(line.hasOwnPiece("e2")).toBe(true);
		expect(line.hasOwnPiece("e7")).toBe(false);
		expect(line.hasOwnPiece("e4")).toBe(false);
	});

	it("lists the line with move numbers, from a black move", () => {
		const line = new ExploreLine(BLACK_12);
		line.push("d7", "d6");
		line.push("d2", "d4");
		line.push("c8", "g4");
		expect(line.sanList()).toBe("12...d6 13.d4 Bg4");
	});

	it("lists a line from a white move without dots", () => {
		const line = new ExploreLine(START);
		line.push("g1", "f3");
		line.push("g8", "f6");
		line.push("c2", "c4");
		expect(line.sanList()).toBe("1.Nf3 Nf6 2.c4");
	});

	it("undoes moves one at a time", () => {
		const line = new ExploreLine(START);
		line.push("e2", "e4");
		line.push("e7", "e5");
		expect(line.undo()).toBe(true);
		expect(line.sanList()).toBe("1.e4");
		expect(line.undo()).toBe(true);
		expect(line.fen).toBe(START);
		expect(line.undo()).toBe(false);
	});

	it("promotes to a queen", () => {
		const line = new ExploreLine("8/4P3/8/8/8/8/k7/4K3 w - - 0 1");
		expect(line.push("e7", "e8")?.san).toBe("e8=Q");
	});

	it("goes back to the starting position and forgets the line", () => {
		const line = new ExploreLine(BLACK_12);
		line.push("d7", "d6");
		expect(line.back()).toBe(BLACK_12);
		expect(line.moves).toHaveLength(0);
		expect(line.fen).toBe(BLACK_12);
		expect(line.sanList()).toBe("");
	});

	it("only starts from a FEN chess.js accepts", () => {
		expect(ExploreLine.canStart(START)).toBe(true);
		expect(ExploreLine.canStart("not a fen")).toBe(false);
	});
});
