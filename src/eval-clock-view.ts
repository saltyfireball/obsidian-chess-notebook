import type { MoveNode } from "./pgn-parser";
import { evalLabel, formatClock, hasEvalClock, latestEvalClock, linePath, onMainline, whiteShare, type Evaluation } from "./eval-clock";

// The eval bar beside the board and each side's clock above and below it,
// from the [%eval] / [%clk] the PGN carries. Absent when it carries neither.
export class EvalClockView {
	private bar: HTMLElement | null = null;
	private barWhite: HTMLElement | null = null;
	private barLabel: HTMLElement | null = null;
	private topClock: HTMLElement | null = null;
	private bottomClock: HTMLElement | null = null;
	private currentId: string | null = null;
	// Kept here rather than read from the board, which turns asynchronously.
	private flipped = false;
	private evalHidden = false;

	// Wraps boardWrapper in a row with the bar; call before the board is built.
	static create(
		boardWrapper: HTMLElement,
		mainline: MoveNode[],
		names: { white: string | null; black: string | null },
		startingEvaluation: Evaluation | null = null,
	): EvalClockView | null {
		const found = hasEvalClock(mainline);
		if (startingEvaluation) found.evaluation = true;
		if (!found.evaluation && !found.clock) return null;
		return new EvalClockView(boardWrapper, mainline, names, found, startingEvaluation);
	}

	private constructor(
		boardWrapper: HTMLElement,
		private mainline: MoveNode[],
		private names: { white: string | null; black: string | null },
		found: { evaluation: boolean; clock: boolean },
		private startingEvaluation: Evaluation | null = null,
	) {
		const column = boardWrapper.parentElement;
		if (!column) return;
		if (found.clock) {
			this.topClock = createDiv({ cls: "sfb-chess-clock" });
			column.insertBefore(this.topClock, boardWrapper);
		}
		if (found.evaluation) {
			const row = createDiv({ cls: "sfb-chess-eval-row" });
			column.insertBefore(row, boardWrapper);
			this.bar = row.createDiv({ cls: "sfb-chess-eval-bar" });
			this.barWhite = this.bar.createDiv({ cls: "sfb-chess-eval-white" });
			this.barLabel = this.bar.createDiv({ cls: "sfb-chess-eval-label" });
			row.appendChild(boardWrapper);
		}
		if (found.clock) {
			this.bottomClock = createDiv({ cls: "sfb-chess-clock" });
			column.insertBefore(this.bottomClock, (this.bar?.parentElement ?? boardWrapper).nextSibling);
		}
	}

	// Shows the eval and clocks after the move with this viewer id (the start when null).
	show(id: string | null): void {
		this.currentId = id;
		this.refresh();
	}

	// Black at the bottom when true; null turns it the other way.
	setFlipped(flipped: boolean | null): void {
		this.flipped = flipped ?? !this.flipped;
		this.refresh();
	}

	// Hides the eval while a puzzle or drill is being solved: a "#3" would give
	// the answer away. The clocks stay.
	setEvalHidden(hidden: boolean): void {
		if (hidden === this.evalHidden) return;
		this.evalHidden = hidden;
		this.refresh();
	}

	private refresh(): void {
		const { path, lineStart } = this.currentId ? linePath(this.mainline, this.currentId) : { path: [], lineStart: 0 };
		const latest = latestEvalClock(path, lineStart);
		const { white, black } = latest;
		let found = latest.evaluation;
		let stale = latest.stale;
		// The start position's eval, from a comment before move 1. The main line
		// carries it (dimmed) until a move has its own; variations do not, not
		// even one that replaces move 1.
		if (!found && onMainline(this.currentId) && this.startingEvaluation) {
			found = this.startingEvaluation;
			stale = path.length > 0;
		}
		const evaluation = this.evalHidden ? null : found;
		const whiteBottom = !this.flipped;

		if (this.bar && this.barWhite && this.barLabel) {
			const share = whiteShare(evaluation);
			this.bar.toggleClass("is-hidden", this.evalHidden);
			this.bar.toggleClass("is-flipped", !whiteBottom);
			this.barWhite.style.height = `${(share * 100).toFixed(1)}%`;
			this.barLabel.setText(evaluation ? evalLabel(evaluation) : "");
			// Carried over from an earlier move in this line: shown dimmed.
			this.barLabel.toggleClass("is-stale", stale);
			// The label sits at the end of the side that is ahead.
			this.barLabel.toggleClass("is-white", share >= 0.5);
			this.barLabel.toggleClass("is-top", (share >= 0.5) !== whiteBottom);
		}

		if (this.topClock && this.bottomClock) {
			const last = path[path.length - 1];
			const toMove = last ? (last.color === "w" ? "b" : "w") : null;
			this.setClock(whiteBottom ? this.bottomClock : this.topClock, this.names.white ?? "White", white, toMove === "w");
			this.setClock(whiteBottom ? this.topClock : this.bottomClock, this.names.black ?? "Black", black, toMove === "b");
		}
	}

	private setClock(el: HTMLElement, name: string, seconds: number | null, active: boolean): void {
		el.empty();
		el.createSpan({ cls: "sfb-chess-clock-name", text: name });
		el.createSpan({ cls: "sfb-chess-clock-time", text: seconds === null ? "-" : formatClock(seconds) });
		el.toggleClass("is-active", active);
	}
}
