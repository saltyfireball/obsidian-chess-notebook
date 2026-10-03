import { describe, expect, it } from "vitest";
import { parseBoardSize, resolveBoardSize } from "../src/board-size";

describe("parseBoardSize", () => {
	it("reads the named sizes", () => {
		expect(parseBoardSize("small")).toBe(300);
		expect(parseBoardSize("medium")).toBe(420);
		expect(parseBoardSize("LARGE")).toBe(560);
	});

	it("reads a pixel width, with or without px", () => {
		expect(parseBoardSize("360")).toBe(360);
		expect(parseBoardSize("360px")).toBe(360);
	});

	it("keeps a pixel width within limits", () => {
		expect(parseBoardSize("20")).toBe(160);
		expect(parseBoardSize("9000")).toBe(1600);
	});

	it("is null for anything else", () => {
		expect(parseBoardSize("huge")).toBeNull();
		expect(parseBoardSize("50%")).toBeNull();
		expect(parseBoardSize("")).toBeNull();
	});

	it("is null for names Object.prototype has", () => {
		expect(parseBoardSize("constructor")).toBeNull();
		expect(parseBoardSize("__proto__")).toBeNull();
		expect(parseBoardSize("toString")).toBeNull();
		expect(resolveBoardSize(parseBoardSize("constructor"), "large")).toBe(560);
	});
});

describe("resolveBoardSize", () => {
	it("prefers the block's size", () => {
		expect(resolveBoardSize(500, "small")).toBe(500);
	});

	it("falls back to the settings default, then medium", () => {
		expect(resolveBoardSize(null, "large")).toBe(560);
		expect(resolveBoardSize(null, "bogus")).toBe(420);
	});
});
