import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ Notice: class {} }));

import { DrillRuns } from "../src/drill";
import { PgnViewer } from "../src/pgn-viewer";
import { PuzzleTally } from "../src/puzzle-report";

// The viewer's puzzle logic with its board and DOM stubbed out: navigation
// only moves currentMoveId, so the test sees which move the board is on.
function puzzleViewer() {
	const v = Object.create(PgnViewer.prototype) as Record<string, unknown>;
	Object.assign(v, {
		puzzleMode: true,
		puzzleComplete: false,
		puzzleHighWater: -1,
		puzzleTally: new PuzzleTally(),
		puzzleRuns: new DrillRuns(),
		drillMode: false,
		mainlineMoves: [{}, {}, {}, {}],
		currentMoveId: null,
		timers: new Set<number>(),
		destroyed: false,
		boardManager: { disablePuzzleInput: () => {} },
		clearHint: () => {},
		clearPuzzleReport: () => {},
		updateMoveVisibility: () => {},
		enablePuzzleInput: () => {},
		autoPlayOpponentIfNeeded: () => {},
		showPuzzleComplete: () => {},
		goToStart: () => { v.currentMoveId = null; },
		goToMoveById: (id: string) => { v.currentMoveId = id; },
	});
	return v as Record<string, unknown> & {
		currentMoveId: string | null;
		onCorrectPuzzleMove(idx: number): void;
		resetPuzzle(): void;
	};
}

describe("puzzle runs", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("window", globalThis);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("plays the opponent's reply after a correct move", () => {
		const v = puzzleViewer();
		v.onCorrectPuzzleMove(0);
		expect(v.currentMoveId).toBe("m-0");
		vi.advanceTimersByTime(500);
		expect(v.currentMoveId).toBe("m-1");
	});

	it("ignores the old run's reply after a reset and a replay of the same move", () => {
		const v = puzzleViewer();
		v.onCorrectPuzzleMove(0);
		vi.advanceTimersByTime(300);
		v.resetPuzzle();
		v.onCorrectPuzzleMove(0);
		// The old run's reply was due now; the new run's is 300ms away.
		vi.advanceTimersByTime(200);
		expect(v.currentMoveId).toBe("m-0");
		vi.advanceTimersByTime(300);
		expect(v.currentMoveId).toBe("m-1");
	});
});
