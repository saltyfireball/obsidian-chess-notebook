import { describe, expect, it } from "vitest";
import { COPIED_CLASS, copyText, type CopyDeps } from "../src/copy-feedback";

function fakeButton() {
	const classes = new Set<string>();
	return {
		classes,
		addClass: (cls: string) => { classes.add(cls); },
		removeClass: (cls: string) => { classes.delete(cls); },
	};
}

function fakeViewer(write: CopyDeps["write"]) {
	const notices: string[] = [];
	const timers: (() => void)[] = [];
	let open = true;
	const deps: CopyDeps = {
		write,
		notify: (message) => { notices.push(message); },
		schedule: (fn) => { timers.push(fn); },
		alive: () => open,
	};
	return { deps, notices, timers, destroy: () => { open = false; } };
}

describe("copyText", () => {
	it("writes the text, says it was copied and flashes the button", async () => {
		const written: string[] = [];
		const viewer = fakeViewer(async (t) => { written.push(t); });
		const btn = fakeButton();
		await copyText(btn, "8/8/8/8/8/8/8/8 w - - 0 1", "FEN", viewer.deps);
		expect(written).toEqual(["8/8/8/8/8/8/8/8 w - - 0 1"]);
		expect(viewer.notices).toEqual(["FEN copied"]);
		expect(btn.classes.has(COPIED_CLASS)).toBe(true);
		expect(viewer.timers).toHaveLength(1);
		viewer.timers[0]();
		expect(btn.classes.has(COPIED_CLASS)).toBe(false);
	});

	it("says the copy failed when the write is refused, without the copied state", async () => {
		const viewer = fakeViewer(() => Promise.reject(new Error("denied")));
		const btn = fakeButton();
		await expect(copyText(btn, "1.e4 *", "PGN", viewer.deps)).resolves.toBeUndefined();
		expect(viewer.notices).toEqual(["Could not copy PGN"]);
		expect(btn.classes.size).toBe(0);
		expect(viewer.timers).toHaveLength(0);
	});

	it("says the copy failed when the clipboard throws before returning a promise", async () => {
		const viewer = fakeViewer(() => { throw new Error("no clipboard"); });
		await copyText(null, "x", "FEN", viewer.deps);
		expect(viewer.notices).toEqual(["Could not copy FEN"]);
	});

	it("does nothing when the write finishes after the viewer is destroyed", async () => {
		let finish!: () => void;
		const viewer = fakeViewer(() => new Promise<void>((resolve) => { finish = resolve; }));
		const btn = fakeButton();
		const done = copyText(btn, "x", "FEN", viewer.deps);
		viewer.destroy();
		finish();
		await done;
		expect(viewer.notices).toEqual([]);
		expect(btn.classes.size).toBe(0);
		expect(viewer.timers).toHaveLength(0);
	});

	it("stays quiet when a refused write lands after the viewer is destroyed", async () => {
		let fail!: (e: Error) => void;
		const viewer = fakeViewer(() => new Promise<void>((_, reject) => { fail = reject; }));
		const done = copyText(fakeButton(), "x", "FEN", viewer.deps);
		viewer.destroy();
		fail(new Error("denied"));
		await expect(done).resolves.toBeUndefined();
		expect(viewer.notices).toEqual([]);
	});
});
