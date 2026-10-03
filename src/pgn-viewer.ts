import { Chess } from "chess.js";
import { BoardManager } from "./board-manager";
import { hasDrawingsOnly, parsePgn, type BoardShapes, type MoveNode } from "./pgn-parser";
import { getNagInfo } from "./nag-data";
import { drawReason, positionKey } from "./draw";
import { copyWithFeedback, ICON_COPY, ICON_FEN } from "./clipboard";
import { moveLabel, PuzzleTally, renderPuzzleReport } from "./puzzle-report";
import { HintProgress } from "./hints";
import { drillChoices, findChoice, pickChoice, type DrillChoice, type DrillCursor } from "./drill";
import { resolvePieceSet, getPieceDataUri, STANDARD_PIECE_SET, type FanPieceKey } from "./fan-pieces";
import type { ChessSettings, CodeBlockOptions, PgnHeaders, ChessMode, Notation } from "./types";

interface FlatMove {
	node: MoveNode;
	id: string;
	// Times the position after this move has occurred in its line, itself included.
	repeats: number;
}

const ICON_PUZZLE = "M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-2 .9-2 2v3.8h1.5c1.38 0 2.5 1.12 2.5 2.5S4.88 15.8 3.5 15.8H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z";
const ICON_STEP = "M21 13a9 9 0 1 1-9-9M21 3v5h-5";
const ICON_HINT = "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z";
const ICON_REFRESH = "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 21v-5h5";
const ICON_PLAY = "M8 5v14l11-7z";
const ICON_PAUSE = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";
const NO_SHAPES: BoardShapes = { arrows: [], squares: [] };

export class PgnViewer {
	private boardManager: BoardManager;
	private mainlineMoves: MoveNode[] = [];
	private allFlatMoves: FlatMove[] = [];
	private currentMoveId: string | null = null;
	private startingFen: string;
	private startingComment: string | null = null;
	private startingShapes: BoardShapes = { arrows: [], squares: [] };
	private drawBadge: HTMLElement;
	private title: string | null = null;
	private headers: PgnHeaders;
	private moveElements: Map<string, HTMLElement> = new Map();
	private commentElements: Map<string, HTMLElement> = new Map();
	private startingCommentEl: HTMLElement | null = null;
	private movesContainer: HTMLElement;
	private result: string | null = null;

	private puzzleMode = false;
	private puzzleComplete = false;
	private stepMode = false;
	// Which of the move-to-find's hint steps are showing.
	private hintProgress = new HintProgress<MoveNode>();
	private hintComment: HTMLElement | null = null;
	private boardColumn: HTMLElement | null = null;
	private puzzleHighWater = -1;
	private puzzleTally = new PuzzleTally();
	private puzzleReport: HTMLElement | null = null;
	private puzzleBtn: HTMLElement | null = null;
	private stepBtn: HTMLElement | null = null;
	private hintBtn: HTMLElement | null = null;
	private resetBtn: HTMLElement | null = null;
	private autoPlayBtn: HTMLElement | null = null;
	private initialMode: ChessMode;

	private puzzleColor: "w" | "b" = "w";

	// Drill mode: you play puzzleColor, the board replies with a move picked
	// from the PGN's line or its variations.
	private drillMode = false;
	private drillComplete = false;
	private drillCursor: DrillCursor = { line: [], idx: 0 };
	private drillPath: MoveNode[] = [];
	private drillStatus: HTMLElement | null = null;
	private drillBranches: string[] = [];
	private notation: Notation = "san";
	private pieceSetName: string = STANDARD_PIECE_SET;
	private pieceSetReady = false;

	private autoPlaying = false;
	private autoPlayTimer: number | null = null;
	private autoPlaySpeed: number;
	private timers = new Set<number>();

	private wrapper: HTMLElement;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
	private rawPgn: string;

	constructor(container: HTMLElement, pgn: string, options: CodeBlockOptions, settings: ChessSettings) {
		this.rawPgn = pgn;
		const parsed = parsePgn(pgn);

		if (parsed.moves.length === 0) {
			container.createDiv({
				cls: "sfb-chess-error",
				text: "No valid moves found. Check that the notation is valid and includes move numbers (e.g. 1.e4 e5 2.Nf3).",
			});
			this.headers = { event: null, site: null, white: null, black: null, result: null, date: null, round: null, eco: null };
			this.startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
			this.initialMode = "normal";
			this.autoPlaySpeed = settings.autoPlaySpeed;
			this.movesContainer = container;
			this.wrapper = container;
			this.boardManager = null as unknown as BoardManager;
			return;
		}

		this.headers = this.buildHeaders(parsed.headers);
		this.applyHeaderOverrides(options);
		this.startingFen = parsed.startingFen;
		this.startingComment = parsed.startingComment;
		this.startingShapes = parsed.startingShapes;
		this.mainlineMoves = parsed.moves;
		this.result = parsed.result;
		this.initialMode = options.mode;
		this.autoPlaySpeed = settings.autoPlaySpeed;
		this.notation = options.notation;
		this.pieceSetName = resolvePieceSet(options.pieces ?? settings.fanPieceSet);

		this.allFlatMoves = [];
		this.flattenMoves(parsed.moves, "m", [positionKey(this.startingFen)]);

		this.wrapper = container.createDiv({ cls: "sfb-chess-container sfb-chess-pgn" });
		this.wrapper.setAttribute("tabindex", "0");

		if (this.hasHeaderInfo()) {
			this.buildHeader(this.wrapper);
		}

		const content = this.wrapper.createDiv({ cls: "sfb-chess-content" });
		const boardColumn = content.createDiv({ cls: "sfb-chess-board-column" });
		const boardWrapper = boardColumn.createDiv({ cls: "sfb-chess-board-wrapper" });

		this.initBoard(boardWrapper, boardColumn, content, options, settings);
	}

	private initBoard(
		boardWrapper: HTMLElement,
		boardColumn: HTMLElement,
		content: HTMLElement,
		options: CodeBlockOptions,
		settings: ChessSettings,
	): void {
		this.pieceSetReady = this.notation === "fan";
		this.boardManager = new BoardManager(boardWrapper, this.startingFen, settings, this.pieceSetName);
		this.drawBadge = boardWrapper.createDiv({ cls: "sfb-chess-draw-badge" });
		this.updateDrawBadge(this.startingFen, 1);
		if (options.flipped) {
			this.boardManager.flip();
			this.puzzleColor = "b";
		}
		if (options.mode === "drill" && options.color) {
			if (options.color !== this.puzzleColor) this.boardManager.flip();
			this.puzzleColor = options.color;
		}
		this.boardColumn = boardColumn;
		this.buildControls(boardColumn);

		const sidebar = content.createDiv({ cls: "sfb-chess-sidebar" });
		this.movesContainer = sidebar.createDiv({ cls: "sfb-chess-moves" });

		this.buildMoveList();
		this.boardManager.showShapes(this.startingShapes);
		this.applyStartAt(options.startAt);
		this.updateActiveComment();

		if (this.initialMode === "drill") {
			this.activateDrillMode();
		} else if (this.initialMode === "puzzle") {
			this.togglePuzzleMode();
		} else if (this.initialMode === "step") {
			this.toggleStepMode();
		}

		this.registerKeyboardShortcuts();
	}

