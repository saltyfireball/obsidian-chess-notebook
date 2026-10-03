import { describe, expect, it } from "vitest";
import { boardThemeClass, parseBoardTheme, resolveBoardTheme } from "../src/board-themes";

describe("parseBoardTheme", () => {
	it("knows each theme, in any case", () => {
		expect(parseBoardTheme("green")).toBe("green");
		expect(parseBoardTheme("Brown")).toBe("brown");
		expect(parseBoardTheme("BLUE")).toBe("blue");
		expect(parseBoardTheme("wood")).toBe("wood");
		expect(parseBoardTheme("grey")).toBe("grey");
	});

	it("takes gray for grey", () => {
		expect(parseBoardTheme("gray")).toBe("grey");
	});

	it("gives null for unknown or missing names", () => {
		expect(parseBoardTheme("purple")).toBeNull();
		expect(parseBoardTheme("")).toBeNull();
		expect(parseBoardTheme(null)).toBeNull();
	});
});

describe("resolveBoardTheme", () => {
	it("prefers the block's theme over the setting", () => {
		expect(resolveBoardTheme("blue", "brown")).toBe("blue");
	});

	it("falls back to the setting, then to green", () => {
		expect(resolveBoardTheme(null, "wood")).toBe("wood");
		expect(resolveBoardTheme(null, "nonsense")).toBe("green");
	});

	it("reads the old CSS class setting as green", () => {
		expect(resolveBoardTheme(null, "sfb-chess")).toBe("green");
	});
});

describe("boardThemeClass", () => {
	it("prefixes the theme name", () => {
		expect(boardThemeClass("grey")).toBe("sfb-board-grey");
	});
});
