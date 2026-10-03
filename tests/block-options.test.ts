import { describe, expect, it } from "vitest";
import { parseOptions } from "../src/block-options";

describe("parseOptions", () => {
	it("reads the ordinary options", () => {
		const opts = parseOptions('type:fen board:blue size:large arrows:"Re2e4" squares:f7 flipped:true title:"Study"');
		expect(opts.board).toBe("blue");
		expect(opts.size).toBe(560);
		expect(opts.arrows).toBe("Re2e4");
		expect(opts.squares).toBe("f7");
		expect(opts.flipped).toBe(true);
		expect(opts.title).toBe("Study");
	});

	it("does not read options inside a quoted title", () => {
		const opts = parseOptions('type:pgn title:"my board:blue size:large"');
		expect(opts.title).toBe("my board:blue size:large");
		expect(opts.board).toBeNull();
		expect(opts.size).toBeNull();
	});

	it("does not read arrows, squares, diagram or interactive inside quotes", () => {
		const opts = parseOptions('title:"see arrows:e2e4 squares:f7" event:"Study diagram:true x" white:"a interactive:false b"');
		expect(opts.arrows).toBeNull();
		expect(opts.squares).toBeNull();
		expect(opts.diagram).toBe(false);
		expect(opts.event).toBe("Study diagram:true x");
	});

	it("does not read diagram: inside a quoted src: path", () => {
		const opts = parseOptions('src:"a diagram:true b.pgn"');
		expect(opts.src).toBe("a diagram:true b.pgn");
		expect(opts.diagram).toBe(false);
	});

	it("does not read pieces, start_at, mode, game or src inside quotes", () => {
		const opts = parseOptions('title:"pieces:alpha start_at:3 mode:puzzle game:2 src:x.pgn flipped:true"');
		expect(opts.pieces).toBeNull();
		expect(opts.startAt).toBe("start");
		expect(opts.mode).toBe("normal");
		expect(opts.game).toBeNull();
		expect(opts.src).toBeNull();
		expect(opts.flipped).toBe(false);
	});

	it("still reads options after a quoted value", () => {
		const opts = parseOptions('title:"my board:blue" board:wood diagram:true game:"Opera"');
		expect(opts.board).toBe("wood");
		expect(opts.diagram).toBe(true);
		expect(opts.game).toBe("Opera");
	});

	it("gives null for an inherited-key board name", () => {
		expect(parseOptions("board:constructor").board).toBeNull();
		expect(parseOptions("board:__proto__").board).toBeNull();
	});
});
