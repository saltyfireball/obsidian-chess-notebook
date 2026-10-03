import { describe, expect, it } from "vitest";
import { drawReason, positionKey } from "../src/draw";

describe("drawReason", () => {
	it("is null for an ordinary position", () => {
		expect(drawReason("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", 1)).toBeNull();
	});

	it("finds stalemate", () => {
		expect(drawReason("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", 1)).toBe("Stalemate");
	});

	it("finds insufficient material", () => {
		expect(drawReason("8/8/4k3/8/8/3NK3/8/8 w - - 0 1", 1)).toBe("Insufficient material");
	});

	it("finds the fifty-move rule", () => {
		expect(drawReason("8/8/4k3/8/8/3RK3/8/8 w - - 100 80", 1)).toBe("Fifty-move rule");
		expect(drawReason("8/8/4k3/8/8/3RK3/8/8 w - - 99 80", 1)).toBeNull();
	});

	it("finds threefold repetition from the repeat count", () => {
		const fen = "8/8/4k3/8/8/3RK3/8/8 w - - 8 80";
		expect(drawReason(fen, 2)).toBeNull();
		expect(drawReason(fen, 3)).toBe("Threefold repetition");
	});

	it("does not call checkmate a draw, even past fifty moves", () => {
		expect(drawReason("7k/6Q1/6K1/8/8/8/8/8 b - - 120 90", 3)).toBeNull();
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
