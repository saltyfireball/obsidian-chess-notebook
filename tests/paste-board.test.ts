import { describe, expect, it } from "vitest";
import { boardBlockFor, editsCodeBlock, insideCodeBlock } from "../src/paste-board";

const FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("boardBlockFor", () => {
	it("wraps a FEN in a type:fen block", () => {
		expect(boardBlockFor(`  ${FEN}\n`)).toBe("```chessboard type:fen\n" + FEN + "\n```\n");
	});

	it("wraps a PGN in a type:pgn block, with its line endings made plain", () => {
		const pgn = '[Event "Casual"]\r\n\r\n1.e4 e5 2.Nf3 *';
		expect(boardBlockFor(pgn)).toBe('```chessboard type:pgn\n[Event "Casual"]\n\n1.e4 e5 2.Nf3 *\n```\n');
	});

	it("starts on a new line when the cursor is mid-line", () => {
		expect(boardBlockFor(FEN, true)).toBe("\n```chessboard type:fen\n" + FEN + "\n```\n");
	});

	it("uses a longer fence when the text holds backticks", () => {
		const block = boardBlockFor("1.e4 {see ```this```} e5 *");
		expect(block).toBe("````chessboard type:pgn\n1.e4 {see ```this```} e5 *\n````\n");
	});

	it("is null when the text is neither", () => {
		expect(boardBlockFor("")).toBeNull();
		expect(boardBlockFor("shopping list: eggs")).toBeNull();
	});
});

describe("insideCodeBlock", () => {
	const doc = ["text", "```chessboard type:fen", FEN, "```", "after", "~~~", "x", "~~~"];

	it("is false outside blocks and on a closing fence", () => {
		expect(insideCodeBlock(doc, 0)).toBe(false);
		expect(insideCodeBlock(doc, 3)).toBe(false);
		expect(insideCodeBlock(doc, 4)).toBe(false);
		expect(insideCodeBlock(doc, 7)).toBe(false);
	});

	it("is true inside a block and on its opening fence", () => {
		expect(insideCodeBlock(doc, 1)).toBe(true);
		expect(insideCodeBlock(doc, 2)).toBe(true);
		expect(insideCodeBlock(doc, 6)).toBe(true);
	});

	it("only closes on a matching fence", () => {
		expect(insideCodeBlock(["````", "```", "x"], 2)).toBe(true);
		expect(insideCodeBlock(["```", "~~~", "x"], 2)).toBe(true);
	});
});

describe("editsCodeBlock", () => {
	const doc = ["text", "```chessboard type:fen", FEN, "```", "after"];
	const at = (line: number, ch: number) => ({ line, ch });

	it("is false for a caret or selection outside blocks", () => {
		expect(editsCodeBlock(doc, at(0, 2), at(0, 2))).toBe(false);
		expect(editsCodeBlock(doc, at(4, 0), at(4, 5))).toBe(false);
	});

	it("is true for a selection that starts outside and ends inside a block", () => {
		expect(editsCodeBlock(doc, at(0, 2), at(2, 4))).toBe(true);
	});

	it("is true for a selection that spans a whole block", () => {
		expect(editsCodeBlock(doc, at(0, 0), at(4, 2))).toBe(true);
	});

	it("is true before or within a closing fence, false after it", () => {
		expect(editsCodeBlock(doc, at(3, 0), at(3, 0))).toBe(true);
		expect(editsCodeBlock(doc, at(3, 2), at(3, 2))).toBe(true);
		expect(editsCodeBlock(doc, at(3, 3), at(3, 3))).toBe(false);
		expect(editsCodeBlock(["```", "x", "```  "], at(2, 3), at(2, 5))).toBe(false);
	});

	it("is false next to a block, true for a selection starting in a closing fence", () => {
		expect(editsCodeBlock(doc, at(4, 0), at(4, 0))).toBe(false);
		expect(editsCodeBlock(["a", "```", "x", "```"], at(0, 0), at(0, 1))).toBe(false);
		expect(editsCodeBlock(["```", "x", "```", "a"], at(2, 1), at(3, 1))).toBe(true);
	});
});