	private registerKeyboardShortcuts(): void {
		this.keyboardHandler = (e: KeyboardEvent) => {
			switch (e.key) {
				case "ArrowLeft":
					e.preventDefault();
					this.stopAutoPlay();
					this.prevMove();
					break;
				case "ArrowRight":
					e.preventDefault();
					this.stopAutoPlay();
					this.nextMove();
					break;
				case "Home":
					e.preventDefault();
					this.stopAutoPlay();
					this.goToStart();
					break;
				case "End":
					e.preventDefault();
					this.stopAutoPlay();
					this.goToEnd();
					break;
				case "f":
				case "F":
					e.preventDefault();
					this.flip();
					break;
			}
		};
		this.wrapper.addEventListener("keydown", this.keyboardHandler);
	}

	// path holds the position keys of the line so far. A variation replaces its
	// parent move, so it continues from the path before that move.
	private flattenMoves(moves: MoveNode[], prefix: string, path: string[]): void {
		const startLength = path.length;
		for (let i = 0; i < moves.length; i++) {
			const node = moves[i];
			const id = prefix + "-" + i;
			const key = positionKey(node.fen);
			const repeats = path.filter((k) => k === key).length + 1;
			this.allFlatMoves.push({ node, id, repeats });
			for (let v = 0; v < node.variations.length; v++) {
				this.flattenMoves(node.variations[v], id + "v" + v, path);
			}
			path.push(key);
		}
		path.length = startLength;
	}

	private buildHeaders(raw: Record<string, string>): PgnHeaders {
		return {
			event: this.cleanVal(raw["Event"]),
			site: this.cleanVal(raw["Site"]),
			white: this.cleanVal(raw["White"]),
			black: this.cleanVal(raw["Black"]),
			result: this.cleanVal(raw["Result"]),
			date: this.cleanVal(raw["Date"]),
			round: this.cleanVal(raw["Round"]),
			eco: this.cleanVal(raw["ECO"]),
		};
	}

	private cleanVal(value: string | undefined): string | null {
		if (!value) return null;
		const trimmed = value.trim();
		if (trimmed === "" || trimmed === "?" || trimmed === "??" || /^\?+(\.\?+)*$/.test(trimmed)) {
			return null;
		}
		return trimmed;
	}

	private applyHeaderOverrides(options: CodeBlockOptions): void {
		if (options.title) this.title = options.title;
		if (options.white) this.headers.white = options.white;
		if (options.black) this.headers.black = options.black;
		if (options.event) this.headers.event = options.event;
		if (options.site) this.headers.site = options.site;
		if (options.date) this.headers.date = options.date;
		if (options.round) this.headers.round = options.round;
		if (options.eco) this.headers.eco = options.eco;
		if (options.result) this.headers.result = options.result;
	}

	private hasHeaderInfo(): boolean {
		return !!(this.title || this.headers.white || this.headers.black || this.headers.event || this.headers.result);
	}

	private buildHeader(wrapper: HTMLElement): void {
		const hasPlayers = this.headers.white || this.headers.black;
		const meta: string[] = [];
		if (this.headers.result && this.headers.result !== "*") meta.push(this.headers.result);
		if (this.headers.event) meta.push(this.headers.event);
		if (this.headers.site) meta.push(this.headers.site);
		if (this.headers.date) meta.push(this.headers.date);
		if (this.headers.round) meta.push("Round: " + this.headers.round);
		if (this.headers.eco) meta.push("ECO: " + this.headers.eco);

		if (!this.title && !hasPlayers && meta.length === 0) return;

		const header = wrapper.createDiv({ cls: "sfb-chess-header" });
		if (this.title) {
			header.createDiv({ cls: "sfb-chess-title", text: this.title });
		}
		if (hasPlayers) {
			const players = header.createDiv({ cls: "sfb-chess-players" });
			players.createSpan({ cls: "sfb-chess-white-name", text: this.headers.white ?? "White" });
			players.createSpan({ cls: "sfb-chess-vs", text: " vs. " });
			players.createEl("strong", { text: this.headers.black ?? "Black" });
		}
		if (meta.length > 0) {
			header.createDiv({ cls: "sfb-chess-meta", text: meta.join(" | ") });
		}
	}

	private buildMoveList(): void {
		this.moveElements = new Map();
		this.commentElements = new Map();

		if (this.startingComment) {
			const el = this.movesContainer.createDiv({
				cls: "sfb-chess-move-comment sfb-chess-comment-dimmed",
			});
			this.renderCommentText(el, this.startingComment);
			el.dataset.commentFor = "start";
			this.startingCommentEl = el;
			this.commentElements.set("start", el);
		}

		this.renderMoveSequence(this.mainlineMoves, this.movesContainer, "m", false);

		if (this.result && this.result !== "*") {
			this.movesContainer.createDiv({ cls: "sfb-chess-move-result", text: this.result });
		}
	}

	private renderMoveSequence(
		moves: MoveNode[],
		container: HTMLElement,
		prefix: string,
		isVariation: boolean,
	): void {
		let rowIndex = 0;

		for (let i = 0; i < moves.length; i++) {
			const node = moves[i];
			const moveId = prefix + "-" + i;

			if (node.color === "w") {
				const nextNode = moves[i + 1];
				const hasBlack = nextNode !== undefined && nextNode.color === "b";

				if (node.comment !== null && hasBlack) {
					const row1 = this.createMoveRow(container, rowIndex++, isVariation);
					this.addMoveNumber(row1, node.moveNumber);
					this.addMoveSpan(row1, node.san, moveId, node);
					row1.createSpan({ cls: "sfb-chess-move sfb-chess-move-spacer", text: "..." });
					this.addComment(container, node.comment, moveId);

					this.renderVariations(container, node);

					const blackId = prefix + "-" + (i + 1);
					const row2 = this.createMoveRow(container, rowIndex++, isVariation);
					this.addMoveNumber(row2, node.moveNumber);
					row2.createSpan({ cls: "sfb-chess-move sfb-chess-move-spacer", text: "..." });
					this.addMoveSpan(row2, nextNode.san, blackId, nextNode);

					if (nextNode.comment) {
						this.addComment(container, nextNode.comment, blackId);
					}
					this.renderVariations(container, nextNode);
					i++;
				} else {
					const row = this.createMoveRow(container, rowIndex++, isVariation);
					this.addMoveNumber(row, node.moveNumber);
					this.addMoveSpan(row, node.san, moveId, node);

					if (hasBlack) {
						const blackId = prefix + "-" + (i + 1);
						this.addMoveSpan(row, nextNode.san, blackId, nextNode);

						if (node.comment) this.addComment(container, node.comment, moveId);
						this.renderVariations(container, node);
						if (nextNode.comment) this.addComment(container, nextNode.comment, blackId);
						this.renderVariations(container, nextNode);
						i++;
					} else {
						if (node.comment) this.addComment(container, node.comment, moveId);
						this.renderVariations(container, node);
					}
				}
			} else if (i === 0 || moves[i - 1].color !== "w") {
				const row = this.createMoveRow(container, rowIndex++, isVariation);
				this.addMoveNumber(row, node.moveNumber);
				row.createSpan({ cls: "sfb-chess-move sfb-chess-move-spacer", text: "..." });
				this.addMoveSpan(row, node.san, moveId, node);

				if (node.comment) this.addComment(container, node.comment, moveId);
				this.renderVariations(container, node);
			}
		}
	}

