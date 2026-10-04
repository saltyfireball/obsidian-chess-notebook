import { describe, expect, it } from "vitest";
import { fenceLineFor, findChessBlocks, isPlayablePgn, mapInBatches, reviewCount, shuffle, SourceOccurrences } from "../src/puzzle-review";

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
			language: "chessboard",
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

describe("findChessBlocks fences", () => {
	const fence = (lines: string[]) => findChessBlocks(lines.join("\n"));

	it("finds a fence indented up to three spaces and strips the indent from its lines", () => {
		const blocks = fence(["   ```chessboard mode:puzzle", "   1.e4 e5 *", "   ```", "after"]);
		expect(blocks).toEqual([{ language: "chessboard", fenceLine: "mode:puzzle", source: "1.e4 e5 *", line: 0 }]);
	});

	it("finds a fence in a list item", () => {
		const blocks = fence(["- A tactic:", "  ```chessboard mode:puzzle", "  1.e4 e5 *", "  ```", "- next item"]);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].source).toBe("1.e4 e5 *");
		expect(fence(["1. ```chessboard mode:puzzle", "   1.d4 *", "   ```"])[0].source).toBe("1.d4 *");
	});

	it("reads a fence indented four or more spaces as indented code, not a block", () => {
		expect(fence(["    ```chessboard type:pgn mode:puzzle", "    1.e4 *", "    ```"])).toEqual([]);
		expect(fence(["\t```chessboard mode:puzzle", "\t1.e4 *", "\t```"])).toEqual([]);
		expect(fence(["- item", "      ```chessboard mode:puzzle", "      1.e4 *", "      ```"])).toEqual([]);
		expect(fence(["> ```chessboard", ">     ```", "> 1.e4 *", "> ```"])[0].source).toBe("    ```\n1.e4 *");
	});

	it("counts a fence's indent from its list item's content", () => {
		const blocks = fence(["- A tactic:", "  ```chessboard mode:puzzle", "  1.e4 e5 *", "  ```"]);
		expect(blocks.map((b) => [b.source, b.line])).toEqual([["1.e4 e5 *", 1]]);
		const deep = fence(["10. A tactic:", "    ```chessboard mode:puzzle", "    1.d4 *", "    ```"]);
		expect(deep.map((b) => b.source)).toEqual(["1.d4 *"]);
		expect(fence(["- a", "  - b", "    ```chessboard", "    1.c4 *", "    ```"]).map((b) => b.source)).toEqual(["1.c4 *"]);
		const lazy = fence(["- A tactic", "with a lazy line", "  ```chessboard", "  1.Nf3 *", "  ```"]);
		expect(lazy.map((b) => b.source)).toEqual(["1.Nf3 *"]);
	});

	it("ends an unclosed list item fence where the item ends and reads that line again", () => {
		const blocks = fence(["- ```md", "  example", "", "```chessboard type:pgn mode:puzzle", "1.e4 *", "```"]);
		expect(blocks.map((b) => [b.fenceLine, b.source, b.line])).toEqual([["type:pgn mode:puzzle", "1.e4 *", 3]]);
		const inItem = fence(["- ```chessboard", "  1.e4 *", "", "  1... e5", "next paragraph"]);
		expect(inItem.map((b) => b.source)).toEqual(["1.e4 *\n\n1... e5"]);
	});

	it("finds a fence in a callout, nested callouts too", () => {
		const blocks = fence(["> [!tip] Puzzle", "> ```chessboard mode:puzzle", "> 1.e4 e5 *", "> ```", "", "> > ~~~chessboard", "> > 1.d4 *", "> > ~~~"]);
		expect(blocks.map((b) => [b.source, b.line])).toEqual([
			["1.e4 e5 *", 1],
			["1.d4 *", 5],
		]);
	});

	it("finds a fence in a callout nested in a list item", () => {
		const blocks = fence(["10. item", "    > ```chessboard type:pgn mode:puzzle", "    > 1.e4 *", "    > ```"]);
		expect(blocks.map((b) => [b.fenceLine, b.source, b.line])).toEqual([["type:pgn mode:puzzle", "1.e4 *", 1]]);
		expect(fence(["- item", "  > ```chessboard", "  > 1.d4 *", "  > ```"]).map((b) => b.source)).toEqual(["1.d4 *"]);
		expect(fence(["> - item", ">   ```chessboard", ">   1.c4 *", ">   ```"]).map((b) => b.source)).toEqual(["1.c4 *"]);
		// The block ends with the list item that holds its callout.
		const ends = fence(["- > ```chessboard", "  > 1.e4 *", "> 1... e5", "```chessboard", "1.d4 *", "```"]);
		expect(ends.map((b) => b.source)).toEqual(["1.e4 *", "1.d4 *"]);
	});

	it("reads a tab after a list marker at four-column tab stops", () => {
		const blocks = fence(["-\t```chessboard type:pgn mode:puzzle", "\t1.e4 *", "\t```"]);
		expect(blocks.map((b) => [b.fenceLine, b.source, b.line])).toEqual([["type:pgn mode:puzzle", "1.e4 *", 0]]);
		expect(fence(["1.\t```chessboard", "    1.d4 *", "    ```"]).map((b) => b.source)).toEqual(["1.d4 *"]);
		expect(fence([">\t```chessboard", ">\t1.c4 *", ">\t```"]).map((b) => b.source)).toEqual(["1.c4 *"]);
	});

	it("ends an unclosed callout block where the callout ends", () => {
		const blocks = fence(["> ```chessboard", "> 1.e4 *", "plain text", "```chessboard", "1.d4 *", "```"]);
		expect(blocks.map((b) => b.source)).toEqual(["1.e4 *", "1.d4 *"]);
	});

	it("skips an example chessboard fence inside a longer fence", () => {
		const blocks = fence(["````md", "```chessboard type:pgn mode:puzzle", "1.e4 e5 *", "```", "````", "```chessboard mode:puzzle", "1.d4 *", "```"]);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].source).toBe("1.d4 *");
		expect(blocks[0].line).toBe(5);
	});

	it("skips an example chessboard fence inside a tilde fence", () => {
		expect(fence(["~~~", "```chessboard mode:puzzle", "1.e4 *", "```", "~~~"])).toEqual([]);
	});

	it("needs the language to be exactly chessboard", () => {
		expect(fence(["```chessboard-x mode:puzzle", "1.e4 *", "```"])).toEqual([]);
		expect(fence(["```chessboard.foo", "1.e4 *", "```"])).toEqual([]);
		expect(fence(["``` chessboard mode:puzzle", "1.e4 *", "```"])).toHaveLength(1);
		expect(fence(["```Chessboard", "1.e4 *", "```"])).toHaveLength(1);
	});

	it("is not a backtick fence when the info string holds a backtick", () => {
		expect(fence(["```chessboard `x`", "1.e4 *", "```"])).toEqual([]);
	});

	it("finds the alias languages it is given", () => {
		const text = ["```pgn mode:puzzle", "1.e4 *", "```", "```chess", "1.d4 *", "```", "```fen", "8/8/8/8/8/8/8/8 w - - 0 1", "```"].join("\n");
		expect(findChessBlocks(text)).toEqual([]);
		const blocks = findChessBlocks(text, ["chessboard", "pgn", "chess"]);
		expect(blocks.map((b) => [b.language, b.fenceLine, b.source])).toEqual([
			["pgn", "mode:puzzle", "1.e4 *"],
			["chess", "", "1.d4 *"],
		]);
	});
});

