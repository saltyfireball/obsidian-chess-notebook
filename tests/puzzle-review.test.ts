import { describe, expect, it } from "vitest";
import { findChessBlocks, reviewCount, shuffle } from "../src/puzzle-review";

const NOTE = [
	"# Tactics",
	"",
	"```chessboard type:pgn mode:puzzle title:\"Fork\"",
	"1.e4 e5 2.Nf3 *",
	"```",
	"",
	"```js",
	"const x = 1;",
	"```",
	"",
	"~~~~ chessboard",
	"type:pgn mode:puzzle",
	"1.d4 d5 *",
	"```",
	"~~~~",
	"```chessboard",
	"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
].join("\n");

describe("findChessBlocks", () => {
	const blocks = findChessBlocks(NOTE);

	it("finds each chessboard block with its fence options and line", () => {
		expect(blocks).toHaveLength(3);
		expect(blocks[0]).toEqual({
			fenceLine: 'type:pgn mode:puzzle title:"Fork"',
			source: "1.e4 e5 2.Nf3 *",
			line: 2,
		});
	});

	it("skips other code blocks", () => {
		expect(blocks.some((b) => b.source.includes("const x"))).toBe(false);
	});

	it("closes a tilde fence only on a tilde fence as long", () => {
		expect(blocks[1].fenceLine).toBe("");
		expect(blocks[1].source).toBe("type:pgn mode:puzzle\n1.d4 d5 *\n```");
		expect(blocks[1].line).toBe(10);
	});

	it("runs an unclosed block to the end of the note", () => {
		expect(blocks[2].source).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
	});

	it("ignores a language that only starts with chessboard", () => {
		expect(findChessBlocks("```chessboards\n1.e4 *\n```")).toEqual([]);
	});
});

describe("shuffle", () => {
	it("keeps every item and leaves the input alone", () => {
		const items = [1, 2, 3, 4, 5];
		const out = shuffle(items, Math.random);
		expect(out.slice().sort()).toEqual(items);
		expect(items).toEqual([1, 2, 3, 4, 5]);
	});

	it("follows the injected random", () => {
		// random 0 always swaps with the first slot.
		expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
		// random just under 1 always swaps an item with itself.
		expect(shuffle([1, 2, 3, 4], () => 0.999)).toEqual([1, 2, 3, 4]);
	});

	it("handles empty and single lists", () => {
		expect(shuffle([], () => 0)).toEqual([]);
		expect(shuffle(["a"], () => 0)).toEqual(["a"]);
	});
});

describe("reviewCount", () => {
	it("counts from one", () => {
		expect(reviewCount(2, 12)).toBe("Puzzle 3 of 12");
	});
});