	private renderVariations(container: HTMLElement, node: MoveNode): void {
		for (let v = 0; v < node.variations.length; v++) {
			const variation = node.variations[v];
			if (variation.length === 0) continue;

			const flatMove = this.allFlatMoves.find((fm) => fm.node === node);
			const parentId = flatMove?.id ?? "x";
			const varPrefix = parentId + "v" + v;

			const varContainer = container.createDiv({ cls: "sfb-chess-variation" });
			varContainer.dataset.parentMoveId = parentId;
			this.renderMoveSequence(variation, varContainer, varPrefix, true);
		}
	}

	private createMoveRow(container: HTMLElement, index: number, isVariation: boolean): HTMLElement {
		let cls = "sfb-chess-move-row";
		if (index % 2 === 1) cls += " sfb-chess-move-row-alt";
		if (isVariation) cls += " sfb-chess-move-row-var";
		return container.createDiv({ cls });
	}

	private addMoveNumber(row: HTMLElement, num: number): void {
		row.createSpan({ cls: "sfb-chess-move-number", text: num + "." });
	}

	private addMoveSpan(row: HTMLElement, san: string, id: string, node: MoveNode): void {
		const span = row.createSpan({ cls: "sfb-chess-move" });
		span.dataset.moveId = id;
		span.dataset.san = san;
		span.dataset.color = node.color;
		span.addEventListener("click", () => {
			this.stopAutoPlay();
			this.handleMoveClick(id);
		});
		this.moveElements.set(id, span);

		// Render move text (FAN or SAN)
		const textSpan = span.createSpan({ cls: "sfb-chess-move-text" });
		if (this.pieceSetReady) {
			this.renderFanMove(textSpan, san, node.color);
		} else {
			textSpan.textContent = san;
		}

		if (node.nag) {
			const info = getNagInfo(node.nag);
			const cls = info ? info.cssClass : "sfb-chess-nag-eval";
			const symbol = info ? info.symbol : node.nag;
			const tooltip = info ? info.description : node.nag;
			const nagSpan = span.createSpan({
				cls: "sfb-chess-nag " + cls,
				text: symbol,
			});
			nagSpan.setAttribute("title", tooltip);
			nagSpan.setAttribute("aria-label", tooltip);
		}

		if (hasDrawingsOnly(node)) {
			span.createSpan({
				cls: "sfb-chess-drawing-dot",
				attr: { title: "Has board drawings", "aria-label": "Has board drawings" },
			});
		}
	}

	private renderFanMove(container: HTMLElement, san: string, color: "w" | "b"): void {
		const pieceLetters: Record<string, FanPieceKey> = {
			K: (color + "K") as FanPieceKey,
			Q: (color + "Q") as FanPieceKey,
			R: (color + "R") as FanPieceKey,
			B: (color + "B") as FanPieceKey,
			N: (color + "N") as FanPieceKey,
		};

		const firstChar = san[0];
		if (firstChar && pieceLetters[firstChar]) {
			const uri = getPieceDataUri(this.pieceSetName, pieceLetters[firstChar]);
			if (uri) {
				container.empty();
				const img = container.createEl("img", { cls: "sfb-chess-fan-piece" });
				img.src = uri;
				img.alt = firstChar;
				container.appendText(san.slice(1));
				return;
			}
		}

		container.textContent = san;
	}

	private addComment(container: HTMLElement, text: string, moveId: string): void {
		const el = container.createDiv({
			cls: "sfb-chess-move-comment sfb-chess-comment-dimmed",
		});
		this.renderCommentText(el, text);
		el.dataset.commentFor = moveId;
		this.commentElements.set(moveId, el);
	}

	// Comment text is plain text except **bold** runs.
	private renderCommentText(el: HTMLElement, text: string): void {
		const parts = text.split(/\*\*(.+?)\*\*/g);
		parts.forEach((part, i) => {
			if (i % 2 === 1) {
				el.createEl("strong", { text: part });
			} else if (part.length > 0) {
				el.appendText(part);
			}
		});
	}

	private handleMoveClick(id: string): void {
		if (this.puzzleMode || this.stepMode) {
			const idx = this.getMainlineIndex(id);
			if (idx !== null) {
				const maxIdx = this.getMaxRevealedIndex();
				if (idx <= maxIdx) {
					this.goToMoveById(id);
				}
			} else {
				this.goToMoveById(id);
			}
			return;
		}
		this.goToMoveById(id);
	}

