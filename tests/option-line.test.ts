import { describe, expect, it } from "vitest";
import { execOutsideQuotes, maskQuoted, matchAllOutsideQuotes } from "../src/option-line";

describe("maskQuoted", () => {
	it("blanks the text inside quotes, keeping the quotes and the length", () => {
		const line = 'title:"my board:blue size:large" board:wood';
		const masked = maskQuoted(line);
		expect(masked).toBe(`title:"${" ".repeat(24)}" board:wood`);
		expect(masked).toHaveLength(line.length);
	});

	it("masks each quoted span on its own", () => {
		expect(maskQuoted('white:"A b" black:"C"')).toBe('white:"   " black:" "');
	});

	it("leaves an unclosed quote and unquoted lines alone", () => {
		expect(maskQuoted('arrows:"e2e4,g1f3')).toBe('arrows:"e2e4,g1f3');
		expect(maskQuoted("type:pgn board:blue")).toBe("type:pgn board:blue");
	});
});

describe("execOutsideQuotes", () => {
	it("does not match inside a quoted value", () => {
		const line = 'title:"my board:blue size:large"';
		expect(execOutsideQuotes(/(?:^|\s)board:([\w-]+)/i, line)).toBeNull();
		expect(execOutsideQuotes(/\bsize:(\w+)/i, line)).toBeNull();
	});

	it("matches the option outside the quotes", () => {
		const m = execOutsideQuotes(/(?:^|\s)board:([\w-]+)/i, 'title:"my board:blue" board:wood');
		expect(m?.[1]).toBe("wood");
	});

	it("reads a quoted value back as written", () => {
		const m = execOutsideQuotes(/(?:^|\s)arrows:(?:"([^"]*)"|(\S+))/i, 'title:"x" arrows:"Re2e4 g1f3"');
		expect(m?.[1]).toBe("Re2e4 g1f3");
	});
});

describe("matchAllOutsideQuotes", () => {
	it("finds every key:\"value\" outside other values", () => {
		const found = matchAllOutsideQuotes(/(\w+):"([^"]*)"/, 'title:"see white:x" black:"B"');
		expect(found.map((m) => [m[1], m[2]])).toEqual([
			["title", "see white:x"],
			["black", "B"],
		]);
		// Unquoted keys inside a value are not keys.
		expect(matchAllOutsideQuotes(/(\w+):"([^"]*)"/, 'title:"a" x:y').map((m) => m[1])).toEqual(["title"]);
	});

	it("keeps the case of the values", () => {
		const found = matchAllOutsideQuotes(/(\w+):"([^"]*)"/, 'Title:"My Game" White:"Kasparov, G"');
		expect(found.map((m) => m[2])).toEqual(["My Game", "Kasparov, G"]);
	});
});
