export interface NagInfo {
	symbol: string;
	description: string;
	cssClass: string;
}

// Move quality annotations - shown as colored circles
// Position/evaluation annotations - shown as styled inline text
// The cssClass determines display style (circle vs text)

const NAG_TABLE: Record<string, NagInfo> = {
	// --- Move quality ($1-$6) - colored circles ---
	"!":  { symbol: "!",  description: "Good move",        cssClass: "sfb-chess-nag-good" },
	"?":  { symbol: "?",  description: "Mistake",          cssClass: "sfb-chess-nag-mistake" },
	"!!": { symbol: "!!", description: "Brilliant move",   cssClass: "sfb-chess-nag-brilliant" },
	"??": { symbol: "??", description: "Blunder",          cssClass: "sfb-chess-nag-blunder" },
	"!?": { symbol: "!?", description: "Interesting move", cssClass: "sfb-chess-nag-interesting" },
	"?!": { symbol: "?!", description: "Dubious move",     cssClass: "sfb-chess-nag-inaccuracy" },

	// --- Forced / only move ($7) ---
	"\u25A1": { symbol: "\u25A1", description: "Only move", cssClass: "sfb-chess-nag-positional" },

	// --- Position evaluation ($10-$19) - inline styled text ---
	"=":  { symbol: "=",        description: "Equal position",                    cssClass: "sfb-chess-nag-eval" },
	"\u221E": { symbol: "\u221E", description: "Unclear position",                cssClass: "sfb-chess-nag-eval" },
	"\u2A72": { symbol: "\u2A72", description: "White has a slight advantage",    cssClass: "sfb-chess-nag-eval-white" },
	"\u2A71": { symbol: "\u2A71", description: "Black has a slight advantage",    cssClass: "sfb-chess-nag-eval-black" },
	"\u00B1": { symbol: "\u00B1", description: "White has a moderate advantage",  cssClass: "sfb-chess-nag-eval-white" },
	"\u2213": { symbol: "\u2213", description: "Black has a moderate advantage",  cssClass: "sfb-chess-nag-eval-black" },
	"+-":  { symbol: "+-",       description: "White has a decisive advantage",   cssClass: "sfb-chess-nag-eval-white" },
	"-+":  { symbol: "-+",       description: "Black has a decisive advantage",   cssClass: "sfb-chess-nag-eval-black" },
	"+/-": { symbol: "+/-",      description: "White has a moderate advantage",   cssClass: "sfb-chess-nag-eval-white" },
	"-/+": { symbol: "-/+",      description: "Black has a moderate advantage",   cssClass: "sfb-chess-nag-eval-black" },
	"+=":  { symbol: "+=",       description: "White has a slight advantage",     cssClass: "sfb-chess-nag-eval-white" },
	"=+":  { symbol: "=+",       description: "Black has a slight advantage",     cssClass: "sfb-chess-nag-eval-black" },

	// --- Positional annotations ($22+) ---
	"\u2A00": { symbol: "\u2A00", description: "Zugzwang",                                cssClass: "sfb-chess-nag-positional" },
	"\u25CB": { symbol: "\u25CB", description: "Space advantage",                         cssClass: "sfb-chess-nag-positional" },
	"\u27F3": { symbol: "\u27F3", description: "Development advantage",                   cssClass: "sfb-chess-nag-positional" },
	"\u2191": { symbol: "\u2191", description: "Initiative",                              cssClass: "sfb-chess-nag-positional" },
	"\u2192": { symbol: "\u2192", description: "Attack",                                  cssClass: "sfb-chess-nag-positional" },
	"\u2BF9": { symbol: "\u2BF9", description: "Sufficient compensation for material",    cssClass: "sfb-chess-nag-positional" },
	"\u21C6": { symbol: "\u21C6", description: "Counterplay",                             cssClass: "sfb-chess-nag-positional" },
	"\u2A01": { symbol: "\u2A01", description: "Time pressure",                           cssClass: "sfb-chess-nag-positional" },

	// --- Non-standard ($140+) ---
	"\u2206": { symbol: "\u2206", description: "With the idea...",    cssClass: "sfb-chess-nag-positional" },
	"\u2207": { symbol: "\u2207", description: "Aimed against...",    cssClass: "sfb-chess-nag-positional" },
	"\u2313": { symbol: "\u2313", description: "Better is...",        cssClass: "sfb-chess-nag-positional" },
	"N":      { symbol: "N",      description: "Novelty",             cssClass: "sfb-chess-nag-positional" },
	"RR":     { symbol: "RR",     description: "Editorial comment",   cssClass: "sfb-chess-nag-positional" },

	// --- Pawn structure ---
	"\u2BFA": { symbol: "\u2BFA", description: "Connected pawns",     cssClass: "sfb-chess-nag-positional" },
	"\u2BFB": { symbol: "\u2BFB", description: "Isolated pawns",      cssClass: "sfb-chess-nag-positional" },
	"\u2BFC": { symbol: "\u2BFC", description: "Doubled pawns",       cssClass: "sfb-chess-nag-positional" },
	"\u2BFD": { symbol: "\u2BFD", description: "Passed pawn",         cssClass: "sfb-chess-nag-positional" },
};