	private buildControls(wrapper: HTMLElement): void {
		const controls = wrapper.createDiv({ cls: "sfb-chess-controls" });

		this.puzzleBtn = this.createToggleButton(controls, "Puzzle mode", ICON_PUZZLE, () => {
			this.stopAutoPlay();
			this.togglePuzzleMode();
		});
		this.stepBtn = this.createStrokeToggleButton(controls, "Step mode", ICON_STEP, () => {
			this.stopAutoPlay();
			this.toggleStepMode();
		});
		this.resetBtn = this.createStrokeToggleButton(controls, "Reset puzzle", ICON_REFRESH, () => this.resetPuzzle());
		this.resetBtn.addClass("sfb-chess-btn-hidden");
		this.hintBtn = this.createToggleButton(controls, "Hint", ICON_HINT, () => this.showHint());
		this.hintBtn.addClass("sfb-chess-btn-hidden");

		controls.createDiv({ cls: "sfb-chess-controls-sep" });

		this.createNavButton(controls, "Flip board", "M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z", () => this.flip());
		this.autoPlayBtn = this.createNavButton(controls, "Auto-play", ICON_PLAY, () => this.toggleAutoPlay());
		this.createNavButton(controls, "First move", "M6 6h2v12H6zM18 6v12l-6-6 6-6z", () => { this.stopAutoPlay(); this.goToStart(); });
		this.createNavButton(controls, "Previous move", "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z", () => { this.stopAutoPlay(); this.prevMove(); });
		this.createNavButton(controls, "Next move", "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z", () => { this.stopAutoPlay(); this.nextMove(); });
		this.createNavButton(controls, "Last move", "M16 18V6h2v12h-2zM8 18V6l6 6-6 6z", () => { this.stopAutoPlay(); this.goToEnd(); });

		controls.createDiv({ cls: "sfb-chess-controls-sep" });

		const copyFen: HTMLElement = this.createNavButton(controls, "Copy FEN", ICON_FEN, () =>
			copyWithFeedback(copyFen, this.currentFen(), "FEN", (fn, ms) => this.later(fn, ms)));
		const copyPgn: HTMLElement = this.createNavButton(controls, "Copy PGN", ICON_COPY, () =>
			copyWithFeedback(copyPgn, this.rawPgn, "PGN", (fn, ms) => this.later(fn, ms)));
	}

	// The position on the board: the start, or the move the viewer is on.
	private currentFen(): string {
		const flat = this.allFlatMoves.find((fm) => fm.id === this.currentMoveId);
		return flat ? flat.node.fen : this.startingFen;
	}

	private createNavButton(parent: HTMLElement, label: string, iconPath: string, handler: () => void): HTMLElement {
		const btn = parent.createEl("button", { cls: "sfb-chess-btn", attr: { "aria-label": label } });
		const svg = createSvg("svg");
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("width", "18");
		svg.setAttribute("height", "18");
		const path = createSvg("path");
		path.setAttribute("fill", "currentColor");
		path.setAttribute("d", iconPath);
		svg.appendChild(path);
		btn.appendChild(svg);
		btn.addEventListener("click", handler);
		return btn;
	}

	private createStrokeToggleButton(parent: HTMLElement, label: string, iconPath: string, handler: () => void): HTMLElement {
		const btn = parent.createEl("button", { cls: "sfb-chess-btn sfb-chess-toggle-btn", attr: { "aria-label": label } });
		const svg = createSvg("svg");
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("width", "18");
		svg.setAttribute("height", "18");
		svg.setAttribute("fill", "none");
		svg.setAttribute("stroke", "currentColor");
		svg.setAttribute("stroke-width", "2");
		svg.setAttribute("stroke-linecap", "round");
		svg.setAttribute("stroke-linejoin", "round");
		const path = createSvg("path");
		path.setAttribute("d", iconPath);
		svg.appendChild(path);
		btn.appendChild(svg);
		btn.addEventListener("click", handler);
		return btn;
	}

	private createToggleButton(parent: HTMLElement, label: string, iconPath: string, handler: () => void): HTMLElement {
		const btn = parent.createEl("button", { cls: "sfb-chess-btn sfb-chess-toggle-btn", attr: { "aria-label": label } });
		const svg = createSvg("svg");
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("width", "18");
		svg.setAttribute("height", "18");
		const path = createSvg("path");
		path.setAttribute("fill", "currentColor");
		path.setAttribute("d", iconPath);
		svg.appendChild(path);
		btn.appendChild(svg);
		btn.addEventListener("click", handler);
		return btn;
	}

	// --- Auto-play ---

	private toggleAutoPlay(): void {
		if (this.puzzleMode || this.stepMode || this.drillMode) return;
		if (this.autoPlaying) {
			this.stopAutoPlay();
		} else {
			this.startAutoPlay();
		}
	}

	private startAutoPlay(): void {
		this.autoPlaying = true;
		this.updateAutoPlayIcon();
		this.autoPlayBtn?.addClass("sfb-chess-toggle-active");
		this.scheduleAutoPlayStep();
	}

	private stopAutoPlay(): void {
		if (!this.autoPlaying) return;
		this.autoPlaying = false;
		if (this.autoPlayTimer !== null) {
			window.clearTimeout(this.autoPlayTimer);
			this.autoPlayTimer = null;
		}
		this.updateAutoPlayIcon();
		this.autoPlayBtn?.removeClass("sfb-chess-toggle-active");
	}

	private scheduleAutoPlayStep(): void {
		if (!this.autoPlaying) return;
		this.autoPlayTimer = window.setTimeout(() => {
			this.autoPlayTimer = null;
			if (!this.autoPlaying) return;

			// Check if we can advance
			if (this.currentMoveId === null) {
				if (this.mainlineMoves.length > 0) {
					this.goToMoveById("m-0");
					this.scheduleAutoPlayStep();
				} else {
					this.stopAutoPlay();
				}
				return;
			}

			const match = /^m-(\d+)$/.exec(this.currentMoveId);
			if (match) {
				const idx = parseInt(match[1]);
				if (idx < this.mainlineMoves.length - 1) {
					this.goToMoveById("m-" + (idx + 1));
					this.scheduleAutoPlayStep();
				} else {
					this.stopAutoPlay();
				}
			} else {
				this.stopAutoPlay();
			}
		}, this.autoPlaySpeed);
	}

	private updateAutoPlayIcon(): void {
		if (!this.autoPlayBtn) return;
		const svg = this.autoPlayBtn.querySelector("svg");
		if (!svg) return;
		const path = svg.querySelector("path");
		if (!path) return;
		path.setAttribute("d", this.autoPlaying ? ICON_PAUSE : ICON_PLAY);
	}

	// --- Mode toggles ---

	private togglePuzzleMode(): void {
		if (this.stepMode) {
			this.deactivateStepMode();
		}
		if (this.puzzleMode) {
			this.deactivatePuzzleMode();
		} else {
			this.activatePuzzleMode();
		}
	}

	private toggleStepMode(): void {
		if (this.puzzleMode) {
			this.deactivatePuzzleMode();
		}
		if (this.stepMode) {
			this.deactivateStepMode();
		} else {
			this.activateStepMode();
		}
	}

	private activatePuzzleMode(): void {
		this.puzzleMode = true;
		this.puzzleComplete = false;
		this.clearHint();
		this.clearPuzzleReport();
		this.puzzleBtn?.addClass("sfb-chess-toggle-active");
		this.stepBtn?.addClass("sfb-chess-btn-hidden");
		this.resetBtn?.removeClass("sfb-chess-btn-hidden");
		this.hintBtn?.removeClass("sfb-chess-btn-hidden");
		this.resetBoardPosition();
		this.autoPlayOpponentIfNeeded();
		this.updateMoveVisibility();
		this.enablePuzzleInput();
	}

