import type { BoardManager } from "./board-manager";
import { ExploreLine } from "./explore";

export interface ExploreHooks {
	// The position a new line starts from: the one the viewer is showing.
	baseFen(): string;
	// A piece was picked up, before it is dropped.
	onPickUp(): void;
	// The first move of a line was played.
	onEnter(): void;
	// The board shows a new explore position.
	onPosition(fen: string): void;
	// Back to game: the viewer puts its own position back on the board.
	onExit(): void;
}

// Lets the reader drag legal moves on a board to try a line, with a bar
// naming the line and a Back to game button. Nothing is saved.
export class BoardExplorer {
	private line: ExploreLine | null = null;
	// An empty line at the viewer's position, kept so picking up a piece does
	// not build a new one each time.
	private fresh: ExploreLine | null = null;
	private bar: HTMLElement | null = null;
	private barText: HTMLElement | null = null;

	constructor(
		private board: BoardManager,
		private barParent: HTMLElement,
		private hooks: ExploreHooks,
	) {}

	get active(): boolean {
		return this.line !== null;
	}

	// The explored position, or null when not exploring.
	get fen(): string | null {
		return this.line?.fen ?? null;
	}

	// Takes the board's move input. The callbacks read the line as it is when
	// a piece is picked up, so one call covers every later move.
	enable(): void {
		this.board.enablePuzzleInput(
			(square) => {
				const ok = this.current().hasOwnPiece(square);
				if (ok) this.hooks.onPickUp();
				return ok;
			},
			(from, to) => this.current().isLegal(from, to),
			(from, to) => this.play(from, to),
			// Free exploring shows no legal-move dots.
			() => [],
		);
	}

	disable(): void {
		this.board.disablePuzzleInput();
	}

	private current(): ExploreLine {
		if (this.line) return this.line;
		const fen = this.hooks.baseFen();
		if (!this.fresh || this.fresh.startFen !== fen) this.fresh = new ExploreLine(fen);
		return this.fresh;
	}

	private play(from: string, to: string): void {
		const starting = this.line === null;
		const line = this.current();
		if (!line.push(from, to)) return;
		this.line = line;
		this.fresh = null;
		if (starting) {
			this.showBar();
			this.hooks.onEnter();
		}
		this.show();
	}

	// Takes back the last explored move; the first one goes back to the game.
	undo(): void {
		if (!this.line) return;
		this.line.undo();
		if (this.line.moves.length === 0) this.back();
		else this.show();
	}

	back(): void {
		if (!this.line) return;
		this.line = null;
		this.bar?.remove();
		this.bar = null;
		this.barText = null;
		this.hooks.onExit();
	}

	private show(): void {
		if (!this.line) return;
		const last = this.line.lastMove;
		void this.board.setPosition(this.line.fen, true);
		if (last) this.board.highlightLastMove(last.from, last.to);
		this.board.showShapes({ arrows: [], squares: [] });
		this.barText?.setText(this.line.sanList());
		this.hooks.onPosition(this.line.fen);
	}

	private showBar(): void {
		this.bar = this.barParent.createDiv({ cls: "sfb-chess-explore-bar" });
		this.bar.createSpan({ cls: "sfb-chess-explore-label", text: "Exploring:" });
		this.barText = this.bar.createSpan({ cls: "sfb-chess-explore-line" });
		const back = this.bar.createEl("button", {
			cls: "sfb-chess-explore-back",
			text: "Back to game",
			attr: { type: "button" },
		});
		back.addEventListener("click", () => this.back());
	}
}
