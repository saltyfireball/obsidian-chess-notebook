// Reads a chessboard block's options from its fence line or header line.
import { parseBoardTheme } from "./board-themes";
import { parseBoardSize } from "./board-size";
import { srcOption } from "./chess-format";
import { execOutsideQuotes, matchAllOutsideQuotes } from "./option-line";
import type { CodeBlockOptions } from "./types";

// Every option is matched outside quoted values, so a title, src: path or
// other quoted text cannot switch on board:, arrows:, diagram: and the rest.
export function parseOptions(line: string): CodeBlockOptions {
	const opts: CodeBlockOptions = {
		center: true,
		mode: "normal",
		startAt: "start",
		flipped: false,
		diagram: false,
		explore: true,
		color: null,
		notation: "san",
		pieces: null,
		arrows: null,
		squares: null,
		board: null,
		size: null,
		title: null,
		white: null,
		black: null,
		event: null,
		site: null,
		date: null,
		round: null,
		eco: null,
		result: null,
		src: null,
		game: null,
	};
	const find = (pattern: RegExp) => execOutsideQuotes(pattern, line);

	opts.src = srcOption(line);

	const gameMatch = find(/game:(?:"([^"]+)"|(\d+))/i);
	if (gameMatch) {
		opts.game = gameMatch[1] ?? parseInt(gameMatch[2]);
	}

	const boolMatch = find(/center:(true|false)/i);
	if (boolMatch && boolMatch[1].toLowerCase() === "false") {
		opts.center = false;
	}

	if (find(/(?:^|\s)explore:false(?:\s|$)/i)) {
		opts.explore = false;
	}

	if (find(/(?:^|\s)(?:interactive:false|diagram:true)(?:\s|$)/i)) {
		opts.diagram = true;
	}

	const flippedMatch = find(/flipped:(true|false)/i);
	if (flippedMatch && flippedMatch[1].toLowerCase() === "true") {
		opts.flipped = true;
	}

	const modeMatch = find(/mode:(normal|puzzle|step|drill)/i);
	if (modeMatch) {
		const modeVal = modeMatch[1].toLowerCase();
		if (modeVal === "puzzle" || modeVal === "step" || modeVal === "drill") {
			opts.mode = modeVal;
		}
	}

	const colorMatch = find(/color:(white|black)/i);
	if (colorMatch) {
		opts.color = colorMatch[1].toLowerCase() === "black" ? "b" : "w";
	}

	const notationMatch = find(/notation:(san|fan)/i);
	if (notationMatch && notationMatch[1].toLowerCase() === "fan") {
		opts.notation = "fan";
	}

	const piecesMatch = find(/pieces:([\w-]+)/i);
	if (piecesMatch) {
		opts.pieces = piecesMatch[1].toLowerCase();
	}

	const arrowsMatch = find(/(?:^|\s)arrows:(?:"([^"]*)"|(\S+))/i);
	if (arrowsMatch) {
		opts.arrows = arrowsMatch[1] ?? arrowsMatch[2];
	}

	const squaresMatch = find(/(?:^|\s)squares:(?:"([^"]*)"|(\S+))/i);
	if (squaresMatch) {
		opts.squares = squaresMatch[1] ?? squaresMatch[2];
	}

	const boardMatch = find(/(?:^|\s)board:([\w-]+)/i);
	if (boardMatch) {
		opts.board = parseBoardTheme(boardMatch[1]);
	}

	const sizeMatch = find(/\bsize:(\w+)/i);
	if (sizeMatch) {
		opts.size = parseBoardSize(sizeMatch[1]);
	}

	const startAtMatch = find(/start_at:(\w+)/i);
	if (startAtMatch) {
		const val = startAtMatch[1].toLowerCase();
		if (val === "end") {
			opts.startAt = "end";
		} else if (val !== "start") {
			const num = parseInt(val);
			if (!isNaN(num) && num >= 0) {
				opts.startAt = num;
			}
		}
	}

	for (const match of matchAllOutsideQuotes(/(\w+):"([^"]*)"/, line)) {
		const key = match[1].toLowerCase();
		const value = match[2];
		if (key === "title") opts.title = value;
		else if (key === "white") opts.white = value;
		else if (key === "black") opts.black = value;
		else if (key === "event") opts.event = value;
		else if (key === "site") opts.site = value;
		else if (key === "date") opts.date = value;
		else if (key === "round") opts.round = value;
		else if (key === "eco") opts.eco = value;
		else if (key === "result") opts.result = value;
	}

	return opts;
}
