// Option lines (a fence line or a block's header) hold key:value options,
// some with "quoted" values. These helpers keep one option's regex from
// matching text inside another option's quoted value, so
// title:"my board:blue" does not turn the board blue.

// The line with the text inside each "..." span blanked to spaces. The quotes
// stay and the length does not change, so an index into the masked line is
// the same index into the line as written. An unclosed quote is left alone.
export function maskQuoted(line: string): string {
	return line.replace(/"[^"]*"/g, (span) => `"${" ".repeat(span.length - 2)}"`);
}

function stripFlags(pattern: RegExp): string {
	return pattern.flags.replace(/[gy]/g, "");
}

// Reads the match found in the masked line back from the line as written, so
// a quoted value keeps its text. Null when it no longer matches there.
function readBack(pattern: RegExp, line: string, index: number): RegExpExecArray | null {
	const sticky = new RegExp(pattern.source, stripFlags(pattern) + "y");
	sticky.lastIndex = index;
	return sticky.exec(line);
}

// The first match of pattern whose start lies outside every quoted value.
export function execOutsideQuotes(pattern: RegExp, line: string): RegExpExecArray | null {
	const found = new RegExp(pattern.source, stripFlags(pattern)).exec(maskQuoted(line));
	return found ? readBack(pattern, line, found.index) : null;
}

// Every match of pattern whose start lies outside every quoted value.
export function matchAllOutsideQuotes(pattern: RegExp, line: string): RegExpExecArray[] {
	const masked = maskQuoted(line);
	const global = new RegExp(pattern.source, stripFlags(pattern) + "g");
	const matches: RegExpExecArray[] = [];
	let found = global.exec(masked);
	while (found !== null) {
		const match = readBack(pattern, line, found.index);
		if (match) matches.push(match);
		if (found[0].length === 0) global.lastIndex++;
		found = global.exec(masked);
	}
	return matches;
}
