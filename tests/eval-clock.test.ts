import { describe, expect, it } from "vitest";
import {
	evalLabel,
	extractEvalClock,
	formatClock,
	hasEvalClock,
	latestEvalClock,
	linePath,
	parseClock,
	parseEval,
	pathTo,
	whiteShare,
} from "../src/eval-clock";
import { parsePgn } from "../src/pgn-parser";

describe("parseEval", () => {
	it("reads pawn scores and mate scores", () => {
		expect(parseEval("0.35")).toEqual({ kind: "cp", pawns: 0.35 });
		expect(parseEval("-1.2")).toEqual({ kind: "cp", pawns: -1.2 });
		expect(parseEval("+3")).toEqual({ kind: "cp", pawns: 3 });
		expect(parseEval("#3")).toEqual({ kind: "mate", moves: 3, white: true });
		expect(parseEval("#-2")).toEqual({ kind: "mate", moves: -2, white: false });
		expect(parseEval("abc")).toBeNull();
	});
});

describe("parseClock and formatClock", () => {
	it("reads h:mm:ss with optional tenths", () => {
		expect(parseClock("0:03:00")).toBe(180);
		expect(parseClock("1:02:03.4")).toBeCloseTo(3723.4);
		expect(parseClock("4:59")).toBe(299);
		expect(parseClock("soon")).toBeNull();
	});

	it("prints m:ss, h:mm:ss and tenths under ten seconds", () => {
		expect(formatClock(180)).toBe("3:00");
		expect(formatClock(3723.4)).toBe("1:02:03");
		expect(formatClock(9.8)).toBe("0:09.8");
		expect(formatClock(4.6)).toBe("0:04.6");
		expect(formatClock(7.3)).toBe("0:07.3");
		expect(formatClock(parseClock("0:00:05.2")!)).toBe("0:05.2");
		expect(formatClock(59.99)).toBe("0:59");
		expect(formatClock(0)).toBe("0:00");
	});
});

describe("evalLabel and whiteShare", () => {
	it("labels evals the way PGN writes them", () => {
		expect(evalLabel({ kind: "cp", pawns: 0.35 })).toBe("+0.4");
		expect(evalLabel({ kind: "cp", pawns: -1.24 })).toBe("-1.2");
		expect(evalLabel({ kind: "cp", pawns: 0 })).toBe("0.0");
		expect(evalLabel({ kind: "mate", moves: -2, white: false })).toBe("#-2");
	});

	it("is even at 0, leans with the score and pins mates", () => {
		expect(whiteShare(null)).toBe(0.5);
		expect(whiteShare({ kind: "cp", pawns: 0 })).toBe(0.5);
		expect(whiteShare({ kind: "cp", pawns: 2 })).toBeGreaterThan(0.6);
		expect(whiteShare({ kind: "cp", pawns: -2 })).toBeLessThan(0.4);
		expect(whiteShare({ kind: "mate", moves: 3, white: true })).toBe(1);
		expect(whiteShare({ kind: "mate", moves: -1, white: false })).toBe(0);
	});
});

describe("extractEvalClock", () => {
	it("takes the commands out of the comment text", () => {
		expect(extractEvalClock("[%eval 0.17] [%clk 0:02:58] Good move")).toEqual({
			text: "Good move",
			evaluation: { kind: "cp", pawns: 0.17 },
			clock: 178,
		});
		expect(extractEvalClock("[%clk 0:00:05.2]")).toEqual({ text: null, evaluation: null, clock: 5.2 });
		expect(extractEvalClock("[%eval #-4,30]").evaluation).toEqual({ kind: "mate", moves: -4, white: false });
		expect(extractEvalClock(null)).toEqual({ text: null, evaluation: null, clock: null });
	});
});

const GAME = `1. e4 { [%eval 0.2] [%clk 0:03:00] } 1... e5 { [%eval 0.3] [%clk 0:02:59] Solid. }
2. Nf3 { [%clk 0:02:55] } (2. Qh5 { [%eval -0.5] } Nc6 { [%clk 0:02:50] [%csl Ge5] }) 2... Nc6 { [%eval #5] [%clk 0:02:40] } *`;

