import { describe, expect, it } from "vitest";
import { aliasBlock, aliasType, blockType, detectChessFormat, looksLikeFen, srcOption, typeOption } from "../src/chess-format";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("looksLikeFen", () => {
	it("accepts a full FEN and a board-only FEN", () => {
		expect(looksLikeFen(START)).toBe(true);
		expect(looksLikeFen("8/8/8/8/8/8/8/K6k")).toBe(true);
	});

	it("rejects move text", () => {
		expect(looksLikeFen("1.e4 e5")).toBe(false);
	});
});

describe("detectChessFormat", () => {
	it("finds a FEN, and a FEN sequence", () => {
		expect(detectChessFormat(START)).toBe("fen");
		expect(detectChessFormat(`${START}\n\n8/8/8/8/8/8/8/K6k w - - 0 1\n`)).toBe("fen");
	});

	it("finds a PGN by its tags", () => {
		expect(detectChessFormat('[Event "Casual"]\n[White "A"]\n\n*')).toBe("pgn");
	});

	it("finds a PGN by its move numbers", () => {
		expect(detectChessFormat("1.e4 e5 2.Nf3 Nc6 *")).toBe("pgn");
		expect(detectChessFormat("1. d4 d5")).toBe("pgn");
		expect(detectChessFormat("12... Qxd5")).toBe("pgn");
	});

	it("is null for anything else", () => {
		expect(detectChessFormat("")).toBeNull();
		expect(detectChessFormat("   \n ")).toBeNull();
		expect(detectChessFormat("buy milk")).toBeNull();
		expect(detectChessFormat("version 2.0 notes")).toBeNull();
	});
});

describe("aliasType", () => {
	it("fixes the type for pgn and fen blocks", () => {
		expect(aliasType("pgn", START)).toBe("pgn");
		expect(aliasType("fen", "1.e4 e5")).toBe("fen");
	});

	it("detects the type for chess blocks, falling back to FEN", () => {
		expect(aliasType("chess", "1.e4 e5 *")).toBe("pgn");
		expect(aliasType("chess", START)).toBe("fen");
		expect(aliasType("chess", "nonsense")).toBe("fen");
	});

	it("goes by the src: file's extension for chess blocks", () => {
		expect(aliasType("chess", "", "Games/Opera Game.pgn")).toBe("pgn");
		expect(aliasType("chess", "", "Positions/start.FEN")).toBe("fen");
	});
});

describe("srcOption", () => {
	it("reads a quoted or bare path, keeping its case", () => {
		expect(srcOption('type:pgn src:"Games/Opera Game.pgn"')).toBe("Games/Opera Game.pgn");
		expect(srcOption("src:Games/opera.pgn title:x")).toBe("Games/opera.pgn");
		expect(srcOption("type:pgn")).toBeNull();
	});
});

describe("typeOption", () => {
	it("reads type:fen and type:pgn in any case", () => {
		expect(typeOption("type:fen board:blue")).toBe("fen");
		expect(typeOption("title:x TYPE:PGN")).toBe("pgn");
		expect(typeOption("board:blue")).toBeNull();
	});

	it("does not read a type: inside a quoted value", () => {
		expect(typeOption('title:"type:fen trick"')).toBeNull();
		expect(typeOption('title:"Study type:fen" type:pgn')).toBe("pgn");
		expect(typeOption('src:"Games/type:fen.pgn"')).toBeNull();
	});
});

describe("blockType", () => {
	it("takes the header's type, then the fence's", () => {
		expect(blockType("type:pgn", "type:fen board:blue")).toEqual({ type: "fen", inHeader: true });
		expect(blockType("type:pgn", "1.e4 e5 *")).toEqual({ type: "pgn", inHeader: false });
		expect(blockType("", "1.e4 e5 *")).toBeNull();
	});

	it("does not read a type: inside a quoted title on the fence or header", () => {
		expect(blockType('type:pgn title:"Study type:fen"', "1.e4 e5 *")).toEqual({ type: "pgn", inHeader: false });
		expect(blockType('title:"type:fen trick"', "1.e4 e5 *")).toBeNull();
		expect(blockType("type:pgn", 'title:"type:fen trick"')).toEqual({ type: "pgn", inHeader: false });
	});
});

describe("aliasBlock", () => {
	it("leaves a block alone when its first line has a type:", () => {
		const source = 'type:pgn src:"Games/opera.pgn"';
		expect(aliasBlock("chess", "", source)).toEqual({ fenceLine: "", source });
		expect(aliasBlock("fen", "", source)).toEqual({ fenceLine: "", source });
	});

	it("leaves a block alone when its fence line has a type:", () => {
		expect(aliasBlock("pgn", "type:fen", START)).toEqual({ fenceLine: "type:fen", source: START });
	});

	it("puts the type on a src: header, from the file's extension", () => {
		expect(aliasBlock("chess", "", 'src:"Games/opera.pgn"')).toEqual({
			fenceLine: "",
			source: 'type:pgn src:"Games/opera.pgn"',
		});
		expect(aliasBlock("chess", "", "src:Positions/a.fen\n")).toEqual({
			fenceLine: "",
			source: "type:fen src:Positions/a.fen\n",
		});
	});

	it("puts the fence's type on a src: header when the fence has one", () => {
		expect(aliasBlock("chess", "type:pgn", 'src:"Games/Opera.pgn"')).toEqual({
			fenceLine: "type:pgn",
			source: 'type:pgn src:"Games/Opera.pgn"',
		});
		// The fence's explicit type wins over the file's extension.
		expect(aliasBlock("chess", "type:fen", "src:Games/a.pgn\n")).toEqual({
			fenceLine: "type:fen",
			source: "type:fen src:Games/a.pgn\n",
		});
	});

	it("does not take a src: inside a quoted title as a header", () => {
		const source = 'title:"see src:a.pgn"\n1.e4 e5 *';
		expect(aliasBlock("chess", "type:pgn", source)).toEqual({ fenceLine: "type:pgn", source });
	});

	it("infers the type when the only type: is inside a quoted title", () => {
		expect(aliasBlock("chess", 'title:"Study type:fen"', "1.e4 e5 *")).toEqual({
			fenceLine: 'type:pgn title:"Study type:fen"',
			source: "1.e4 e5 *",
		});
		const source = 'title:"type:fen trick"\n1.e4 e5 *';
		expect(aliasBlock("chess", "", source)).toEqual({ fenceLine: "type:pgn", source });
	});

	it("puts the type on the fence line otherwise", () => {
		expect(aliasBlock("chess", "title:x", "1.e4 e5 *")).toEqual({ fenceLine: "type:pgn title:x", source: "1.e4 e5 *" });
		expect(aliasBlock("chess", "src:Games/a.pgn", "")).toEqual({ fenceLine: "type:pgn src:Games/a.pgn", source: "" });
		expect(aliasBlock("fen", "", START)).toEqual({ fenceLine: "type:fen", source: START });
	});
});
