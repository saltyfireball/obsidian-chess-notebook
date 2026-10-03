import { PgnViewer } from "./pgn-viewer";
import { gameLabel, pickGame } from "./pgn-games";
import { createNavButton } from "./nav-button";
import type { ChessSettings, CodeBlockOptions } from "./types";

const ICON_PREV = "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z";
const ICON_NEXT = "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z";

// A PGN with several games: previous/next buttons and the game's name above
// the board. Switching games rebuilds the viewer for that game.
export class GamePickerViewer {
	private viewer: PgnViewer | null = null;
	private index: number;
	private label: HTMLElement;
	private prevBtn: HTMLButtonElement;
	private nextBtn: HTMLButtonElement;
	private body: HTMLElement;

	constructor(
		container: HTMLElement,
		private games: string[],
		private options: CodeBlockOptions,
		private settings: ChessSettings,
	) {
		const root = container.createDiv({ cls: "sfb-chess-games" });
		const picker = root.createDiv({ cls: "sfb-chess-game-picker" });
		this.prevBtn = createNavButton(picker, "Previous game", ICON_PREV, () => this.show(this.index - 1));
		this.label = picker.createDiv({ cls: "sfb-chess-game-label" });
		this.nextBtn = createNavButton(picker, "Next game", ICON_NEXT, () => this.show(this.index + 1));
		this.body = root.createDiv({ cls: "sfb-chess-game-body" });

		this.index = pickGame(games, options.game);
		this.show(this.index);
	}

	private show(index: number): void {
		if (index < 0 || index >= this.games.length) return;
		this.index = index;
		this.viewer?.destroy();
		this.body.empty();
		this.viewer = new PgnViewer(this.body, this.games[index], this.options, this.settings);
		this.label.setText(gameLabel(this.games, index));
		this.prevBtn.disabled = index === 0;
		this.nextBtn.disabled = index === this.games.length - 1;
	}

	destroy(): void {
		this.viewer?.destroy();
		this.viewer = null;
	}
}
