import { describe, expect, it, vi } from "vitest";
import { RunGeneration } from "../src/run-generation";

describe("RunGeneration", () => {
	it("runs a guarded callback in the run it was made in", () => {
		const runs = new RunGeneration();
		const fn = vi.fn();
		runs.next();
		runs.guard(fn)();
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("drops the wrong-move and reply timers once a new run has started", () => {
		vi.useFakeTimers();
		try {
			const runs = new RunGeneration();
			const wrongMove = vi.fn();
			const reply = vi.fn();
			runs.next();
			setTimeout(runs.guard(wrongMove), 800);
			setTimeout(runs.guard(reply), 500);
			runs.next();
			const fresh = vi.fn();
			setTimeout(runs.guard(fresh), 500);
			vi.advanceTimersByTime(1000);
			expect(wrongMove).not.toHaveBeenCalled();
			expect(reply).not.toHaveBeenCalled();
			expect(fresh).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
