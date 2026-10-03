import { Chess } from "chess.js";
import { BoardManager } from "./board-manager";
import { resolvePieceSet } from "./fan-pieces";
import { parseShapeOptions } from "./pgn-parser";
import { copyWithFeedback, ICON_FEN } from "./clipboard";
import type { ChessSettings, CodeBlockOptions } from "./types";

interface FenStep {
	fen: string;
	label: string;
	from: string | null;
	to: string | null;
}

export class FenSequenceViewer {
	private boardManager: BoardManager;
	private steps: FenStep[] = [];
	private currentIndex = 0;
	private moveElements: HTMLElement[] = [];
	private movesContainer: HTMLElement;
	private wrapper: HTMLElement;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
	private timers = new Set<number>();
	private destroyed = false;

	constructor(
		container: HTMLElement,
		fens: string[],
		options: CodeBlockOptions,
		settings: ChessSettings,
	) {
		this.steps = this.buildSteps(fens);

		this.wrapper = container.createDiv({ cls: "sfb-chess-container sfb-chess-pgn" });
		this.wrapper.setAttribute("tabindex", "0");

		this.buildHeader(this.wrapper, options);

		const content = this.wrapper.createDiv({ cls: "sfb-chess-content" });

		const boardColumn = content.createDiv({ cls: "sfb-chess-board-column" });
		const boardWrapper = boardColumn.createDiv({ cls: "sfb-chess-board-wrapper" });
		this.boardManager = new BoardManager(
			boardWrapper,
			this.steps[0].fen,
			settings,
			resolvePieceSet(options.pieces ?? settings.fanPieceSet),
		);
		// The drawings stay on the board for every position in the sequence.
		this.boardManager.showShapes(parseShapeOptions(options.arrows, options.squares));
		this.buildControls(boardColumn);

		const sidebar = content.createDiv({ cls: "sfb-chess-sidebar" });
		this.movesContainer = sidebar.createDiv({ cls: "sfb-chess-moves" });

		this.buildMoveList();
		this.applyStartAt(options.startAt);
		this.updateActiveMove();

		this.registerKeyboardShortcuts();
	}

	private registerKeyboardShortcuts(): void {
		this.keyboardHandler = (e: KeyboardEvent) => {
			switch (e.key) {
				case "ArrowLeft":
					e.preventDefault();
					this.prevMove();
					break;
				case "ArrowRight":
					e.preventDefault();
					this.nextMove();
					break;
				case "Home":
					e.preventDefault();
					this.goToMove(0);
					break;
				case "End":
					e.preventDefault();
					this.goToMove(this.steps.length - 1);
					break;
				case "f":
				case "F":
					e.preventDefault();
					this.boardManager.flip();
					break;
			}
		};
		this.wrapper.addEventListener("keydown", this.keyboardHandler);
	}

	private buildHeader(wrapper: HTMLElement, options: CodeBlockOptions): void {
		const hasPlayers = options.white || options.black;
		const meta: string[] = [];
		if (options.result && options.result !== "*") meta.push(options.result);
		if (options.event) meta.push(options.event);
		if (options.site) meta.push(options.site);
		if (options.date) meta.push(options.date);
		if (options.round) meta.push("Round: " + options.round);
		if (options.eco) meta.push("ECO: " + options.eco);

		if (!options.title && !hasPlayers && meta.length === 0) return;

		const header = wrapper.createDiv({ cls: "sfb-chess-header" });

		if (options.title) {
			header.createDiv({ cls: "sfb-chess-title", text: options.title });
		}

		if (hasPlayers) {
			const players = header.createDiv({ cls: "sfb-chess-players" });
			players.createSpan({ cls: "sfb-chess-white-name", text: options.white ?? "White" });
			players.createSpan({ cls: "sfb-chess-vs", text: " vs. " });
			players.createEl("strong", { text: options.black ?? "Black" });
		}

		if (meta.length > 0) {
			const metaEl = header.createDiv({ cls: "sfb-chess-meta" });
			metaEl.textContent = meta.join(" | ");
		}
	}

	private buildSteps(fens: string[]): FenStep[] {
		const steps: FenStep[] = [];

		for (let i = 0; i < fens.length; i++) {
			const fen = fens[i];
			let from: string | null = null;
			let to: string | null = null;
			let label: string;

			if (i === 0) {
				label = "Start";
			} else {
				const diff = this.findMovedPiece(fens[i - 1], fen);
				from = diff.from;
				to = diff.to;
				label = diff.san ?? ("Position " + (i + 1));
			}

			steps.push({ fen, label, from, to });
		}

		return steps;
	}

	private findMovedPiece(
		fenBefore: string,
		fenAfter: string,
	): { from: string | null; to: string | null; san: string | null } {
		try {
			const chess = new Chess(fenBefore);
			const legalMoves = chess.moves({ verbose: true });

			for (const move of legalMoves) {
				if (move.after.split(" ")[0] === fenAfter.split(" ")[0]) {
					return { from: move.from, to: move.to, san: move.san };
				}
			}
		} catch {
			// FEN parse error - fall through
		}
		return { from: null, to: null, san: null };
	}

