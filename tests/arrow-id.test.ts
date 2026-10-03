import { describe, expect, it } from "vitest";
import { arrowMarkerId } from "../src/arrow-id";

describe("arrowMarkerId", () => {
	it("differs for two arrow types on the same squares", () => {
		const hint = arrowMarkerId("sfb-arrow-1-", "hint", "e2", "e4");
		const drawing = arrowMarkerId("sfb-arrow-1-", "shape-green", "e2", "e4");
		expect(hint).not.toBe(drawing);
	});

	it("differs per board and per squares", () => {
		const id = arrowMarkerId("sfb-arrow-1-", "hint", "e2", "e4");
		expect(id).not.toBe(arrowMarkerId("sfb-arrow-2-", "hint", "e2", "e4"));
		expect(id).not.toBe(arrowMarkerId("sfb-arrow-1-", "hint", "d2", "d4"));
	});
});
