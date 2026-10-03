// What each press of Hint shows for the move to find, in order: its comment
// when it has one, then the piece to move, then the move as an arrow.
export type HintStep = "comment" | "piece" | "arrow";

export function hintSteps(comment: string | null): HintStep[] {
	return comment ? ["comment", "piece", "arrow"] : ["piece", "arrow"];
}

// How far the hints for one move to find have gone. The count belongs to that
// move: asking for a different one (after navigating) starts over.
export class HintProgress<T> {
	private target: T | null = null;
	private shown = 0;

	// The next step for target, or null when all of them are showing.
	next(target: T, comment: string | null): { step: HintStep; last: boolean } | null {
		if (target !== this.target) this.reset();
		this.target = target;
		const steps = hintSteps(comment);
		if (this.shown >= steps.length) return null;
		const step = steps[this.shown++];
		return { step, last: this.shown === steps.length };
	}

	// True when hints are showing for some move other than target.
	isStale(target: T | null): boolean {
		return this.shown > 0 && target !== this.target;
	}

	reset(): void {
		this.target = null;
		this.shown = 0;
	}
}
