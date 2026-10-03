// Counts what happened in one run of a puzzle, for the report shown when it ends.
// Moves are mainline indexes; a mistake is a wrong try at the move at that index.
export class PuzzleTally {
	private played = new Set<number>();
	private wrong = new Map<number, number>();

	recordCorrect(idx: number): void {
		this.played.add(idx);
	}

	recordWrong(idx: number): void {
		this.wrong.set(idx, (this.wrong.get(idx) ?? 0) + 1);
	}

	reset(): void {
		this.played.clear();
		this.wrong.clear();
	}

	get movesPlayed(): number {
		return this.played.size;
	}

	get mistakes(): number {
		let total = 0;
		for (const n of this.wrong.values()) total += n;
		return total;
	}

	// The moves that had wrong tries, in game order, with how many each.
	mistakeMoves(): { idx: number; count: number }[] {
		return [...this.wrong.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([idx, count]) => ({ idx, count }));
	}
}

// "12." for a white move, "12..." for a black one.
export function moveLabel(moveNumber: number, color: "w" | "b", san: string): string {
	return moveNumber + (color === "w" ? ". " : "... ") + san;
}

export function renderPuzzleReport(
	parent: HTMLElement,
	tally: PuzzleTally,
	labelFor: (idx: number) => string,
	onJump: (idx: number) => void,
): HTMLElement {
	const report = parent.createDiv({ cls: "sfb-chess-puzzle-report" });
	const stats = report.createDiv({ cls: "sfb-chess-puzzle-report-stats" });
	stats.createSpan({ text: "Moves played: " + tally.movesPlayed });
	stats.createSpan({ text: "Mistakes: " + tally.mistakes });

	const moves = tally.mistakeMoves();
	if (moves.length > 0) {
		const list = report.createDiv({ cls: "sfb-chess-puzzle-report-moves" });
		list.createSpan({ text: "Missed on:" });
		for (const { idx, count } of moves) {
			const link = list.createEl("button", {
				cls: "sfb-chess-puzzle-report-move",
				text: labelFor(idx) + (count > 1 ? " (x" + count + ")" : ""),
				attr: { type: "button", "aria-label": "Go to " + labelFor(idx) },
			});
			link.addEventListener("click", () => onJump(idx));
		}
	}
	return report;
}