// $N code -> symbol mapping for the parser
export const NAG_CODE_MAP: Record<string, string> = {
	"$1": "!", "$2": "?", "$3": "!!", "$4": "??", "$5": "!?", "$6": "?!",
	"$7": "\u25A1",
	"$10": "=",
	"$13": "\u221E",
	"$14": "\u2A72", "$15": "\u2A71",
	"$16": "\u00B1", "$17": "\u2213",
	"$18": "+-", "$19": "-+",
	"$22": "\u2A00", "$23": "\u2A00",
	"$26": "\u25CB", "$27": "\u25CB",
	"$32": "\u27F3", "$33": "\u27F3",
	"$36": "\u2191", "$37": "\u2191",
	"$40": "\u2192", "$41": "\u2192",
	"$44": "\u2BF9", "$45": "\u2BF9",
	"$132": "\u21C6", "$133": "\u21C6",
	"$138": "\u2A01", "$139": "\u2A01",
	"$140": "\u2206", "$141": "\u2207", "$142": "\u2313",
	"$145": "RR", "$146": "N",
	"$249": "\u2BFA", "$250": "\u2BFB", "$251": "\u2BFC", "$252": "\u2BFD",
};

// Unicode chars that can appear directly in PGN text -> NAG symbol
export const UNICODE_NAG_MAP: Record<string, string> = {
	"\u2A72": "\u2A72",  // ⩲ plus above equals
	"\u2A71": "\u2A71",  // ⩱ equals above plus
	"\u00B1": "\u00B1",  // ± plus-minus
	"\u2213": "\u2213",  // ∓ minus-plus
	"\u221E": "\u221E",  // ∞ infinity
	"\u25A1": "\u25A1",  // □ white square
	"\u2A00": "\u2A00",  // ⨀ zugzwang
	"\u25CB": "\u25CB",  // ○ space advantage
	"\u27F3": "\u27F3",  // ⟳ development
	"\u2191": "\u2191",  // ↑ initiative
	"\u2192": "\u2192",  // → attack
	"\u2BF9": "\u2BF9",  // ⯹ compensation
	"\u21C6": "\u21C6",  // ⇆ counterplay
	"\u2A01": "\u2A01",  // ⨁ time pressure
	"\u2206": "\u2206",  // ∆ with the idea
	"\u2207": "\u2207",  // ∇ aimed against
	"\u2313": "\u2313",  // ⌓ better is
	"\u2BFA": "\u2BFA",  // ⯺ connected pawns
	"\u2BFB": "\u2BFB",  // ⯻ isolated pawns
	"\u2BFC": "\u2BFC",  // ⯼ doubled pawns
	"\u2BFD": "\u2BFD",  // ⯽ passed pawn
};

// Build a regex pattern for all Unicode NAG symbols
const unicodeNagChars = Object.keys(UNICODE_NAG_MAP).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
export const UNICODE_NAG_REGEX = new RegExp(`^(${unicodeNagChars})`);

export function getNagInfo(symbol: string): NagInfo | null {
	return NAG_TABLE[symbol] ?? null;
}

export function nagCodeToSymbol(code: string): string | null {
	return NAG_CODE_MAP[code] ?? null;
}