describe("isPlayablePgn", () => {
	it("takes a PGN with moves", () => {
		expect(isPlayablePgn("1.e4 e5 2.Nf3 *")).toBe(true);
		expect(isPlayablePgn('[FEN "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"]\n\n1.Ra8# *')).toBe(true);
	});

	it("drops a malformed or empty PGN", () => {
		expect(isPlayablePgn("garbage")).toBe(false);
		expect(isPlayablePgn("")).toBe(false);
		expect(isPlayablePgn('[Event "x"]')).toBe(false);
	});
});

describe("mapInBatches", () => {
	it("keeps order and reports progress per batch", async () => {
		const progress: number[] = [];
		const out = await mapInBatches([1, 2, 3, 4, 5], 2, async (n) => n * 10, (done) => progress.push(done));
		expect(out).toEqual([10, 20, 30, 40, 50]);
		expect(progress).toEqual([2, 4, 5]);
	});

	it("runs at most size at a time", async () => {
		let running = 0;
		let peak = 0;
		await mapInBatches([1, 2, 3, 4, 5, 6, 7], 3, async () => {
			running++;
			peak = Math.max(peak, running);
			await new Promise((r) => setTimeout(r, 1));
			running--;
		});
		expect(peak).toBe(3);
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

describe("fenceLineFor", () => {
	const text = [
		"```chessboard type:fen interactive:false board:brown title:\"A\"",
		"8/8/8/8/8/8/8/K6k w - - 0 1",
		"```",
		"> ```pgn interactive:false start_at:end",
		"> 1.e4 e5 *",
		"> ```",
	].join("\n");

	it("finds a block's options by its source", () => {
		expect(fenceLineFor(text, "chessboard", "8/8/8/8/8/8/8/K6k w - - 0 1\n")).toBe('type:fen interactive:false board:brown title:"A"');
		expect(fenceLineFor(text, "pgn", "1.e4 e5 *")).toBe("interactive:false start_at:end");
	});

	it("is empty when no block of that language has the source", () => {
		expect(fenceLineFor(text, "chessboard", "1.e4 e5 *")).toBe("");
	});

	// Two blocks with the same PGN and different options (#122).
	const twins = [
		'```chessboard type:pgn interactive:false start_at:start title:"Start"',
		"1.e4 e5 2.Nf3 *",
		"```",
		"",
		'```chessboard type:pgn interactive:false start_at:end title:"End"',
		"1.e4 e5 2.Nf3 *",
		"```",
	].join("\n");

	it("gives each of two blocks with the same source its own options, by order", () => {
		expect(fenceLineFor(twins, "chessboard", "1.e4 e5 2.Nf3 *", 0)).toBe('type:pgn interactive:false start_at:start title:"Start"');
		expect(fenceLineFor(twins, "chessboard", "1.e4 e5 2.Nf3 *", 1)).toBe('type:pgn interactive:false start_at:end title:"End"');
	});

	it("wraps an occurrence past the last block around", () => {
		expect(fenceLineFor(twins, "chessboard", "1.e4 e5 2.Nf3 *", 2)).toBe('type:pgn interactive:false start_at:start title:"Start"');
	});

	// #125: a tab inside the body is the renderer's source as written.
	it("matches a body with a literal tab and keeps the tab in its source", () => {
		const tabbed = ['```chessboard type:pgn interactive:false start_at:end title:"Tabbed"', "1.\te4 e5 *", "```"].join("\n");
		expect(findChessBlocks(tabbed)[0].source).toBe("1.\te4 e5 *");
		expect(fenceLineFor(tabbed, "chessboard", "1.\te4 e5 *\n")).toBe('type:pgn interactive:false start_at:end title:"Tabbed"');
	});

	it("keeps body tabs in a block inside a callout and a list item", () => {
		const nested = ["> - ```chessboard", ">   1.\te4\te5 *", ">   ```"].join("\n");
		expect(findChessBlocks(nested)[0].source).toBe("1.\te4\te5 *");
	});
});

describe("SourceOccurrences", () => {
	it("counts each source of a note in render order", () => {
		const occ = new SourceOccurrences();
		expect(occ.next("A.md", "chessboard", "1.e4 *", 0)).toBe(0);
		expect(occ.next("A.md", "chessboard", "1.d4 *", 10)).toBe(0);
		expect(occ.next("A.md", "chessboard", "1.e4 *\n", 20)).toBe(1);
		expect(occ.next("B.md", "chessboard", "1.e4 *", 30)).toBe(0);
		expect(occ.next("A.md", "pgn", "1.e4 *", 40)).toBe(0);
	});

	it("starts a note from zero after a quiet gap: a new export", () => {
		const occ = new SourceOccurrences(2000);
		occ.next("A.md", "chessboard", "1.e4 *", 0);
		occ.next("A.md", "chessboard", "1.e4 *", 100);
		expect(occ.next("A.md", "chessboard", "1.e4 *", 5000)).toBe(0);
		expect(occ.next("A.md", "chessboard", "1.e4 *", 5100)).toBe(1);
	});
});
