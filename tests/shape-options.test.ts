import { afterEach, describe, expect, it, vi } from "vitest";
import { parseShapeOptions } from "../src/pgn-parser";

describe("parseShapeOptions", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("draws plain arrows in green", () => {
		expect(parseShapeOptions("e2e4,g1f3", null)).toEqual({
			arrows: [
				{ from: "e2", to: "e4", color: "G" },
				{ from: "g1", to: "f3", color: "G" },
			],
			squares: [],
		});
	});

	it("reads the [%cal]/[%csl] colour letters", () => {
		const shapes = parseShapeOptions("Ge2e4,Rd8d1,Yb1c3,Bb2b4", "d5,Rf7");
		expect(shapes.arrows.map((a) => a.color)).toEqual(["G", "R", "Y", "B"]);
		expect(shapes.arrows[3]).toEqual({ from: "b2", to: "b4", color: "B" });
		expect(shapes.squares).toEqual([
			{ square: "d5", color: "G" },
			{ square: "f7", color: "R" },
		]);
	});

	it("reads a colour name or letter after a colon", () => {
		expect(parseShapeOptions("c4f7:red", "d5:yellow,e5:b").squares).toEqual([
			{ square: "d5", color: "Y" },
			{ square: "e5", color: "B" },
		]);
		expect(parseShapeOptions("c4f7:red", null).arrows).toEqual([{ from: "c4", to: "f7", color: "R" }]);
	});

	it("survives a lowercased line", () => {
		// Options on a block's first line reach the parser lowercased.
		expect(parseShapeOptions("rd8d1", "bd5,b5").squares).toEqual([
			{ square: "d5", color: "B" },
			{ square: "b5", color: "G" },
		]);
		expect(parseShapeOptions("rd8d1", null).arrows).toEqual([{ from: "d8", to: "d1", color: "R" }]);
	});

	it("splits on commas and spaces", () => {
		expect(parseShapeOptions(" e2e4 , d2d4  c2c4", null).arrows).toHaveLength(3);
	});

	it("skips entries that do not parse, and warns with their names", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const shapes = parseShapeOptions("e2e2,Xe2e4,e9e4,e2e4:pink,Re2e4:red", "z9,Rf7:blue,d5:");
		expect(shapes).toEqual({ arrows: [], squares: [] });
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toContain("Re2e4:red");
		expect(String(warn.mock.calls[0][0])).toContain("z9");
	});

	it("does not warn when every entry parses", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		parseShapeOptions("e2e4", "f7:red");
		expect(warn).not.toHaveBeenCalled();
	});

	it("does not read inherited object keys as colour names", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(parseShapeOptions(null, "f7:constructor,f6:toString,f5:__proto__").squares).toEqual([]);
		expect(parseShapeOptions("e2e4:hasOwnProperty", null).arrows).toEqual([]);
	});

	it("drops stray quotes from an unclosed value", () => {
		expect(parseShapeOptions('"e2e4,g1f3', 'f7"').arrows).toEqual([
			{ from: "e2", to: "e4", color: "G" },
			{ from: "g1", to: "f3", color: "G" },
		]);
		expect(parseShapeOptions(null, '"f7"').squares).toEqual([{ square: "f7", color: "G" }]);
	});

	it("draws a repeated entry once", () => {
		expect(parseShapeOptions("e2e4,e2e4,Re2e4", null).arrows).toEqual([{ from: "e2", to: "e4", color: "G" }]);
		expect(parseShapeOptions(null, "f7,f7").squares).toHaveLength(1);
	});

	it("gives nothing for missing options", () => {
		expect(parseShapeOptions(null, null)).toEqual({ arrows: [], squares: [] });
	});
});
