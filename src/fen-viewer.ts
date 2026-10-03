import { BoardManager } from "./board-manager";
import { resolvePieceSet } from "./fan-pieces";
import { parseShapeOptions } from "./pgn-parser";
import type { ChessSettings, CodeBlockOptions } from "./types";

export class FenViewer {
	private boardManager: BoardManager;

	constructor(container: HTMLElement, fen: string, options: CodeBlockOptions, settings: ChessSettings) {
		const wrapper = container.createDiv({ cls: "sfb-chess-container sfb-chess-fen" });
		const boardWrapper = wrapper.createDiv({ cls: "sfb-chess-board-wrapper" });

		this.boardManager = new BoardManager(
			boardWrapper,
			fen,
			settings,
			resolvePieceSet(options.pieces ?? settings.fanPieceSet),
		);
		this.boardManager.showShapes(parseShapeOptions(options.arrows, options.squares));
	}

	destroy(): void {
		this.boardManager.destroy();
	}
}
