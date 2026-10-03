import { describe, expect, it } from "vitest";
import { drawLabel, drawReason, positionKey } from "../src/draw";

const plain = (reason: string) => ({ reason, claimable: false });
const claimable = (reason: string) => ({ reason, claimable: true });

describe("drawReason", () => {
	it("is null for an ordinary position", () => {
		expect(drawReason("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", 1)).toBeNull();
	});

	it("finds stalemate", () => {
		expect(drawReason("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", 1)).toEqual(plain("Stalemate"));
	});

	it("finds insufficient material", () => {
		expect(drawReason("8/8/4k3/8/8/3NK3/8/8 w - - 0 1", 1)).toEqual(plain("Insufficient material"));
	});

	it("finds the fifty-move rule as claimable and the 75-move rule as automatic", () => {
		expect(drawReason("8/8/4k3/8/8/3RK3/8/8 w - - 99 80", 1)).toBeNull();
		expect(drawReason("8/8/4k3/8/8/3RK3/8/8 w - - 100 80", 1)).toEqual(claimable("Fifty-move rule"));
		expect(drawReason("8/8/4k3/8/8/3RK3/8/8 w - - 149 80", 1)).toEqual(claimable("Fifty-move rule"));
		expect(drawReason("8/8/4k3/8/8/3RK3/8/8 w - - 150 80", 1)).toEqual(plain("75-move rule"));
	});

	it("finds threefold repetition as claimable and fivefold as automatic", () => {
		const fen = "8/8/4k3/8/8/3RK3/8/8 w - - 8 80";
		expect(drawReason(fen, 2)).toBeNull();
		expect(drawReason(fen, 3)).toEqual(claimable("Threefold repetition"));
		expect(drawReason(fen, 4)).toEqual(claimable("Threefold repetition"));
		expect(drawReason(fen, 5)).toEqual(plain("Fivefold repetition"));
	});

	it("does not call checkmate a draw, even past fifty moves", () => {
		expect(drawReason("7k/6Q1/6K1/8/8/8/8/8 b - - 120 90", 3)).toBeNull();
	});
});

describe("drawLabel", () => {
	it("says 1/2 for a draw that ends the game", () => {
		expect(drawLabel(plain("Stalemate"))).toBe("1/2 Stalemate");
		expect(drawLabel(plain("Fivefold repetition"))).toBe("1/2 Fivefold repetition");
	});

	it("says claimable for a draw a player must claim", () => {
		expect(drawLabel(claimable("Threefold repetition"))).toBe("1/2 claimable: threefold repetition");
		expect(drawLabel(claimable("Fifty-move rule"))).toBe("1/2 claimable: fifty-move rule");
	});
});

describe("positionKey", () => {
	it("ignores the move counters", () => {
		expect(positionKey("8/8/4k3/8/8/3RK3/8/8 w - - 8 80")).toBe(positionKey("8/8/4k3/8/8/3RK3/8/8 w - - 12 84"));
	});

	it("keeps the side to move", () => {
		expect(positionKey("8/8/4k3/8/8/3RK3/8/8 w - - 8 80")).not.toBe(positionKey("8/8/4k3/8/8/3RK3/8/8 b - - 8 80"));
	});
});