	private deactivatePuzzleMode(): void {
		this.puzzleMode = false;
		this.puzzleComplete = false;
		this.clearHint();
		this.clearPuzzleReport();
		this.puzzleBtn?.removeClass("sfb-chess-toggle-active");
		this.stepBtn?.removeClass("sfb-chess-btn-hidden");
		this.resetBtn?.addClass("sfb-chess-btn-hidden");
		this.hintBtn?.addClass("sfb-chess-btn-hidden");
		this.boardManager.disablePuzzleInput();
		this.revealAllMoves();
		this.resetBoardPosition();
	}

	private activateStepMode(): void {
		this.stepMode = true;
		this.stepBtn?.addClass("sfb-chess-toggle-active");
		this.puzzleBtn?.addClass("sfb-chess-btn-hidden");
		this.updateMoveVisibility();
	}

	private deactivateStepMode(): void {
		this.stepMode = false;
		this.stepBtn?.removeClass("sfb-chess-toggle-active");
		this.puzzleBtn?.removeClass("sfb-chess-btn-hidden");
		this.revealAllMoves();
	}

	private resetPuzzle(): void {
		if (this.drillMode) {
			this.startDrillRun();
			return;
		}
		if (!this.puzzleMode) return;
		this.puzzleComplete = false;
		this.puzzleHighWater = -1;
		this.clearHint();
		this.clearPuzzleReport();
		this.boardManager.disablePuzzleInput();
		this.goToStart();
		this.puzzleMode = true;
		this.autoPlayOpponentIfNeeded();
		this.updateMoveVisibility();
		this.enablePuzzleInput();
	}

	// --- Move visibility ---

	private getCurrentMainlineIndex(): number {
		if (this.currentMoveId === null) return -1;
		const match = /^m-(\d+)$/.exec(this.currentMoveId);
		if (match) return parseInt(match[1]);
		return -1;
	}

	private getMainlineIndex(id: string): number | null {
		const match = /^m-(\d+)$/.exec(id);
		if (match) return parseInt(match[1]);
		return null;
	}

	private updateMoveVisibility(): void {
		const revealedIdx = this.puzzleMode ? this.puzzleHighWater : this.getCurrentMainlineIndex();
		const currentIdx = revealedIdx;
		for (let i = 0; i < this.mainlineMoves.length; i++) {
			const id = "m-" + i;
			const moveEl = this.moveElements.get(id);
			const commentEl = this.commentElements.get(id);
			const row = moveEl?.parentElement;
			if (i > currentIdx) {
				moveEl?.addClass("sfb-chess-move-hidden");
				commentEl?.addClass("sfb-chess-move-hidden");
				if (row) this.maybeHideRow(row, id);
			} else {
				moveEl?.removeClass("sfb-chess-move-hidden");
				commentEl?.removeClass("sfb-chess-move-hidden");
				if (row) row.removeClass("sfb-chess-row-hidden");
			}
		}
		this.updateVariationVisibility(currentIdx);
	}

	private updateVariationVisibility(currentIdx: number): void {
		const variations = this.movesContainer.querySelectorAll(".sfb-chess-variation");
		for (let i = 0; i < variations.length; i++) {
			const varEl = variations[i] as HTMLElement;
			const parentId = varEl.dataset.parentMoveId;
			if (!parentId) continue;
			const parentIdx = this.getMainlineIndex(parentId);
			if (parentIdx !== null && parentIdx <= currentIdx) {
				varEl.removeClass("sfb-chess-variation-hidden");
			} else {
				varEl.addClass("sfb-chess-variation-hidden");
			}
		}
	}

	private maybeHideRow(row: HTMLElement, hiddenMoveId: string): void {
		const movesInRow: HTMLElement[] = [];
		const children = row.childNodes;
		for (let c = 0; c < children.length; c++) {
			const child = children[c];
			if (child.instanceOf(HTMLElement) && child.hasClass("sfb-chess-move") && !child.hasClass("sfb-chess-move-spacer")) {
				movesInRow.push(child);
			}
		}
		const allHidden = movesInRow.every((el) => el.hasClass("sfb-chess-move-hidden"));
		if (allHidden) {
			row.addClass("sfb-chess-row-hidden");
		} else {
			row.removeClass("sfb-chess-row-hidden");
			const spacers: HTMLElement[] = [];
			for (let c = 0; c < children.length; c++) {
				const child = children[c];
				if (child.instanceOf(HTMLElement) && child.hasClass("sfb-chess-move-spacer")) {
					spacers.push(child);
				}
			}
			const hiddenEl = this.moveElements.get(hiddenMoveId);
			if (hiddenEl) {
				for (const sp of spacers) {
					const spIdx = Array.prototype.indexOf.call(children, sp);
					const hidIdx = Array.prototype.indexOf.call(children, hiddenEl);
					if (Math.abs(spIdx - hidIdx) <= 1) {
						sp.addClass("sfb-chess-move-hidden");
					}
				}
			}
		}
	}

	private revealAllMoves(): void {
		for (const [, el] of this.moveElements) {
			el.removeClass("sfb-chess-move-hidden");
		}
		for (const [, el] of this.commentElements) {
			el.removeClass("sfb-chess-move-hidden");
		}
		const rows = this.movesContainer.querySelectorAll(".sfb-chess-row-hidden");
		for (let i = 0; i < rows.length; i++) {
			(rows[i] as HTMLElement).removeClass("sfb-chess-row-hidden");
		}
		const hiddenVars = this.movesContainer.querySelectorAll(".sfb-chess-variation-hidden");
		for (let i = 0; i < hiddenVars.length; i++) {
			(hiddenVars[i] as HTMLElement).removeClass("sfb-chess-variation-hidden");
		}
		const hiddenSpacers = this.movesContainer.querySelectorAll(".sfb-chess-move-spacer.sfb-chess-move-hidden");
		for (let i = 0; i < hiddenSpacers.length; i++) {
			(hiddenSpacers[i] as HTMLElement).removeClass("sfb-chess-move-hidden");
		}
	}

	private dimVariations(): void {
		const variations = this.movesContainer.querySelectorAll(".sfb-chess-variation");
		for (let i = 0; i < variations.length; i++) {
			(variations[i] as HTMLElement).addClass("sfb-chess-variation-dimmed");
		}
	}

	private undimVariations(): void {
		const variations = this.movesContainer.querySelectorAll(".sfb-chess-variation");
		for (let i = 0; i < variations.length; i++) {
			(variations[i] as HTMLElement).removeClass("sfb-chess-variation-dimmed");
		}
	}

	// --- Puzzle mode logic ---

