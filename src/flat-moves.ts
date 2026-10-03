import { positionKey } from "./draw";
import type { MoveNode } from "./pgn-parser";

export interface FlatMove {
	node: MoveNode;
	id: string;
	// Times the position after this move has occurred in its line, itself included.
	repeats: number;
}

// Every move of the tree in display order, each with its id and repetition count.
export function flattenMoves(moves: MoveNode[], startingFen: string): FlatMove[] {
	const out: FlatMove[] = [];
	walk(moves, "m", [positionKey(startingFen)], out);
	return out;
}

// path holds the position keys of the line before moves[0]. A variation that
// replaces its parent move starts from the path before that move. One that
// continues after it (its first move is by the other side) starts after it.
function walk(moves: MoveNode[], prefix: string, path: string[], out: FlatMove[]): void {
	const startLength = path.length;
	for (let i = 0; i < moves.length; i++) {
		const node = moves[i];
		const id = prefix + "-" + i;
		const key = positionKey(node.fen);
		const repeats = path.filter((k) => k === key).length + 1;
		out.push({ node, id, repeats });
		for (let v = 0; v < node.variations.length; v++) {
			const variation = node.variations[v];
			const continues = variation.length > 0 && variation[0].color !== node.color;
			if (continues) path.push(key);
			walk(variation, id + "v" + v, path, out);
			if (continues) path.pop();
		}
		path.push(key);
	}
	path.length = startLength;
}