describe("parsePgn with eval and clock", () => {
	const parsed = parsePgn(GAME);
	const moves = parsed.moves;

	it("stores them on the move and strips them from the comment", () => {
		expect(moves[0].evaluation).toEqual({ kind: "cp", pawns: 0.2 });
		expect(moves[0].clock).toBe(180);
		expect(moves[0].comment).toBeNull();
		expect(moves[1].comment).toBe("Solid.");
		expect(moves[2].evaluation).toBeNull();
		expect(moves[2].variations[0][1].shapes.squares).toEqual([{ square: "e5", color: "G" }]);
		expect(moves[2].variations[0][1].comment).toBeNull();
	});

	it("finds the latest eval and clocks along the main line and into a variation", () => {
		expect(latestEvalClock(pathTo(moves, "m-2"))).toEqual({
			evaluation: { kind: "cp", pawns: 0.3 },
			stale: true,
			white: 175,
			black: 179,
		});
		const { path: varPath, lineStart } = linePath(moves, "m-2v0-1");
		expect(varPath.map((m) => m.san)).toEqual(["e4", "e5", "Qh5", "Nc6"]);
		expect(lineStart).toBe(2);
		expect(latestEvalClock(varPath, lineStart)).toEqual({
			evaluation: { kind: "cp", pawns: -0.5 },
			stale: true,
			white: 180,
			black: 170,
		});
	});

	it("reports whether a game carries either", () => {
		expect(hasEvalClock(moves)).toEqual({ evaluation: true, clock: true });
		expect(hasEvalClock(parsePgn("1.e4 {Just text} e5 *").moves)).toEqual({ evaluation: false, clock: false });
	});
});

describe("evals in variations", () => {
	// 2... d6 replaces 2... Nc6 (#5); 3. Bc4 continues after it inside a
	// nested line; 2. d4 has an eval of its own.
	const moves = parsePgn(
		`1. e4 { [%eval 0.2] } e5 { [%eval 0.3] } 2. Nf3 (2. d4 { [%eval 0.5] } exd4)
		2... Nc6 { [%eval #5] } (2... d6 3. Bc4 { [%eval 1.1] } (3. d4) Be7) 3. Bb5 *`,
	).moves;
	const evalAt = (id: string) => {
		const { path, lineStart } = linePath(moves, id);
		const { evaluation, stale } = latestEvalClock(path, lineStart);
		return { evaluation, stale };
	};

	it("does not carry the eval of the line a variation branched from", () => {
		expect(evalAt("m-3v0-0")).toEqual({ evaluation: null, stale: false });
		expect(evalAt("m-3v0-1v0-0")).toEqual({ evaluation: null, stale: false });
	});

	it("marks an eval carried from an earlier move of the same line as stale", () => {
		expect(evalAt("m-2v0-0")).toEqual({ evaluation: { kind: "cp", pawns: 0.5 }, stale: false });
		expect(evalAt("m-2v0-1")).toEqual({ evaluation: { kind: "cp", pawns: 0.5 }, stale: true });
		expect(evalAt("m-3v0-2")).toEqual({ evaluation: { kind: "cp", pawns: 1.1 }, stale: true });
		expect(evalAt("m-3")).toEqual({ evaluation: { kind: "mate", moves: 5, white: true }, stale: false });
		expect(evalAt("m-4")).toEqual({ evaluation: { kind: "mate", moves: 5, white: true }, stale: true });
	});

	it("gives [%eval #0] to the side that just mated", () => {
		const mated = parsePgn("1. f3 e5 2. g4 Qh4# { [%eval #0] } 0-1").moves;
		const { evaluation } = latestEvalClock(pathTo(mated, "m-3"));
		expect(evaluation).toEqual({ kind: "mate", moves: 0, white: false });
		expect(whiteShare(evaluation)).toBe(0);
		expect(evalLabel(evaluation!)).toBe("#0");
	});
});
