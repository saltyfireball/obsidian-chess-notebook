import { BoardManager } from "./board-manager";
import { resolvePieceSet } from "./fan-pieces";
import type { BoardShapes } from "./pgn-parser";
import { staticBoardLabel } from "./static-position";
import type { ChessSettings, CodeBlockOptions } from "./types";

// A book diagram: one position, no controls, no move list, nothing to click
// or focus, for printing and PDF export. The title, when given, is a caption.
// mode: and color: do not apply, and the last move, NAGs and comments are not
// shown; board:, pieces:, flipped: and the drawings are.
export class StaticViewer {
	private boardManager: BoardManager;

	constructor(
		container: HTMLElement,
		fen: string,
		shapes: BoardShapes,
		options: CodeBlockOptions,
		settings: ChessSettings,
	) {
		const wrapper = container.createDiv({
			cls: "sfb-chess-container sfb-chess-fen sfb-chess-static",
			attr: { role: "figure", "aria-label": staticBoardLabel(options.title, fen) },
		});
		const boardWrapper = wrapper.createDiv({ cls: "sfb-chess-board-wrapper" });

		this.boardManager = new BoardManager(
			boardWrapper,
			fen,
			settings,
			resolvePieceSet(options.pieces ?? settings.fanPieceSet),
			options.board,
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