	private autoPlayOpponentIfNeeded(): void {
		const currentFen = this.getCurrentFen();
		const sideToMove = currentFen.split(" ")[1] === "b" ? "b" : "w";
		if (sideToMove === this.puzzleColor) return;

		const nextIdx = this.getCurrentMainlineIndex() + 1;
		if (nextIdx >= this.mainlineMoves.length) return;

		if (nextIdx > this.puzzleHighWater) this.puzzleHighWater = nextIdx;
		this.goToMoveById("m-" + nextIdx);
	}

	private enablePuzzleInput(): void {
		const currentFen = this.getCurrentFen();
		const chess = new Chess(currentFen);
		const sideToMove = currentFen.split(" ")[1] === "b" ? "b" : "w";

		this.boardManager.enablePuzzleInput(
			(square: string) => {
				try {
					const piece = chess.get(square as "a1");
					return piece !== undefined && piece.color === sideToMove;
				} catch {
					return false;
				}
			},
			(from: string, to: string) => {
				try {
					const testChess = new Chess(currentFen);
					const result = testChess.move({ from, to, promotion: "q" });
					return result !== null;
				} catch {
					return false;
				}
			},
			(from: string, to: string) => {
				if (this.drillMode) this.handleDrillMove(from, to);
				else this.handlePuzzleMove(from, to);
			},
		);
	}

	private getCurrentFen(): string {
		if (this.currentMoveId === null) return this.startingFen;
		const flat = this.allFlatMoves.find((fm) => fm.id === this.currentMoveId);
		return flat ? flat.node.fen : this.startingFen;
	}

	private handlePuzzleMove(from: string, to: string): void {
		if (this.puzzleComplete) return;

		const currentIdx = this.getCurrentMainlineIndex();
		const nextIdx = currentIdx + 1;
		if (nextIdx >= this.mainlineMoves.length) {
			this.resetBoardPosition();
			return;
		}

		const expected = this.mainlineMoves[nextIdx];
		if (from === expected.from && to === expected.to) {
			this.onCorrectPuzzleMove(nextIdx);
			return;
		}

		this.puzzleTally.recordWrong(nextIdx);
		this.boardManager.flashWrong();
		this.boardManager.disablePuzzleInput();
		this.later(() => {
			this.resetBoardPosition();
			if (this.puzzleMode && !this.puzzleComplete) {
				this.enablePuzzleInput();
			}
		}, 600);
	}

	private resetBoardPosition(): void {
		if (this.currentMoveId === null) {
			this.showBoardAt(null);
		} else {
			const flat = this.allFlatMoves.find((fm) => fm.id === this.currentMoveId);
			if (flat) this.showBoardAt(flat);
		}
	}

	// Puts the board at the position after flat (the start when null), with its
	// last-move highlight, the drawings from its comment and any draw.
	private showBoardAt(flat: FlatMove | null): void {
		if (flat === null) {
			void this.boardManager.setPosition(this.startingFen, true);
			this.boardManager.clearHighlights();
			this.updateDrawBadge(this.startingFen, 1);
		} else {
			const node = flat.node;
			void this.boardManager.setPosition(node.fen, true);
			this.boardManager.highlightLastMove(node.from, node.to);
			this.updateDrawBadge(node.fen, flat.repeats);
		}
		// An unsolved puzzle shows no drawings: a study often draws the answer
		// on the move before it.
		const hidden = this.puzzleMode && !this.puzzleComplete;
		const shapes = flat ? flat.node.shapes : this.startingShapes;
		this.boardManager.showShapes(hidden ? NO_SHAPES : shapes);
	}

	private updateDrawBadge(fen: string, repeats: number): void {
		const reason = drawReason(fen, repeats);
		this.drawBadge.toggleClass("is-hidden", reason === null);
		this.drawBadge.setText(reason ? "1/2 " + reason : "");
	}

	private onCorrectPuzzleMove(idx: number): void {
		const id = "m-" + idx;
		if (idx > this.puzzleHighWater) this.puzzleHighWater = idx;
		this.puzzleTally.recordCorrect(idx);
		this.clearHint();
		this.updateMoveVisibility();
		this.goToMoveById(id);

		const nextOpponentIdx = idx + 1;
		if (nextOpponentIdx < this.mainlineMoves.length) {
			this.boardManager.disablePuzzleInput();
			this.later(() => {
				if (nextOpponentIdx > this.puzzleHighWater) this.puzzleHighWater = nextOpponentIdx;
				this.updateMoveVisibility();
				const opponentId = "m-" + nextOpponentIdx;
				this.goToMoveById(opponentId);
				if (nextOpponentIdx + 1 < this.mainlineMoves.length) {
					this.enablePuzzleInput();
				} else {
					this.showPuzzleComplete();
				}
			}, 500);
		} else {
			this.showPuzzleComplete();
		}
	}

	private showPuzzleComplete(): void {
		this.puzzleComplete = true;
		this.boardManager.disablePuzzleInput();
		this.resetBoardPosition();
		this.showPuzzleReport(this.mainlineMoves);
		this.showCompleteBanner("Puzzle complete!");
	}

	private showCompleteBanner(text: string): void {
		const boardWrapper = this.wrapper.querySelector(".sfb-chess-board-wrapper");
		if (!boardWrapper) return;

		const banner = (boardWrapper as HTMLElement).createDiv({ cls: "sfb-chess-puzzle-complete" });
		banner.textContent = text;

		const dismiss = (): void => {
			banner.remove();
		};

		banner.addEventListener("click", dismiss);
		this.later(dismiss, 3000);
	}

	// The end-of-puzzle report goes under the controls; each missed move in it
	// jumps the board to that move. The tally's indexes point into moves.
	private showPuzzleReport(moves: MoveNode[]): void {
		this.clearPuzzleReportEl();
		if (!this.boardColumn) return;
		this.puzzleReport = renderPuzzleReport(
			this.boardColumn,
			this.puzzleTally,
			(idx) => {
				const node = moves[idx];
				return node ? moveLabel(node.moveNumber, node.color, node.san) : "?";
			},
			(idx) => {
				const id = moves[idx] ? this.idOf(moves[idx]) : null;
				if (id) this.goToMoveById(id);
			},
		);
	}

	private clearPuzzleReport(): void {
		this.puzzleTally.reset();
		this.clearPuzzleReportEl();
	}

	private clearPuzzleReportEl(): void {
		this.puzzleReport?.remove();
		this.puzzleReport = null;
	}

