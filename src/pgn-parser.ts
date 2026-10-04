import { Chess } from "chess.js";
import { NAG_CODE_MAP, UNICODE_NAG_REGEX, UNICODE_NAG_MAP } from "./nag-data";
import { normalizeFen } from "./types";
import { extractEvalClock, type Evaluation } from "./eval-clock";

export interface MoveNode {
	san: string;
	fen: string;
	from: string;
	to: string;
	color: "w" | "b";
	moveNumber: number;
	comment: string | null;
	nag: string | null;
	variations: MoveNode[][];
	shapes: BoardShapes;
	// From [%eval] and [%clk] in the comment: the eval after this move and
	// the mover's clock in seconds.
	evaluation: Evaluation | null;
	clock: number | null;
}

export type ShapeColor = "G" | "R" | "Y" | "B";

export interface BoardShapes {
	arrows: { from: string; to: string; color: ShapeColor }[];
	squares: { square: string; color: ShapeColor }[];
}

export interface ParsedPgn {
	headers: Record<string, string>;
	startingFen: string;
	startingComment: string | null;
	startingShapes: BoardShapes;
	moves: MoveNode[];
	result: string | null;
}

type Token =
	| { type: "move"; value: string }
	| { type: "comment"; value: string }
	| { type: "variation_start" }
	| { type: "variation_end" }
	| { type: "move_number"; value: string }
	| { type: "nag"; value: string }
	| { type: "result"; value: string };

