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
		const source = bar.createEl("button", {
			cls: "sfb-chess-review-source",
			text: puzzle.path.replace(/\.md$/i, ""),
			attr: { type: "button", title: "Open the note this puzzle is in" },
		});
		source.addEventListener("click", () => {
			this.close();
			this.openSource(puzzle);
		});

		const host = el.createDiv({ cls: "sfb-chess-review-board" });
		try {
			this.viewer = new PgnViewer(host, puzzle.pgn, { ...puzzle.options, mode: "puzzle", center: true }, this.settings);
		} catch (e: unknown) {
			console.warn("chess-notebook: could not show a review puzzle", e);
			host.empty();
			host.createDiv({ cls: "sfb-chess-error", text: "This puzzle could not be shown." });
		}

		const actions = el.createDiv({ cls: "sfb-chess-review-actions" });
		// Polite live region: a screen reader hears Skip turn into Next.
		const next = actions.createEl("button", { text: "Skip", cls: "mod-cta", attr: { type: "button", "aria-live": "polite" } });
		next.addEventListener("click", () => {
			this.index++;
			this.render();
		});
		// The viewer shows its report when the puzzle is solved: Skip becomes Next.
		this.observer = new MutationObserver(() => {
			if (host.querySelector(".sfb-chess-puzzle-report") && next.textContent !== "Next") next.setText("Next");
		});
		this.observer.observe(host, { childList: true, subtree: true });

		// Start on the board, so its keys work at once; with no board, on the button.
		// Deferred: on open, the modal focuses its first button after onOpen.
		const target = host.querySelector<HTMLElement>("[tabindex='0']") ?? next;
		window.setTimeout(() => target.focus(), 0);
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
		again.focus();
		const close = actions.createEl("button", { text: "Close", attr: { type: "button" } });
		close.addEventListener("click", () => this.close());
	}
}