	// Each press shows the next step for the move to find: its comment, then
	// the piece to move, then the move as an arrow.
	private showHint(): void {
		const expected = this.moveToFind();
		if (!expected) return;
		if (this.hintProgress.isStale(expected)) this.clearHint();
		const next = this.hintProgress.next(expected, expected.comment);
		if (!next) return;

		const { step, last } = next;
		if (step === "comment" && expected.comment) {
			this.showHintComment(expected.comment);
		} else if (step === "piece") {
			this.boardManager.addHintFromMarker(expected.from);
		} else if (step === "arrow") {
			this.boardManager.addHintArrow(expected.from, expected.to);
		}
		this.hintBtn?.toggleClass("sfb-chess-toggle-active", !last);
		this.hintBtn?.toggleClass("sfb-chess-toggle-active-strong", last);
	}

	private drillRunning(): boolean {
		return this.drillMode && !this.drillComplete;
	}

	private moveToFind(): MoveNode | null {
		if (this.drillMode) {
			if (this.drillComplete) return null;
			return drillChoices(this.drillCursor)[0]?.node ?? null;
		}
		if (!this.puzzleMode || this.puzzleComplete) return null;
		return this.mainlineMoves[this.getCurrentMainlineIndex() + 1] ?? null;
	}

	// --- Drill mode ---

	private activateDrillMode(): void {
		this.drillMode = true;
		this.puzzleBtn?.addClass("sfb-chess-btn-hidden");
		this.stepBtn?.addClass("sfb-chess-btn-hidden");
		this.resetBtn?.removeClass("sfb-chess-btn-hidden");
		this.resetBtn?.setAttribute("aria-label", "Restart drill");
		this.hintBtn?.removeClass("sfb-chess-btn-hidden");
		this.startDrillRun();
	}

	private startDrillRun(): void {
		this.drillComplete = false;
		this.drillCursor = { line: this.mainlineMoves, idx: 0 };
		this.drillPath = [];
		this.clearHint();
		this.clearPuzzleReport();
		this.drillBranches = [];
		this.setDrillStatus(null);
		this.boardManager.clearWrongArrow();
		this.movesContainer.addClass("sfb-chess-moves-hidden");
		this.currentMoveId = null;
		this.showBoardAt(null);
		this.updateActiveMove();
		this.updateActiveComment();
		this.continueDrill();
	}

	// Your turn: wait for your move. The board's turn: play one of the PGN's
	// moves after a short pause. Nothing left: the drill is over.
	private continueDrill(): void {
		const choices = drillChoices(this.drillCursor);
		if (choices.length === 0) {
			this.finishDrill();
			return;
		}
		if (this.sideToMove() === this.puzzleColor) {
			this.enablePuzzleInput();
			return;
		}
		this.boardManager.disablePuzzleInput();
		this.later(() => {
			if (!this.drillMode || this.drillComplete) return;
			const reply = pickChoice(choices, Math.random);
			if (!reply) return;
			if (choices.length > 1) this.noteDrillLine(reply, choices);
			this.playDrillChoice(reply);
			this.continueDrill();
		}, 500);
	}

	private handleDrillMove(from: string, to: string): void {
		if (this.drillComplete) return;
		const choices = drillChoices(this.drillCursor);
		const match = findChoice(choices, from, to);
		if (match) {
			this.puzzleTally.recordCorrect(this.drillPath.length);
			if (choices.length > 1) this.noteDrillLine(match, choices);
			this.clearHint();
			this.playDrillChoice(match);
			this.continueDrill();
			return;
		}

		this.puzzleTally.recordWrong(this.drillPath.length);
		this.boardManager.flashWrong();
		this.boardManager.showWrongArrow(from, to);
		this.boardManager.disablePuzzleInput();
		this.later(() => {
			this.boardManager.clearWrongArrow();
			this.resetBoardPosition();
			if (this.drillMode && !this.drillComplete) this.enablePuzzleInput();
		}, 800);
	}

	private playDrillChoice(choice: DrillChoice): void {
		this.drillPath.push(choice.node);
		this.drillCursor = choice.next;
		const id = this.idOf(choice.node);
		if (id) this.goToMoveById(id);
	}

	// At each point where the PGN branches, say which move this run follows
	// and what else it gives there, so other moves are not taken as wrong.
	private noteDrillLine(chosen: DrillChoice, choices: DrillChoice[]): void {
		const label = (n: MoveNode): string => moveLabel(n.moveNumber, n.color, n.san);
		const others = choices.filter((c) => c !== chosen).map((c) => label(c.node));
		this.drillBranches.push(label(chosen.node) + " (the PGN also has " + others.join(", ") + ")");
		this.setDrillStatus("This run follows " + this.drillBranches.join(", then ") + ".");
	}

	private setDrillStatus(text: string | null): void {
		this.drillStatus?.remove();
		this.drillStatus = null;
		if (text === null || !this.boardColumn) return;
		this.drillStatus = this.boardColumn.createDiv({ cls: "sfb-chess-drill-status", text });
	}

	private finishDrill(): void {
		this.drillComplete = true;
		this.boardManager.disablePuzzleInput();
		this.clearHint();
		this.movesContainer.removeClass("sfb-chess-moves-hidden");
		this.showPuzzleReport(this.drillPath);
		this.showCompleteBanner("Drill complete!");
	}

	private sideToMove(): "w" | "b" {
		return this.getCurrentFen().split(" ")[1] === "b" ? "b" : "w";
	}

	private idOf(node: MoveNode): string | null {
		return this.allFlatMoves.find((fm) => fm.node === node)?.id ?? null;
	}

	private showHintComment(text: string): void {
		this.hintComment?.remove();
		if (!this.boardColumn) return;
		this.hintComment = this.boardColumn.createDiv({ cls: "sfb-chess-hint-comment" });
		this.renderCommentText(this.hintComment, text);
	}

	private clearHint(): void {
		this.hintProgress.reset();
		this.hintBtn?.removeClass("sfb-chess-toggle-active");
		this.hintBtn?.removeClass("sfb-chess-toggle-active-strong");
		this.boardManager.clearHintMarkers();
		this.hintComment?.remove();
		this.hintComment = null;
	}

	// --- Navigation ---

	private applyStartAt(startAt: import("./types").StartAt): void {
		if (startAt === "start" || this.mainlineMoves.length === 0) return;

		let targetIdx: number;
		if (startAt === "end") {
			targetIdx = this.mainlineMoves.length - 1;
		} else {
			targetIdx = Math.min(startAt, this.mainlineMoves.length - 1);
		}

		if (targetIdx >= 0) {
			this.goToMoveById("m-" + targetIdx);
		}
	}

	private goToMoveById(id: string): void {
		const flat = this.allFlatMoves.find((fm) => fm.id === id);
		if (!flat) return;

		this.currentMoveId = id;
		this.showBoardAt(flat);
		this.updateActiveMove();
		this.updateActiveComment();
		this.scrollToActiveMove();
		this.updatePuzzleInputState();
		this.dropStaleHint();
	}

