// Just enough of the Obsidian API for the plugin to run in a plain browser
// page, so the README media can be captured headlessly. Not shipped.

type Listener = (...args: unknown[]) => void;

export class TAbstractFile {
	constructor(public path: string) {}
}

export class TFile extends TAbstractFile {
	stat = { mtime: Date.now(), ctime: Date.now(), size: 0 };
	get basename(): string {
		return this.path.split("/").pop()!.replace(/\.[^.]+$/, "");
	}
	get extension(): string {
		return this.path.split(".").pop() ?? "";
	}
}

export function normalizePath(p: string): string {
	return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

class Vault {
	private files = new Map<string, { file: TFile; content: string }>();
	private listeners = new Map<string, Listener[]>();

	write(path: string, content: string): void {
		const entry = this.files.get(path);
		if (entry) {
			entry.content = content;
			entry.file.stat.mtime = Date.now() + Math.random();
			this.trigger("modify", entry.file);
		} else {
			this.files.set(path, { file: new TFile(path), content });
		}
	}
	getAbstractFileByPath(path: string): TAbstractFile | null {
		return this.files.get(path)?.file ?? null;
	}
	async cachedRead(file: TFile): Promise<string> {
		return this.files.get(file.path)?.content ?? "";
	}
	on(name: string, cb: Listener): { name: string; cb: Listener } {
		const list = this.listeners.get(name) ?? [];
		list.push(cb);
		this.listeners.set(name, list);
		return { name, cb };
	}
	trigger(name: string, ...args: unknown[]): void {
		for (const cb of this.listeners.get(name) ?? []) cb(...args);
	}
}

export class App {
	vault = new Vault();
	metadataCache = {
		getFirstLinkpathDest: (link: string): TFile | null => {
			const f = this.vault.getAbstractFileByPath(normalizePath(link));
			return f instanceof TFile ? f : null;
		},
	};
}

export class Component {
	private children: Component[] = [];
	private loaded = false;
	load(): void {
		if (this.loaded) return;
		this.loaded = true;
		this.onload();
		for (const c of this.children) c.load();
	}
	unload(): void {
		if (!this.loaded) return;
		this.loaded = false;
		for (const c of this.children) c.unload();
		this.onunload();
	}
	onload(): void {}
	onunload(): void {}
	addChild<T extends Component>(c: T): T {
		this.children.push(c);
		if (this.loaded) c.load();
		return c;
	}
	registerEvent(): void {}
}

export class MarkdownRenderChild extends Component {
	constructor(public containerEl: HTMLElement) {
		super();
	}
}

export interface MarkdownPostProcessorContext {
	sourcePath: string;
	addChild(c: Component): void;
	getSectionInfo(el: HTMLElement): { text: string; lineStart: number; lineEnd: number } | null;
}

type BlockProcessor = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void;

export class Plugin extends Component {
	processors = new Map<string, BlockProcessor>();
	settingTab: PluginSettingTab | null = null;
	private data: unknown = null;
	constructor(public app: App, public manifest: unknown) {
		super();
	}
	async loadData(): Promise<unknown> {
		return this.data;
	}
	async saveData(d: unknown): Promise<void> {
		this.data = d;
	}
	addSettingTab(tab: PluginSettingTab): void {
		this.settingTab = tab;
	}
	registerExtensions(): void {}
	registerMarkdownCodeBlockProcessor(lang: string, fn: BlockProcessor): void {
		this.processors.set(lang, fn);
	}
}

export class PluginSettingTab {
	containerEl: HTMLElement = document.createElement("div");
	constructor(public app: App, public plugin: Plugin) {
		this.containerEl.className = "vertical-tab-content";
	}
	display(): void {}
}

// The settings rows, shaped like Obsidian's .setting-item markup.
export class Setting {
	settingEl: HTMLElement;
	private info: HTMLElement;
	private nameEl: HTMLElement;
	private descEl: HTMLElement;
	private controlEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = containerEl.createDiv({ cls: "setting-item" });
		this.info = this.settingEl.createDiv({ cls: "setting-item-info" });
		this.nameEl = this.info.createDiv({ cls: "setting-item-name" });
		this.descEl = this.info.createDiv({ cls: "setting-item-description" });
		this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" });
	}
	setName(name: string): this {
		this.nameEl.setText(name);
		return this;
	}
	setDesc(desc: string | DocumentFragment): this {
		if (typeof desc === "string") this.descEl.setText(desc);
		else this.descEl.appendChild(desc);
		return this;
	}
	setHeading(): this {
		this.settingEl.addClass("setting-item-heading");
		return this;
	}
	addDropdown(cb: (d: Dropdown) => void): this {
		cb(new Dropdown(this.controlEl));
		return this;
	}
	addSlider(cb: (s: Slider) => void): this {
		cb(new Slider(this.controlEl));
		return this;
	}
	addText(cb: (t: TextInput) => void): this {
		cb(new TextInput(this.controlEl));
		return this;
	}
	addToggle(cb: (t: Toggle) => void): this {
		cb(new Toggle(this.controlEl));
		return this;
	}
}

class Dropdown {
	selectEl: HTMLSelectElement;
	constructor(parent: HTMLElement) {
		this.selectEl = parent.createEl("select", { cls: "dropdown" });
	}
	addOption(value: string, label: string): this {
		this.selectEl.createEl("option", { value, text: label });
		return this;
	}
	addOptions(opts: Record<string, string>): this {
		for (const [v, l] of Object.entries(opts)) this.addOption(v, l);
		return this;
	}
	setValue(v: string): this {
		this.selectEl.value = v;
		return this;
	}
	onChange(): this {
		return this;
	}
}

class Slider {
	sliderEl: HTMLInputElement;
	constructor(parent: HTMLElement) {
		this.sliderEl = parent.createEl("input", { type: "range", cls: "slider" });
	}
	setLimits(min: number, max: number, step: number | "any"): this {
		this.sliderEl.min = String(min);
		this.sliderEl.max = String(max);
		this.sliderEl.step = String(step);
		return this;
	}
	setValue(v: number): this {
		this.sliderEl.value = String(v);
		return this;
	}
	setDynamicTooltip(): this {
		return this;
	}
	onChange(): this {
		return this;
	}
}

class TextInput {
	inputEl: HTMLInputElement;
	constructor(parent: HTMLElement) {
		this.inputEl = parent.createEl("input", { type: "text" });
	}
	setPlaceholder(p: string): this {
		this.inputEl.placeholder = p;
		return this;
	}
	setValue(v: string): this {
		this.inputEl.value = v;
		return this;
	}
	onChange(): this {
		return this;
	}
}

class Toggle {
	toggleEl: HTMLElement;
	constructor(parent: HTMLElement) {
		this.toggleEl = parent.createDiv({ cls: "checkbox-container" });
	}
	setValue(v: boolean): this {
		this.toggleEl.toggleClass("is-enabled", v);
		return this;
	}
	onChange(): this {
		return this;
	}
}
