import { describe, expect, it } from "vitest";
import { flattenMoves } from "../src/flat-moves";
import { parsePgn } from "../src/pgn-parser";

function flat(pgn: string) {
	const parsed = parsePgn(pgn);
	return flattenMoves(parsed.moves, parsed.startingFen).map((f) => ({ id: f.id, san: f.node.san, repeats: f.repeats }));
}

describe("flattenMoves", () => {
	it("lists moves in display order with variation ids", () => {
		expect(flat("1.e4 (1.d4 d5) e5 *").map((f) => f.id + " " + f.san)).toEqual(["m-0 e4", "m-0v0-0 d4", "m-0v0-1 d5", "m-1 e5"]);
	});

	it("counts repetitions along the mainline", () => {
		const moves = flat("1.Nf3 Nf6 2.Ng1 Ng8 3.Nf3 Nf6 4.Ng1 Ng8 5.Nf3 *");
		expect(moves.map((m) => m.repeats)).toEqual([1, 1, 1, 2, 2, 2, 2, 3, 3]);
	});

	it("starts a replacing variation before its parent move", () => {
		// The variation replaces 1.e4, so the mainline 1.Nf3 is not in its line.
		const moves = flat("1.e4 (1.Nf3 Nf6 2.Ng1 Ng8 3.Nf3) e5 *");
		expect(moves.filter((m) => m.id.includes("v")).map((m) => m.repeats)).toEqual([1, 1, 1, 2, 2]);
	});

	it("starts a continuation variation after its parent move", () => {
		// The variation follows 1.Nf3, so that position counts toward 5.Nf3.
		const moves = flat("1.Nf3 (1...Nf6 2.Ng1 Ng8 3.Nf3 Nf6 4.Ng1 Ng8 5.Nf3) *");
		const last = moves[moves.length - 1];
		expect(last).toEqual({ id: "m-0v0-7", san: "Nf3", repeats: 3 });
		expect(moves.map((m) => m.repeats)).toEqual([1, 1, 1, 2, 2, 2, 2, 3, 3]);
	});

	it("does not leak a variation's positions into the line after it", () => {
		const moves = flat("1.Nf3 (1...Nf6 2.Ng1 Ng8) Nf6 2.Ng1 Ng8 *");
		expect(moves.filter((m) => !m.id.includes("v")).map((m) => m.repeats)).toEqual([1, 1, 1, 2]);
	});
});
