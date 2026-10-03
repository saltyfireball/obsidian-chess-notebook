// The id of an arrow head's <marker>: the board's prefix, the arrow type's
// class and the squares. The type is in it so two arrows on the same squares
// (a hint over a PGN drawing) do not share one head colour.
export function arrowMarkerId(prefix: string, typeClass: string, from: string, to: string): string {
	return prefix + typeClass + "-" + from + to;
}