function tokenize(moveText: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;

	while (i < moveText.length) {
		const ch = moveText[i];

		if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
			i++;
			continue;
		}

		if (ch === "{") {
			const end = moveText.indexOf("}", i + 1);
			if (end === -1) {
				// Handle unclosed comment: capture to end of string
				tokens.push({ type: "comment", value: moveText.slice(i + 1).trim() });
				break;
			}
			tokens.push({ type: "comment", value: moveText.slice(i + 1, end).trim() });
			i = end + 1;
			continue;
		}

		if (ch === "(") {
			tokens.push({ type: "variation_start" });
			i++;
			continue;
		}

		if (ch === ")") {
			tokens.push({ type: "variation_end" });
			i++;
			continue;
		}

		if (ch === "$") {
			let j = i + 1;
			while (j < moveText.length && moveText[j] >= "0" && moveText[j] <= "9") j++;
			tokens.push({ type: "nag", value: moveText.slice(i, j) });
			i = j;
			continue;
		}

		if (ch === "1" && moveText.slice(i, i + 7) === "1/2-1/2") {
			tokens.push({ type: "result", value: "1/2-1/2" });
			i += 7;
			continue;
		}
		if ((ch === "1" || ch === "0") && moveText[i + 1] === "-" &&
			(moveText[i + 2] === "0" || moveText[i + 2] === "1")) {
			tokens.push({ type: "result", value: moveText.slice(i, i + 3) });
			i += 3;
			continue;
		}
		if (ch === "*") {
			tokens.push({ type: "result", value: "*" });
			i++;
			continue;
		}

		// Standalone evaluation annotations: +-  -+  +/-  -/+  +/=  =/+
		const standaloneEvalMatch = /^(\+[-/][-=]?|-[+/][+]?|=[+/][+-]?)/.exec(moveText.slice(i));
		if (standaloneEvalMatch) {
			tokens.push({ type: "nag", value: standaloneEvalMatch[0] });
			i += standaloneEvalMatch[0].length;
			continue;
		}

		const moveNumMatch = /^(\d+)(\.{1,3})/.exec(moveText.slice(i));
		if (moveNumMatch) {
			tokens.push({ type: "move_number", value: moveNumMatch[0] });
			i += moveNumMatch[0].length;
			while (i < moveText.length && moveText[i] === " ") i++;
			continue;
		}

		const sanMatch = /^([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?(?:\+(?![-/])|#)?|O-O-O(?:\+(?![-/])|#)?|O-O(?:\+(?![-/])|#)?)/.exec(moveText.slice(i));
		if (sanMatch) {
			tokens.push({ type: "move", value: sanMatch[0] });
			i += sanMatch[0].length;

			// Capture evaluation annotations (+-  -+  +/-  -/+  +=  =+) as NAG tokens
			const evalMatch = /^(\+[-/][-=]?|-[+/][+]?|=[+/][+-]?)/.exec(moveText.slice(i));
			if (evalMatch) {
				tokens.push({ type: "nag", value: evalMatch[0] });
				i += evalMatch[0].length;
			}

			// Capture standalone = (equal position) after a move
			// Must not be followed by a piece letter (promotion) or +/- (eval annotation)
			if (!evalMatch && moveText[i] === "=" && !/^=[QRBNP+\-/]/.test(moveText.slice(i))) {
				tokens.push({ type: "nag", value: "=" });
				i += 1;
			}

			// Capture ! ? !! ?? !? ?! symbols after moves as NAG tokens
			const nagSymMatch = /^([!?]{1,2})/.exec(moveText.slice(i));
			if (nagSymMatch) {
				tokens.push({ type: "nag", value: nagSymMatch[0] });
				i += nagSymMatch[0].length;
			}

			// Capture Unicode annotation symbols after moves (e.g., ⩲ ⩱ ± ∓)
			const unicodeAfterMove = UNICODE_NAG_REGEX.exec(moveText.slice(i));
			if (unicodeAfterMove) {
				tokens.push({ type: "nag", value: unicodeAfterMove[0] });
				i += unicodeAfterMove[0].length;
			}
			continue;
		}

		// Unicode annotation symbols appearing standalone (e.g., ⩲ ⩱ ± ∓ ∞)
		const unicodeNagMatch = UNICODE_NAG_REGEX.exec(moveText.slice(i));
		if (unicodeNagMatch) {
			tokens.push({ type: "nag", value: unicodeNagMatch[0] });
			i += unicodeNagMatch[0].length;
			continue;
		}

		i++;
	}

	return tokens;
}

function nagTokenToSymbol(value: string): string | null {
	// $N format -> look up in comprehensive map
	if (value.startsWith("$")) {
		return NAG_CODE_MAP[value] ?? null;
	}
	// Direct symbols: !, !!, ?, ??, !?, ?!
	if (/^[!?]{1,2}$/.test(value)) {
		return value;
	}
	// Evaluation annotations: =  +-  -+  +/-  -/+  +=  =+  etc.
	if (/^[+-=/]{1,3}$/.test(value)) {
		return value;
	}
	// Unicode symbols passed through directly
	if (UNICODE_NAG_MAP[value]) {
		return value;
	}
	return null;
}

function extractHeaders(pgn: string): { headers: Record<string, string>; moveText: string } {
	const headers: Record<string, string> = {};
	const lines = pgn.split("\n");
	let moveStartLine = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		const match = /^\[(\w+)\s+"(.*)"\]$/.exec(line);
		if (match) {
			headers[match[1]] = match[2];
			moveStartLine = i + 1;
		} else if (line === "") {
			if (Object.keys(headers).length > 0) {
				moveStartLine = i + 1;
			}
		} else {
			break;
		}
	}

	const moveText = lines.slice(moveStartLine).join("\n");
	return { headers, moveText };
}

function parseMoveSequence(
	tokens: Token[],
	pos: { idx: number },
	chess: Chess,
): { moves: MoveNode[]; startingComment: string | null } {
	const moves: MoveNode[] = [];
	const sequenceStartFen = chess.fen();
	let startingComment: string | null = null;

	while (pos.idx < tokens.length) {
		const token = tokens[pos.idx];

		if (token.type === "variation_end") {
			break;
		}

		if (token.type === "comment") {
			if (moves.length === 0) {
				startingComment = startingComment
					? startingComment + " " + token.value
					: token.value;
			} else {
				const lastMove = moves[moves.length - 1];
				lastMove.comment = lastMove.comment
					? lastMove.comment + " " + token.value
					: token.value;
			}
			pos.idx++;
			continue;
		}

		if (token.type === "nag") {
			// Attach NAG to the last move if one exists
			if (moves.length > 0) {
				const lastMove = moves[moves.length - 1];
				if (lastMove.nag === null) {
					lastMove.nag = nagTokenToSymbol(token.value);
				}
			}
			pos.idx++;
			continue;
		}

		if (token.type === "move_number" || token.type === "result") {
			pos.idx++;
			continue;
		}

		if (token.type === "variation_start") {
			pos.idx++;

			// Check for empty variation ()
			if (pos.idx < tokens.length && tokens[pos.idx].type === "variation_end") {
				pos.idx++;
				continue;
			}

			const parentMove = moves.length >= 1 ? moves[moves.length - 1] : null;

			// Determine the correct starting FEN for this variation.
			// Standard PGN: variation replaces parent move (use pre-move FEN).
			// Continuation: variation shows responses after parent move (use post-move FEN).
			// We peek at the first move token and test which FEN accepts it.
			const preFen = parentMove ? getPreMoveFen(parentMove, moves, sequenceStartFen) : chess.fen();
			const postFen = parentMove ? parentMove.fen : chess.fen();

			let varFen = preFen;
			if (parentMove && preFen !== postFen) {
				// Find the first move token in this variation
				const firstMoveToken = findFirstMoveToken(tokens, pos.idx);
				if (firstMoveToken) {
					// Test which FEN accepts this move
					const preWorks = testMove(preFen, firstMoveToken);
					const postWorks = testMove(postFen, firstMoveToken);
					if (!preWorks && postWorks) {
						varFen = postFen;
					}
				}
			}

			let varChess: Chess;
			try {
				varChess = new Chess(varFen);
			} catch {
				let depth = 1;
				while (pos.idx < tokens.length && depth > 0) {
					if (tokens[pos.idx].type === "variation_start") depth++;
					if (tokens[pos.idx].type === "variation_end") depth--;
					pos.idx++;
				}
				continue;
			}

			const varResult = parseMoveSequence(tokens, pos, varChess);

			if (pos.idx < tokens.length && tokens[pos.idx].type === "variation_end") {
				pos.idx++;
			}
			if (parentMove && varResult.moves.length > 0) {
				if (varResult.startingComment && varResult.moves[0]) {
					varResult.moves[0].comment = varResult.moves[0].comment
						? varResult.startingComment + " " + varResult.moves[0].comment
						: varResult.startingComment;
				}
				parentMove.variations.push(varResult.moves);
			}
			continue;
		}

		if (token.type === "move") {
			try {
				const result = chess.move(token.value);
				const fenParts = result.before.split(" ");
				const moveNum = parseInt(fenParts[5] ?? "1");

				moves.push({
					san: result.san,
					fen: result.after,
					from: result.from,
					to: result.to,
					color: result.color,
					moveNumber: moveNum,
					comment: null,
					nag: null,
					variations: [],
					shapes: { arrows: [], squares: [] },
					evaluation: null,
					clock: null,
				});
			} catch {
				// Invalid move - skip
			}
			pos.idx++;
			continue;
		}

		pos.idx++;
	}

	return { moves, startingComment };
}

function findFirstMoveToken(tokens: Token[], startIdx: number): string | null {
	for (let i = startIdx; i < tokens.length; i++) {
		const t = tokens[i];
		if (t.type === "variation_end") return null;
		if (t.type === "move") return t.value;
	}
	return null;
}

function testMove(fen: string, san: string): boolean {
	try {
		const c = new Chess(fen);
		c.move(san);
		return true;
	} catch {
		return false;
	}
}

function getPreMoveFen(
	node: MoveNode,
	allMoves: MoveNode[],
	sequenceStartFen: string,
): string {
	const idx = allMoves.indexOf(node);
	if (idx <= 0) {
		return sequenceStartFen;
	}
	return allMoves[idx - 1].fen;
}

const SHAPE_COMMAND_REGEX = /\[%(cal|csl)\s+([^\]]*)\]/g;
const SHAPE_ARROW_REGEX = /^([GRYB])([a-h][1-8])([a-h][1-8])$/;
const SHAPE_SQUARE_REGEX = /^([GRYB])([a-h][1-8])$/;

