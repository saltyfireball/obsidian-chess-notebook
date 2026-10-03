import { App, Modal } from "obsidian";
import { PgnViewer } from "./pgn-viewer";
import { reviewCount, shuffle } from "./puzzle-review";
import type { ChessSettings, CodeBlockOptions } from "./types";

// One mode:puzzle block from the vault, ready to show.
export interface ReviewPuzzle {
	path: string;
	// Zero-based line of the block's opening fence.
	line: number;
	pgn: string;
	options: CodeBlockOptions;
}

// Serves the vault's puzzles one at a time, shuffled. The notes are only
// read: solving here writes nothing back.
export class PuzzleReviewModal extends Modal {
	private order: ReviewPuzzle[] = [];
	private index = 0;
	private viewer: PgnViewer | null = null;
	private observer: MutationObserver | null = null;

	constructor(
		app: App,
		private puzzles: ReviewPuzzle[],
		private settings: ChessSettings,
		private openSource: (puzzle: ReviewPuzzle) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("sfb-chess-review-modal");
		this.titleEl.setText("Review puzzles");
		this.restart();
	}

	onClose(): void {
		this.clearViewer();
		this.contentEl.empty();
	}

	private restart(): void {
		this.order = shuffle(this.puzzles, Math.random);
		this.index = 0;
		this.render();
	}

	private clearViewer(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.viewer?.destroy();
		this.viewer = null;
	}

	private render(): void {
		this.clearViewer();
		const el = this.contentEl;
		el.empty();

		if (this.index >= this.order.length) {
			this.renderDone();
			return;
		}

		const puzzle = this.order[this.index];
		const bar = el.createDiv({ cls: "sfb-chess-review-bar" });
		bar.createSpan({ cls: "sfb-chess-review-count", text: reviewCount(this.index, this.order.length) });
		const source = bar.createEl("a", {
			cls: "sfb-chess-review-source",
			text: puzzle.path.replace(/\.md$/i, ""),
			attr: { href: "#", "aria-label": "Open the note this puzzle is in" },
		});
		source.addEventListener("click", (e) => {
			e.preventDefault();
			this.close();
			this.openSource(puzzle);
		});

		const host = el.createDiv({ cls: "sfb-chess-review-board" });
		this.viewer = new PgnViewer(host, puzzle.pgn, { ...puzzle.options, mode: "puzzle", center: true }, this.settings);

		const actions = el.createDiv({ cls: "sfb-chess-review-actions" });
		const next = actions.createEl("button", { text: "Skip", cls: "mod-cta", attr: { type: "button" } });
		next.addEventListener("click", () => {
			this.index++;
			this.render();
		});
		// The viewer shows its report when the puzzle is solved: Skip becomes Next.
		this.observer = new MutationObserver(() => {
			if (host.querySelector(".sfb-chess-puzzle-report")) next.setText("Next");
		});
		this.observer.observe(host, { childList: true, subtree: true });
	}

	private renderDone(): void {
		const el = this.contentEl;
		const n = this.order.length;
		el.createDiv({
			cls: "sfb-chess-review-done",
			text: "That was all " + n + (n === 1 ? " puzzle." : " puzzles."),
		});
		const actions = el.createDiv({ cls: "sfb-chess-review-actions" });
		const again = actions.createEl("button", { text: "Shuffle again", cls: "mod-cta", attr: { type: "button" } });
		again.addEventListener("click", () => this.restart());
		const close = actions.createEl("button", { text: "Close", attr: { type: "button" } });
		close.addEventListener("click", () => this.close());
	}
}
