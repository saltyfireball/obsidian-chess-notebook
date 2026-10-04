// Counts the runs of a mode (a drill, a puzzle) so a callback timed in one
// run does nothing once another has started (Restart, Reset) or the mode is
// left.
export class RunGeneration {
	private current = 0;

	next(): void {
		this.current++;
	}

	// fn, bound to the run it was made in: calling it later in another run is
	// a no-op.
	guard(fn: () => void): () => void {
		const run = this.current;
		return () => {
			if (run === this.current) fn();
		};
	}
}