// Takes the [%cal] arrows and [%csl] squares out of a comment. The text left
// over is what is shown; null when the comment held only drawings.
export function extractShapes(comment: string | null): { text: string | null; shapes: BoardShapes } {
	const shapes: BoardShapes = { arrows: [], squares: [] };
	if (comment === null) return { text: null, shapes };

	const text = comment.replace(SHAPE_COMMAND_REGEX, (_match, command: string, body: string) => {
		for (const entry of body.split(",").map((e) => e.trim())) {
			if (command === "cal") {
				const m = SHAPE_ARROW_REGEX.exec(entry);
				if (m && m[2] !== m[3]) {
					shapes.arrows.push({ from: m[2], to: m[3], color: m[1] as ShapeColor });
				}
			} else {
				const m = SHAPE_SQUARE_REGEX.exec(entry);
				if (m) shapes.squares.push({ square: m[2], color: m[1] as ShapeColor });
			}
		}
		return " ";
	}).replace(/\s+/g, " ").trim();

	return { text: text.length > 0 ? text : null, shapes };
}

const OPTION_ARROW_REGEX = /^([GRYB])?([a-h][1-8])([a-h][1-8])$/i;
const OPTION_SQUARE_REGEX = /^([GRYB])?([a-h][1-8])$/i;
const COLOR_NAMES: Record<string, ShapeColor> = {
	g: "G", green: "G",
	r: "R", red: "R",
	y: "Y", yellow: "Y",
	b: "B", blue: "B",
};

