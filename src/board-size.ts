// Board widths in pixels for the named sizes. medium is the width boards had
// before the size option existed.
export const BOARD_SIZES: Record<string, number> = {
	small: 300,
	medium: 420,
	large: 560,
};

export const DEFAULT_BOARD_SIZE = "medium";

const MIN_PX = 160;
const MAX_PX = 1600;

// The board width for a size: option value, small|medium|large or a pixel
// width such as 360 or 360px. Null when it is neither, so the default applies.
export function parseBoardSize(value: string): number | null {
	const v = value.trim().toLowerCase();
	if (v in BOARD_SIZES) return BOARD_SIZES[v];
	const m = /^(\d+)(?:px)?$/.exec(v);
	if (!m) return null;
	return Math.min(MAX_PX, Math.max(MIN_PX, parseInt(m[1])));
}

// The width a block's board gets: its own size: option, else the default
// size from the settings, else medium.
export function resolveBoardSize(blockSize: number | null, settingSize: string): number {
	return blockSize ?? parseBoardSize(settingSize) ?? BOARD_SIZES[DEFAULT_BOARD_SIZE];
}
