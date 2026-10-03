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

	it("castles by dragging the king two squares", () => {
		const line = new ExploreLine("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
		expect(line.isLegal("e1", "g1")).toBe(true);
		expect(line.push("e1", "g1")?.san).toBe("O-O");
		expect(line.push("e8", "c8")?.san).toBe("O-O-O");
		expect(line.fen.split(" ")[0]).toBe("2kr3r/8/8/8/8/8/8/R4RK1");
	});

	it("takes en passant and removes the captured pawn", () => {
		const line = new ExploreLine("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2");
		expect(line.push("e5", "d6")?.san).toBe("exd6");
		expect(line.fen.split(" ")[0]).toBe("4k3/8/3P4/8/8/8/8/4K3");
	});

	it("promotes a black pawn to a queen", () => {
		const line = new ExploreLine("4k3/8/8/8/8/8/3p4/K7 b - - 0 1");
		const move = line.push("d2", "d1");
		expect(move?.san).toBe("d1=Q+");
		expect(line.sanList()).toBe("1...d1=Q+");
	});

	it("allows no move once the game is over", () => {
		// Black is mated: the king can be picked up but has nowhere to go.
		const mate = new ExploreLine("R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1");
		expect(mate.hasOwnPiece("g8")).toBe(true);
		expect(mate.isLegal("g8", "h8")).toBe(false);
		expect(mate.push("f7", "f6")).toBeNull();
		const stalemate = new ExploreLine("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
		expect(stalemate.isLegal("h8", "g8")).toBe(false);
		expect(stalemate.isLegal("h8", "h7")).toBe(false);
	});

	it("only allows moves that get out of check", () => {
		const line = new ExploreLine("4k3/8/8/8/8/8/3PP3/r3K3 w - - 0 1");
		expect(line.isLegal("e2", "e4")).toBe(false);
		expect(line.isLegal("e1", "f2")).toBe(true);
		expect(line.isLegal("e1", "d1")).toBe(false);
	});

	it("only starts from a FEN chess.js accepts", () => {
		expect(ExploreLine.canStart(START)).toBe(true);
		expect(ExploreLine.canStart("not a fen")).toBe(false);
	});
});
