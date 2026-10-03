import { Chess, type Square } from "chess.js";

export interface ExploreMove {
	san: string;
	from: string;
	to: string;
	color: "w" | "b";
	moveNumber: number;
	fenAfter: string;
}

// Moves the reader tries from one position of a game. Nothing here touches
// the game itself: back() just forgets the line.
export class ExploreLine {
	private chess: Chess;
	private played: ExploreMove[] = [];

	constructor(readonly startFen: string) {
		this.chess = new Chess(startFen);
	}

	// False for a FEN chess.js refuses, which a line cannot start from.
	static canStart(fen: string): boolean {
		try {
			new Chess(fen);
			return true;
		} catch {
			return false;
		}
	}

	get moves(): readonly ExploreMove[] {
		return this.played;
	}

	get fen(): string {
		return this.chess.fen();
	}

	get lastMove(): ExploreMove | null {
		return this.played[this.played.length - 1] ?? null;
	}

	sideToMove(): "w" | "b" {
		return this.chess.turn();
	}

	// True when square holds a piece of the side to move.
	hasOwnPiece(square: string): boolean {
		const piece = this.chess.get(square as Square);
		return piece !== undefined && piece !== null && piece.color === this.chess.turn();
	}

	// True when from-to is a legal move here; a pawn reaching the last rank
	// counts, it promotes to a queen.
	isLegal(from: string, to: string): boolean {
		return this.chess.moves({ verbose: true }).some((m) => m.from === from && m.to === to);
	}

	// Plays from-to if it is legal, and returns it; null leaves the line as it was.
	push(from: string, to: string): ExploreMove | null {
		if (!this.isLegal(from, to)) return null;
		const moveNumber = this.chess.moveNumber();
		const move = this.chess.move({ from, to, promotion: "q" });
		const played: ExploreMove = {
			san: move.san,
			from: move.from,
			to: move.to,
			color: move.color,
			moveNumber,
			fenAfter: this.chess.fen(),
		};
		this.played.push(played);
		return played;
	}

	// Takes back the last move; false when there was none.
	undo(): boolean {
		if (this.played.length === 0) return false;
		this.chess.undo();
		this.played.pop();
		return true;
	}

	// The line as text: "12...Nf6 13.d4". A black first move carries its "...".
	sanList(): string {
		return this.played
			.map((m, i) => {
				if (m.color === "w") return m.moveNumber + "." + m.san;
				return i === 0 ? m.moveNumber + "..." + m.san : m.san;
			})
			.join(" ");
	}

	// Forgets every move and returns the position the line started from.
	back(): string {
		this.chess = new Chess(this.startFen);
		this.played = [];
		return this.startFen;
	}
}
