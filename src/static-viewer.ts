import { BoardManager } from "./board-manager";
import { resolvePieceSet } from "./fan-pieces";
import type { BoardShapes } from "./pgn-parser";
import type { ChessSettings, CodeBlockOptions } from "./types";

// A book diagram: one position, no controls, no move list, nothing to click
// or focus, for printing and PDF export. The title, when given, is a caption.
export class StaticViewer {
	private boardManager: BoardManager;

	constructor(
		container: HTMLElement,
		fen: string,
		shapes: BoardShapes,
		options: CodeBlockOptions,
		settings: ChessSettings,
	) {
		const wrapper = container.createDiv({ cls: "sfb-chess-container sfb-chess-fen sfb-chess-static" });
		const boardWrapper = wrapper.createDiv({ cls: "sfb-chess-board-wrapper" });

		this.boardManager = new BoardManager(
			boardWrapper,
			fen,
			settings,
			resolvePieceSet(options.pieces ?? settings.fanPieceSet),
		);
		if (options.flipped) this.boardManager.flip(false);
		this.boardManager.showShapes(shapes);

		if (options.title) {
			wrapper.createDiv({ cls: "sfb-chess-static-caption", text: options.title });
		}
	}

	destroy(): void {
		this.boardManager.destroy();
	}
}
