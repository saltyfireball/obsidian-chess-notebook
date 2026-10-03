import { describe, expect, it } from "vitest";
import { hintSteps } from "../src/hints";

describe("hintSteps", () => {
	it("starts with the comment when the move has one", () => {
		expect(hintSteps("Wins the queen.")).toEqual(["comment", "piece", "arrow"]);
	});

	it("skips the comment step when there is none", () => {
		expect(hintSteps(null)).toEqual(["piece", "arrow"]);
		expect(hintSteps("")).toEqual(["piece", "arrow"]);
	});
});