	// After navigating, a hint for the old move to find no longer applies.
	private dropStaleHint(): void {
		if (this.hintProgress.isStale(this.moveToFind())) this.clearHint();
	}

	private updatePuzzleInputState(): void {
		if (!this.puzzleMode || this.puzzleComplete) return;
		const currentIdx = this.getCurrentMainlineIndex();
		if (currentIdx === this.puzzleHighWater && this.puzzleHighWater + 1 < this.mainlineMoves.length) {
			this.enablePuzzleInput();
		} else {
			this.boardManager.disablePuzzleInput();
		}
	}

	private goToStart(): void {
		if (this.drillRunning()) return;
		this.currentMoveId = null;
		this.showBoardAt(null);
		this.updateActiveMove();
		this.updateActiveComment();
		this.dropStaleHint();
		this.movesContainer.scrollTop = 0;
		if (this.stepMode) {
			this.updateMoveVisibility();
		}
	}

	private goToEnd(): void {
		if (this.drillRunning()) return;
		if (this.mainlineMoves.length === 0) return;
		if (this.puzzleMode || this.stepMode) {
			const maxIdx = this.getMaxRevealedIndex();
			if (maxIdx >= 0) {
				this.goToMoveById("m-" + maxIdx);
			}
			return;
		}
		const lastId = "m-" + (this.mainlineMoves.length - 1);
		this.goToMoveById(lastId);
	}

	private getMaxRevealedIndex(): number {
		if (!this.puzzleMode && !this.stepMode) return this.mainlineMoves.length - 1;
		if (this.puzzleMode) return this.puzzleHighWater;
		// Step mode reveals one move at a time: the next move is always reachable.
		return Math.min(this.getCurrentMainlineIndex() + 1, this.mainlineMoves.length - 1);
	}

	private nextMove(): void {
		if (this.drillRunning()) return;
		if (this.currentMoveId === null) {
			if (this.mainlineMoves.length > 0) {
				const maxIdx = this.getMaxRevealedIndex();
				if (maxIdx >= 0) {
					this.goToMoveById("m-0");
					if (this.stepMode) this.updateMoveVisibility();
				}
			}
			return;
		}

		const match = /^m-(\d+)$/.exec(this.currentMoveId);
		if (match) {
			const idx = parseInt(match[1]);
			const maxIdx = this.getMaxRevealedIndex();
			if (idx < maxIdx) {
				this.goToMoveById("m-" + (idx + 1));
				if (this.stepMode) this.updateMoveVisibility();
			}
			return;
		}

		if (this.puzzleMode || this.stepMode) return;

		const flat = this.allFlatMoves;
		const currentIdx = flat.findIndex((fm) => fm.id === this.currentMoveId);
		if (currentIdx >= 0 && currentIdx < flat.length - 1) {
			const nextId = flat[currentIdx + 1].id;
			if (nextId.startsWith(this.currentMoveId.replace(/-\d+$/, ""))) {
				this.goToMoveById(nextId);
			}
		}
	}

	private prevMove(): void {
		if (this.drillRunning()) return;
		if (this.currentMoveId === null) return;

		const match = /^m-(\d+)$/.exec(this.currentMoveId);
		if (match) {
			const idx = parseInt(match[1]);
			if (idx > 0) {
				this.goToMoveById("m-" + (idx - 1));
			} else {
				this.goToStart();
			}
			if (this.stepMode) this.updateMoveVisibility();
			return;
		}

		if (this.puzzleMode || this.stepMode) return;

		const flat = this.allFlatMoves;
		const currentIdx = flat.findIndex((fm) => fm.id === this.currentMoveId);
		if (currentIdx > 0) {
			this.goToMoveById(flat[currentIdx - 1].id);
		} else {
			this.goToStart();
		}
	}

	private flip(): void {
		this.boardManager.flip();
	}

	private updateActiveMove(): void {
		for (const [, el] of this.moveElements) {
			el.removeClass("sfb-chess-move-active");
		}
		if (this.currentMoveId) {
			const el = this.moveElements.get(this.currentMoveId);
			if (el) el.addClass("sfb-chess-move-active");
		}
	}

	private updateActiveComment(): void {
		for (const [, el] of this.commentElements) {
			el.addClass("sfb-chess-comment-dimmed");
			el.removeClass("sfb-chess-comment-active");
		}
		if (this.startingCommentEl) {
			if (this.currentMoveId === null) {
				this.startingCommentEl.removeClass("sfb-chess-comment-dimmed");
				this.startingCommentEl.addClass("sfb-chess-comment-active");
			}
		}
		if (this.currentMoveId) {
			const el = this.commentElements.get(this.currentMoveId);
			if (el) {
				el.removeClass("sfb-chess-comment-dimmed");
				el.addClass("sfb-chess-comment-active");
			}
		}
	}

	private scrollToActiveMove(): void {
		if (!this.currentMoveId) {
			this.movesContainer.scrollTop = 0;
			return;
		}
		const moveEl = this.moveElements.get(this.currentMoveId);
		if (!moveEl) return;

		const moveRow = moveEl.parentElement;
		if (!moveRow) return;

		const comment = this.commentElements.get(this.currentMoveId);
		const containerRect = this.movesContainer.getBoundingClientRect();
		const rowRect = moveRow.getBoundingClientRect();
		const bottomEl = comment ?? moveRow;
		const bottomRect = bottomEl.getBoundingClientRect();
		const totalHeight = bottomRect.bottom - rowRect.top;
		const containerHeight = containerRect.height;

		if (totalHeight > containerHeight) {
			this.movesContainer.scrollTo({ top: moveRow.offsetTop, behavior: "smooth" });
		} else {
			const rowTop = rowRect.top - containerRect.top + this.movesContainer.scrollTop;
			const rowBottom = bottomRect.bottom - containerRect.top + this.movesContainer.scrollTop;
			if (rowRect.top < containerRect.top) {
				this.movesContainer.scrollTo({ top: rowTop, behavior: "smooth" });
			} else if (bottomRect.bottom > containerRect.bottom) {
				this.movesContainer.scrollTo({ top: rowBottom - containerHeight, behavior: "smooth" });
			}
		}
	}

	private later(fn: () => void, ms: number): void {
		const id = window.setTimeout(() => {
			this.timers.delete(id);
			fn();
		}, ms);
		this.timers.add(id);
	}

	destroy(): void {
		this.stopAutoPlay();
		for (const id of this.timers) window.clearTimeout(id);
		this.timers.clear();
		if (this.keyboardHandler) {
			this.wrapper.removeEventListener("keydown", this.keyboardHandler);
			this.keyboardHandler = null;
		}
		if (this.boardManager) {
			this.boardManager.destroy();
		}
	}
}
