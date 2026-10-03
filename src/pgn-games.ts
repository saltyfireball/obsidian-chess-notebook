// Splitting a PGN that holds several games (the usual shape of a site export)
// into one text per game, and naming and picking among them.

const RESULTS = ["1/2-1/2", "1-0", "0-1", "*"];

function isSpace(ch: string | undefined): boolean {
	return ch === undefined || ch === " " || ch === "\n" || ch === "\r" || ch === "\t";
}

function atLineStart(text: string, i: number): boolean {
	for (let j = i - 1; j >= 0; j--) {
		const ch = text[j];
		if (ch === "\n") return true;
		if (ch !== " " && ch !== "\t" && ch !== "\r") return false;
	}
	return true;
}

// The result token starting at i, if any: it must stand alone between spaces.
function resultAt(text: string, i: number): string | null {
	const before = text[i - 1];
	if (i > 0 && !isSpace(before) && before !== ")" && before !== "}") return null;
	for (const r of RESULTS) {
		if (text.startsWith(r, i) && isSpace(text[i + r.length])) return r;
	}
	return null;
}

// A game ends at its result, or where a new tag block starts after move text.
// Tags, comments and variations never end a game.
export function splitPgnGames(text: string): string[] {
	const games: string[] = [];
	let start = 0;
	let hasMoves = false;
	let depth = 0;
	let i = 0;

	const cut = (end: number): void => {
		const game = text.slice(start, end).trim();
		if (game.length > 0) games.push(game);
		start = end;
		hasMoves = false;
	};

	while (i < text.length) {
		const ch = text[i];
		if (isSpace(ch)) {
			i++;
			continue;
		}
		if (ch === "{") {
			const end = text.indexOf("}", i + 1);
			i = end === -1 ? text.length : end + 1;
			hasMoves = true;
			continue;
		}
		if (ch === ";" || (ch === "%" && atLineStart(text, i))) {
			const end = text.indexOf("\n", i);
			i = end === -1 ? text.length : end + 1;
			continue;
		}
		if (ch === "[" && depth === 0 && atLineStart(text, i)) {
			if (hasMoves) cut(i);
			const end = text.indexOf("\n", i);
			i = end === -1 ? text.length : end + 1;
			continue;
		}
		if (ch === "(") depth++;
		if (ch === ")") depth = Math.max(0, depth - 1);
		if (depth === 0) {
			const result = resultAt(text, i);
			if (result) {
				i += result.length;
				cut(i);
				continue;
			}
		}
		hasMoves = true;
		i++;
	}
	cut(text.length);
	return games;
}

function tagValue(game: string, tag: string): string | null {
	const m = new RegExp(`^\\s*\\[${tag}\\s+"([^"]*)"\\]`, "m").exec(game);
	if (!m) return null;
	const value = m[1].trim();
	return value === "" || /^\?+$/.test(value) ? null : value;
}

// "White vs Black" from the game's tags, or null when it names neither player.
export function gamePlayers(game: string): string | null {
	const white = tagValue(game, "White");
	const black = tagValue(game, "Black");
	if (!white && !black) return null;
	return `${white ?? "White"} vs ${black ?? "Black"}`;
}

// "Game 2 of 14 - White vs Black", index counted from zero.
export function gameLabel(games: string[], index: number): string {
	const players = gamePlayers(games[index] ?? "");
	const count = `Game ${index + 1} of ${games.length}`;
	return players ? `${count} - ${players}` : count;
}

function normalizeName(name: string): string {
	return name.toLowerCase().replace(/\bvs\.?(?=\s|$)/g, "vs").replace(/\s+/g, " ").trim();
}

// The game:N (1-based) or game:"White vs Black" option as an index from zero.
// Numbers past the end clamp; an unmatched name falls back to the first game.
export function pickGame(games: string[], choice: number | string | null): number {
	if (games.length === 0 || choice === null) return 0;
	if (typeof choice === "number") {
		return Math.min(Math.max(choice, 1), games.length) - 1;
	}
	const wanted = normalizeName(choice);
	const names = games.map((g) => normalizeName(gamePlayers(g) ?? ""));
	const exact = names.indexOf(wanted);
	if (exact >= 0) return exact;
	const partial = names.findIndex((n) => n.length > 0 && n.includes(wanted));
	return partial >= 0 ? partial : 0;
}
