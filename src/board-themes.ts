// Board colour themes. Each name is a CSS class, sfb-board-<name>, set on the
// board's container; styles.css gives each one its square colours.
export const BOARD_THEMES = ["green", "brown", "blue", "wood", "grey"] as const;

export type BoardTheme = (typeof BOARD_THEMES)[number];

export const DEFAULT_BOARD_THEME: BoardTheme = "green";

const ALIASES: Record<string, BoardTheme> = { gray: "grey" };

// A known theme name, or null. Case does not matter and gray means grey.
export function parseBoardTheme(name: string | null | undefined): BoardTheme | null {
	if (!name) return null;
	const lower = name.trim().toLowerCase();
	if (ALIASES[lower]) return ALIASES[lower];
	return (BOARD_THEMES as readonly string[]).includes(lower) ? (lower as BoardTheme) : null;
}

// The theme to draw: the block's if it names one, else the setting's, else
// green. Settings saved by earlier versions hold the old class name here.
export function resolveBoardTheme(block: string | null, setting: string): BoardTheme {
	return parseBoardTheme(block) ?? parseBoardTheme(setting) ?? DEFAULT_BOARD_THEME;
}

export function boardThemeClass(theme: BoardTheme): string {
	return `sfb-board-${theme}`;
}
