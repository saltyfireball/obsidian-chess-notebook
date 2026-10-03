import { describe, expect, it } from "vitest";
import { HintProgress } from "../src/hints";

describe("HintProgress", () => {
	it("walks the steps for one move, then stops", () => {
		const progress = new HintProgress<string>();
		expect(progress.next("Nf3", "Develops.")).toEqual({ step: "comment", last: false });
		expect(progress.next("Nf3", "Develops.")).toEqual({ step: "piece", last: false });
		expect(progress.next("Nf3", "Develops.")).toEqual({ step: "arrow", last: true });
		expect(progress.next("Nf3", "Develops.")).toBeNull();
	});

	it("starts over at the comment when the move to find changes", () => {
		const progress = new HintProgress<string>();
		progress.next("B", "Comment B.");
		expect(progress.isStale("A")).toBe(true);
		expect(progress.isStale("B")).toBe(false);
		expect(progress.next("A", "Comment A.")).toEqual({ step: "comment", last: false });
	});

	it("is not stale before any hint or after a reset", () => {
		const progress = new HintProgress<string>();
		expect(progress.isStale("A")).toBe(false);
		progress.next("A", null);
		progress.reset();
		expect(progress.isStale("B")).toBe(false);
		expect(progress.next("A", null)).toEqual({ step: "piece", last: false });
	});
});
