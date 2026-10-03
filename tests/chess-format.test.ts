import { describe, expect, it } from "vitest";
import { aliasType, detectChessFormat, looksLikeFen } from "../src/chess-format";

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
