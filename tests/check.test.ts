import { describe, expect, it } from "vitest";
import { checkedKingSquare } from "../src/check";

describe("checkedKingSquare", () => {
	it("is null when the side to move is not in check", () => {
		expect(checkedKingSquare("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1")).toBeNull();
	});

	it("finds the black king in check", () => {
		expect(checkedKingSquare("rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2")).toBe("e8");
	});

	it("finds the white king in check, checkmate included", () => {
		expect(checkedKingSquare("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3")).toBe("e1");
	});

	it("reads a board-only FEN as White to move", () => {
		expect(checkedKingSquare("4k3/8/8/8/8/8/8/r3K3")).toBe("e1");
	});

	it("is null for a FEN it cannot read", () => {
		expect(checkedKingSquare("not a fen")).toBeNull();
	});
});