	private buildMoveList(): void {
		this.moveElements = [];

		for (let i = 0; i < this.steps.length; i++) {
			const step = this.steps[i];

			if (i === 0) {
				const row = this.movesContainer.createDiv({ cls: "sfb-chess-move-row" });
				const num = row.createSpan({ cls: "sfb-chess-move-number" });
				num.textContent = "";
				const moveEl = row.createSpan({ cls: "sfb-chess-move" });
				moveEl.textContent = step.label;
				moveEl.dataset.moveIndex = String(i);
				moveEl.addEventListener("click", () => this.goToMove(i));
				this.moveElements.push(moveEl);
				continue;
			}

			const fenParts = this.steps[i - 1].fen.split(" ");
			const isWhiteMove = fenParts[1] === "w";
			const moveNum = parseInt(fenParts[5] ?? "1");

			if (isWhiteMove) {
				const whiteIdx = i;
				const row = this.movesContainer.createDiv({ cls: "sfb-chess-move-row" });
				const num = row.createSpan({ cls: "sfb-chess-move-number" });
				num.textContent = moveNum + ".";

				const moveEl = row.createSpan({ cls: "sfb-chess-move" });
				moveEl.textContent = step.label;
				moveEl.dataset.moveIndex = String(whiteIdx);
				moveEl.addEventListener("click", () => this.goToMove(whiteIdx));
				this.moveElements.push(moveEl);

				const nextStep = this.steps[i + 1];
				if (nextStep) {
					const nextFenParts = this.steps[i].fen.split(" ");
					const nextIsBlack = nextFenParts[1] === "b";
					if (nextIsBlack) {
						const blackIdx = i + 1;
						const blackEl = row.createSpan({ cls: "sfb-chess-move" });
						blackEl.textContent = nextStep.label;
						blackEl.dataset.moveIndex = String(blackIdx);
						blackEl.addEventListener("click", () => this.goToMove(blackIdx));
						this.moveElements.push(blackEl);
						i++;
					}
				}
			} else {
				const row = this.movesContainer.createDiv({ cls: "sfb-chess-move-row" });
				const num = row.createSpan({ cls: "sfb-chess-move-number" });
				num.textContent = moveNum + ".";
				const spacer = row.createSpan({ cls: "sfb-chess-move sfb-chess-move-spacer" });
				spacer.textContent = "...";
				const moveEl = row.createSpan({ cls: "sfb-chess-move" });
				moveEl.textContent = step.label;
				moveEl.dataset.moveIndex = String(i);
				moveEl.addEventListener("click", () => this.goToMove(i));
				this.moveElements.push(moveEl);
			}
		}
	}

	private buildControls(wrapper: HTMLElement): void {
		const controls = wrapper.createDiv({ cls: "sfb-chess-controls" });

		this.createNavButton(controls, "Flip board", "M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z", () => this.boardManager.flip());
		this.createNavButton(controls, "First position", "M6 6h2v12H6zM18 6v12l-6-6 6-6z", () => this.goToMove(0));
		this.createNavButton(controls, "Previous position", "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z", () => this.prevMove());
		this.createNavButton(controls, "Next position", "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z", () => this.nextMove());
		this.createNavButton(controls, "Last position", "M16 18V6h2v12h-2zM8 18V6l6 6-6 6z", () => this.goToMove(this.steps.length - 1));

		controls.createDiv({ cls: "sfb-chess-controls-sep" });

		const copyFen: HTMLElement = this.createNavButton(controls, "Copy FEN", ICON_FEN, () =>
			copyWithFeedback(copyFen, this.steps[this.currentIndex].fen, "FEN", this.copyHooks()));
	}

	// What a copy button needs from the viewer: its timer, and whether it is still open.
	private copyHooks() {
		return { schedule: (fn: () => void, ms: number) => this.later(fn, ms), alive: () => !this.destroyed };
	}

	private later(fn: () => void, ms: number): void {
		if (this.destroyed) return;
		const id = window.setTimeout(() => {
			this.timers.delete(id);
			fn();
		}, ms);
		this.timers.add(id);
	}

	private createNavButton(
		parent: HTMLElement,
		label: string,
		iconPath: string,
		handler: () => void,
	): HTMLElement {
		const btn = parent.createEl("button", {
			cls: "sfb-chess-btn",
			attr: { "aria-label": label },
		});
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

	private applyStartAt(startAt: import("./types").StartAt): void {
		if (startAt === "start" || this.steps.length === 0) return;

		let targetIdx: number;
		if (startAt === "end") {
			targetIdx = this.steps.length - 1;
		} else {
			targetIdx = Math.min(startAt, this.steps.length - 1);
		}

		if (targetIdx >= 0) {
			this.goToMove(targetIdx);
		}
	}

	private goToMove(index: number): void {
		if (index < 0 || index >= this.steps.length) {
			return;
		}

		this.currentIndex = index;
		const step = this.steps[index];
		void this.boardManager.setPosition(step.fen, true);

		if (step.from && step.to) {
			this.boardManager.highlightLastMove(step.from, step.to);
		} else {
			this.boardManager.clearHighlights();
		}

		this.updateActiveMove();
		this.scrollToActiveMove();
	}

	private nextMove(): void {
		if (this.currentIndex < this.steps.length - 1) {
			this.goToMove(this.currentIndex + 1);
		}
	}

	private prevMove(): void {
		if (this.currentIndex > 0) {
			this.goToMove(this.currentIndex - 1);
		}
	}

	private updateActiveMove(): void {
		for (const el of this.moveElements) {
			el.removeClass("sfb-chess-move-active");
		}
		const activeEl = this.moveElements.find(
			(el) => el.dataset.moveIndex === String(this.currentIndex)
		);
		if (activeEl) {
			activeEl.addClass("sfb-chess-move-active");
		}
	}

	private scrollToActiveMove(): void {
		const activeEl = this.moveElements.find(
			(el) => el.dataset.moveIndex === String(this.currentIndex)
		);
		if (activeEl) {
			activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	}

	destroy(): void {
		this.destroyed = true;
		for (const id of this.timers) window.clearTimeout(id);
		this.timers.clear();
		if (this.keyboardHandler) {
			this.wrapper.removeEventListener("keydown", this.keyboardHandler);
			this.keyboardHandler = null;
		}
		this.boardManager.destroy();
	}
}
