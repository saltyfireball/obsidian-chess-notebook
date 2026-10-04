import { describe, expect, it } from "vitest";
import type { BoardManager } from "../src/board-manager";
import { BoardExplorer, type ExploreHooks } from "../src/board-explorer";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

type PickUp = (square: string) => boolean;
type Legal = (from: string, to: string) => boolean;
type Finish = (from: string, to: string) => void;

// The board's move input as the explorer installs it, played by hand.
class FakeBoard {
	pickUp: PickUp | null = null;
	legal: Legal | null = null;
	finish: Finish | null = null;
	positions: string[] = [];

	enablePuzzleInput(pickUp: PickUp, legal: Legal, finish: Finish): void {
		this.pickUp = pickUp;
		this.legal = legal;
		this.finish = finish;
	}
	disablePuzzleInput(): void {
		this.pickUp = this.legal = this.finish = null;
	}
	setPosition(fen: string): Promise<void> {
		this.positions.push(fen);
		return Promise.resolve();
	}
	highlightLastMove(): void {}
	showShapes(): void {}

	// Picks up from, drops on to; false when the board refuses either.
	drag(from: string, to: string): boolean {
		if (!this.pickUp?.(from) || !this.legal?.(from, to)) return false;
		this.finish?.(from, to);
		return true;
	}
}

// Just enough of Obsidian's DOM helpers for the explore bar.
class FakeEl {
	children: FakeEl[] = [];
	text = "";
	removed = false;
	createDiv(): FakeEl {
		return this.add();
	}
	createSpan(o?: { text?: string }): FakeEl {
		const el = this.add();
		el.text = o?.text ?? "";
		return el;
	}
	createEl(): FakeEl {
		return this.add();
	}
	setText(text: string): void {
		this.text = text;
	}
	addEventListener(): void {}
	remove(): void {
		this.removed = true;
	}
	private add(): FakeEl {
		const el = new FakeEl();
		this.children.push(el);
		return el;
	}
}

function setup(base: () => string) {
	const board = new FakeBoard();
	const calls: string[] = [];
	const hooks: ExploreHooks = {
		baseFen: base,
		onPickUp: () => calls.push("pickup"),
		onEnter: () => calls.push("enter"),
		onPosition: () => calls.push("position"),
		onExit: () => calls.push("exit"),
	};
	const explorer = new BoardExplorer(board as unknown as BoardManager, new FakeEl() as unknown as HTMLElement, hooks);
	explorer.enable();
	return { board, calls, explorer };
}

describe("BoardExplorer", () => {
	it("tells the viewer when a piece of the side to move is picked up", () => {
		const { board, calls } = setup(() => START);
		expect(board.pickUp?.("e7")).toBe(false);
		expect(calls).toEqual([]);
		expect(board.pickUp?.("e2")).toBe(true);
		expect(calls).toEqual(["pickup"]);
	});

	it("enters on the first move and goes back to the game when it is undone", () => {
		const { board, calls, explorer } = setup(() => START);
		expect(board.drag("e2", "e4")).toBe(true);
		expect(explorer.active).toBe(true);
		expect(calls).toEqual(["pickup", "enter", "position"]);
		explorer.undo();
		expect(explorer.active).toBe(false);
		expect(explorer.fen).toBeNull();
		expect(calls[calls.length - 1]).toBe("exit");
	});

	it("takes back one move at a time before going back", () => {
		const { board, explorer } = setup(() => START);
		board.drag("e2", "e4");
		board.drag("e7", "e5");
		explorer.undo();
		expect(explorer.active).toBe(true);
		expect(explorer.fen).toBe(AFTER_E4);
	});

	it("starts a new line from the viewer's position when it changes", () => {
		let base = START;
		const { board, explorer } = setup(() => base);
		// Looked at the start position, then the game moved on before any drop.
		expect(board.pickUp?.("e2")).toBe(true);
		base = AFTER_E4;
		expect(board.pickUp?.("e2")).toBe(false);
		expect(board.drag("e7", "e5")).toBe(true);
		expect(explorer.fen?.split(" ")[0]).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR");
	});

	it("keeps exploring its own line once started, whatever the viewer shows", () => {
		let base = START;
		const { board, explorer } = setup(() => base);
		board.drag("d2", "d4");
		base = AFTER_E4;
		expect(board.drag("d7", "d5")).toBe(true);
		expect(explorer.fen?.split(" ")[0]).toBe("rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR");
	});

	it("refuses an illegal drop and stays out of explore", () => {
		const { board, calls, explorer } = setup(() => START);
		expect(board.drag("e2", "e5")).toBe(false);
		expect(explorer.active).toBe(false);
		expect(calls).not.toContain("enter");
	});
});
