import { BoardManager } from "./board-manager";
import { BoardExplorer } from "./board-explorer";
import { ExploreLine } from "./explore";
import { resolvePieceSet } from "./fan-pieces";
import type { ChessSettings, CodeBlockOptions } from "./types";

export class FenViewer {
	private boardManager: BoardManager;
	private explorer: BoardExplorer | null = null;
	private wrapper: HTMLElement;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(container: HTMLElement, fen: string, options: CodeBlockOptions, settings: ChessSettings) {
		const wrapper = container.createDiv({ cls: "sfb-chess-container sfb-chess-fen" });
		this.wrapper = wrapper;
		const boardWrapper = wrapper.createDiv({ cls: "sfb-chess-board-wrapper" });

		this.boardManager = new BoardManager(
			boardWrapper,
			fen,
			settings,
			resolvePieceSet(options.pieces ?? settings.fanPieceSet),
		);
		this.enableExplore(fen);
	}

	// Dragging a legal move starts a line from the diagram; Back to game (or
	// Escape) puts the diagram back. A FEN chess.js refuses stays static.
	private enableExplore(fen: string): void {
		if (!ExploreLine.canStart(fen)) return;
		this.explorer = new BoardExplorer(this.boardManager, this.wrapper, {
			baseFen: () => fen,
			onEnter: () => {},
			onPosition: () => {},
			onExit: () => {
				void this.boardManager.setPosition(fen, true);
				this.boardManager.clearHighlights();
			},
		});
		this.explorer.enable();
		this.wrapper.setAttribute("tabindex", "0");
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (!this.explorer?.active) return;
			if (e.key === "Escape") {
				e.preventDefault();
				this.explorer.back();
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				this.explorer.undo();
			}
		};
		this.wrapper.addEventListener("keydown", this.keyboardHandler);
	}

	destroy(): void {
		if (this.keyboardHandler) {
			this.wrapper.removeEventListener("keydown", this.keyboardHandler);
			this.keyboardHandler = null;
		}
		this.boardManager.destroy();
	}
}
