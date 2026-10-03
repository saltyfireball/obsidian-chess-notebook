// The part of a copy button that does not touch Obsidian or the real
// clipboard, so tests can drive it with a fake write and a fake timer.

export const COPIED_CLASS = "sfb-chess-btn-copied";

export interface FlashTarget {
	addClass(cls: string): void;
	removeClass(cls: string): void;
}

export interface CopyDeps {
	write: (text: string) => Promise<void>;
	notify: (message: string) => void;
	// The viewer's own timer, so a closed note leaves nothing behind.
	schedule: (fn: () => void, ms: number) => void;
	// False once the viewer is destroyed: a write that finishes later says nothing.
	alive: () => boolean;
}

// Copies text, then says what was copied and flashes the button that did it.
// A refused write says so instead. The promise never rejects.
export async function copyText(btn: FlashTarget | null, text: string, what: string, deps: CopyDeps): Promise<void> {
	let ok = true;
	try {
		await deps.write(text);
	} catch {
		ok = false;
	}
	if (!deps.alive()) return;
	if (!ok) {
		deps.notify(`Could not copy ${what}`);
		return;
	}
	deps.notify(`${what} copied`);
	if (!btn) return;
	btn.addClass(COPIED_CLASS);
	deps.schedule(() => btn.removeClass(COPIED_CLASS), 1500);
}