// One entry of an arrows:/squares: option: the [%cal]/[%csl] form with the
// colour letter optional (green when left out), or the colour after a colon,
// e.g. Rf7, f7, f7:red. Null for anything else.
function parseOptionEntry(entry: string, regex: RegExp): { color: ShapeColor; squares: string[] } | null {
	const [body, colorName, extra] = entry.split(":");
	if (extra !== undefined) return null;
	const m = regex.exec(body);
	if (!m) return null;
	// Own keys only: f7:constructor is not a colour.
	const key = colorName?.toLowerCase();
	const suffix = key !== undefined && Object.prototype.hasOwnProperty.call(COLOR_NAMES, key) ? COLOR_NAMES[key] : undefined;
	if (colorName !== undefined && (!suffix || m[1])) return null;
	const color = suffix ?? (m[1] ? (m[1].toUpperCase() as ShapeColor) : "G");
	return { color, squares: m.slice(2).map((s) => s.toLowerCase()) };
}

// The drawings from a FEN block's arrows:"e2e4,Rd8d1" and squares:"d5,Rf7"
// options, in the same shape as a comment's [%cal]/[%csl]. Entries are split
// on commas or spaces, and stray quotes (an unclosed arrows:"e2e4,g1f3) are
// dropped. Repeats are drawn once. Entries that do not parse are skipped,
// with a console warning that names them.
export function parseShapeOptions(arrows: string | null, squares: string | null): BoardShapes {
	const shapes: BoardShapes = { arrows: [], squares: [] };
	const skipped: string[] = [];
	const seen = new Set<string>();
	const entries = (value: string | null) => (value ?? "").replace(/"/g, "").split(/[\s,]+/).filter((e) => e.length > 0);
	for (const entry of entries(arrows)) {
		const parsed = parseOptionEntry(entry, OPTION_ARROW_REGEX);
		if (!parsed || parsed.squares[0] === parsed.squares[1]) {
			skipped.push(entry);
			continue;
		}
		const id = `a:${parsed.squares[0]}${parsed.squares[1]}`;
		if (seen.has(id)) continue;
		seen.add(id);
		shapes.arrows.push({ from: parsed.squares[0], to: parsed.squares[1], color: parsed.color });
	}
	for (const entry of entries(squares)) {
		const parsed = parseOptionEntry(entry, OPTION_SQUARE_REGEX);
		if (!parsed) {
			skipped.push(entry);
			continue;
		}
		const id = `s:${parsed.squares[0]}`;
		if (seen.has(id)) continue;
		seen.add(id);
		shapes.squares.push({ square: parsed.squares[0], color: parsed.color });
	}
	if (skipped.length > 0) {
		console.warn(`chess-notebook: skipped arrows:/squares: entries that do not parse: ${skipped.join(", ")}`);
	}
	return shapes;
}

// A move whose comment was only [%cal]/[%csl] drawings: nothing shows in the
// move list, but stepping to it draws on the board.
export function hasDrawingsOnly(node: MoveNode): boolean {
	return node.comment === null && (node.shapes.arrows.length > 0 || node.shapes.squares.length > 0);
}

function applyShapes(moves: MoveNode[]): void {
	for (const move of moves) {
		const { text: rest, evaluation, clock } = extractEvalClock(move.comment);
		const { text, shapes } = extractShapes(rest);
		move.comment = text;
		move.shapes = shapes;
		move.evaluation = evaluation;
		move.clock = clock;
		for (const variation of move.variations) applyShapes(variation);
	}
}

export function parsePgn(pgn: string): ParsedPgn {
	const { headers, moveText } = extractHeaders(pgn);
	const setupFen = headers["FEN"] || headers["fen"];
	const chess = setupFen ? new Chess(normalizeFen(setupFen)) : new Chess();
	const startingFen = chess.fen();

	const tokens = tokenize(moveText);
	const pos = { idx: 0 };
	const { moves, startingComment: rawStartingComment } = parseMoveSequence(tokens, pos, chess);
	applyShapes(moves);
	const { text: startingComment, shapes: startingShapes } = extractShapes(extractEvalClock(rawStartingComment).text);

	let result: string | null = null;
	for (const token of tokens) {
		if (token.type === "result") {
			result = token.value;
		}
	}

	return {
		headers,
		startingFen,
		startingComment,
		startingShapes,
		moves,
		result,
	};
}
