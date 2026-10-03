// What each press of Hint shows for the move to find, in order: its comment
// when it has one, then the piece to move, then the move as an arrow.
export type HintStep = "comment" | "piece" | "arrow";

export function hintSteps(comment: string | null): HintStep[] {
	return comment ? ["comment", "piece", "arrow"] : ["piece", "arrow"];
}
