import { Chess } from "chess.js";
import { NAG_CODE_MAP, UNICODE_NAG_REGEX, UNICODE_NAG_MAP } from "./nag-data";
import { normalizeFen } from "./types";

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
}

export interface ParsedPgn {
	headers: Record<string, string>;
	startingFen: string;
	startingComment: string | null;
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
					color: result.color as "w" | "b",
					moveNumber: moveNum,
					comment: null,
					nag: null,
					variations: [],
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

export function parsePgn(pgn: string): ParsedPgn {
	const { headers, moveText } = extractHeaders(pgn);
	const setupFen = headers["FEN"] || headers["fen"];
	const chess = setupFen ? new Chess(normalizeFen(setupFen)) : new Chess();
	const startingFen = chess.fen();

	const tokens = tokenize(moveText);
	const pos = { idx: 0 };
	const { moves, startingComment } = parseMoveSequence(tokens, pos, chess);

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
		moves,
		result,
	};
}
