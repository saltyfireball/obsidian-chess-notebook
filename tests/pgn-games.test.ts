import { describe, expect, it } from "vitest";
import { gameLabel, gamePlayers, pickGame, splitPgnGames } from "../src/pgn-games";

const EXPORT = `[Event "Club"]
[White "Ann"]
[Black "Bob"]
[Result "1-0"]

1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7# 1-0

[Event "Club"]
[White "Cid"]
[Black "Dee"]
[Result "1/2-1/2"]

1.d4 d5 {A comment with 1-0 inside} 2.c4 (2.Nf3 *) e6 1/2-1/2

[Event "Club"]
[White "Eve"]
[Black "?"]

1.c4 *
`;

describe("splitPgnGames", () => {
	it("splits an export into one text per game", () => {
		const games = splitPgnGames(EXPORT);
		expect(games).toHaveLength(3);
		expect(games[0].startsWith('[Event "Club"]')).toBe(true);
		expect(games[0].endsWith("4.Qxf7# 1-0")).toBe(true);
		expect(games[1]).toContain("1.d4 d5");
		expect(games[2]).toContain("1.c4 *");
	});

	it("ignores results inside comments and variations", () => {
		const games = splitPgnGames(EXPORT);
		expect(games[1].endsWith("e6 1/2-1/2")).toBe(true);
	});

	it("splits games without tags at their results", () => {
		expect(splitPgnGames("1.e4 e5 1-0\n1.d4 d5 0-1\n\n1.c4 *")).toEqual([
			"1.e4 e5 1-0",
			"1.d4 d5 0-1",
			"1.c4 *",
		]);
	});

	it("splits at a tag block after move text with no result", () => {
		const games = splitPgnGames('[White "A"]\n\n1.e4 e5\n\n[White "B"]\n\n1.d4');
		expect(games).toEqual(['[White "A"]\n\n1.e4 e5', '[White "B"]\n\n1.d4']);
	});

	it("keeps a single game whole", () => {
		const one = '[White "A"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 1-0';
		expect(splitPgnGames(one)).toEqual([one]);
		expect(splitPgnGames("1.e4 e5 2.Nf3")).toEqual(["1.e4 e5 2.Nf3"]);
	});

	it("drops a comment before the first tag block instead of making it a game", () => {
		expect(splitPgnGames('{Export note}\n[White "A"]\n[Black "B"]\n1.e4 e5 *')).toEqual([
			'[White "A"]\n[Black "B"]\n1.e4 e5 *',
		]);
	});

	it("keeps a comment after a result with that game", () => {
		expect(splitPgnGames("1.e4 e5 * {end note}")).toEqual(["1.e4 e5 * {end note}"]);
	});

	it("keeps a comment between games with the game before it", () => {
		const text = '[White "A"]\n\n1.e4 e5 1-0 {Black resigns}\n\n[White "B"]\n\n1.d4 *\n; trailer\n{last word}\n';
		const games = splitPgnGames(text);
		expect(games).toEqual([
			'[White "A"]\n\n1.e4 e5 1-0 {Black resigns}',
			'[White "B"]\n\n1.d4 *\n; trailer\n{last word}',
		]);
		expect(pickGame(games, 2)).toBe(1);
		expect(gamePlayers(games[pickGame(games, 2)])).toBe("B vs Black");
	});

	it("keeps a comment inside a tag block's game", () => {
		const text = '[White "A"]\n{opening note}\n1.e4 *';
		expect(splitPgnGames(text)).toEqual([text]);
	});

	it("still returns comment-only text as its one entry", () => {
		expect(splitPgnGames("{just a note}")).toEqual(["{just a note}"]);
	});

	it("does not take castling or move numbers for results", () => {
		expect(splitPgnGames("1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.O-O 10-0")).toHaveLength(1);
	});
});

describe("gamePlayers and gameLabel", () => {
	const games = splitPgnGames(EXPORT);

	it("names the players, with a placeholder for a missing one", () => {
		expect(gamePlayers(games[0])).toBe("Ann vs Bob");
		expect(gamePlayers(games[2])).toBe("Eve vs Black");
		expect(gamePlayers("1.e4 *")).toBeNull();
	});

	it("labels a game with its place and players", () => {
		expect(gameLabel(games, 1)).toBe("Game 2 of 3 - Cid vs Dee");
		expect(gameLabel(["1.e4 *", "1.d4 *"], 0)).toBe("Game 1 of 2");
	});
});

describe("pickGame", () => {
	const games = splitPgnGames(EXPORT);

	it("takes a 1-based number and clamps it", () => {
		expect(pickGame(games, 2)).toBe(1);
		expect(pickGame(games, 0)).toBe(0);
		expect(pickGame(games, 99)).toBe(2);
		expect(pickGame(games, null)).toBe(0);
	});

	it("finds a game by its players", () => {
		expect(pickGame(games, "cid vs. dee")).toBe(1);
		expect(pickGame(games, "Eve")).toBe(2);
		expect(pickGame(games, "Nobody vs Else")).toBe(0);
	});
});
