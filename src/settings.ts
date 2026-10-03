import { App, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type ChessPlugin from "./main";
import { DEFAULT_SETTINGS } from "./types";
import { listPieceSets } from "./fan-pieces";

const AUTO_PLAY = { min: 500, max: 5000, step: 100 };
const AUTO_PLAY_DESC = "Interval in milliseconds between moves during auto-play.";
const PIECE_SET_DESC = "Default piece set for the board and figurine notation. Override per block with pieces:name.";

// Built by hand: Object.fromEntries is ES2019, past this tsconfig's lib, so
// it types as any and the review flags it.
function pieceSetOptions(): Record<string, string> {
	const options: Record<string, string> = {};
	for (const s of listPieceSets()) options[s] = s;
	return options;
}

export class ChessSettingTab extends PluginSettingTab {
	plugin: ChessPlugin;

	constructor(app: App, plugin: ChessPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Obsidian 1.13 and later render the tab from these, which also puts the
	// settings in the settings search. display() is the fallback for older versions.
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: "page",
				name: "How to use",
				desc: "Code blocks, header tags and options.",
				items: [
					{
						type: "group",
						items: [
							{
								name: "Quick reference",
								aliases: ["fen", "pgn", "code block", "options", "header tags"],
								render: (setting) => {
									setting.settingEl.empty();
									setting.settingEl.addClass("sfb-chess-settings-reference");
									renderReference(setting.settingEl);
								},
							},
						],
					},
				],
			},
			{
				type: "group",
				heading: "Playback",
				items: [
					{
						name: "Auto-play speed",
						desc: AUTO_PLAY_DESC,
						aliases: ["autoplay", "speed", "interval"],
						control: { type: "slider", key: "autoPlaySpeed", ...AUTO_PLAY, defaultValue: DEFAULT_SETTINGS.autoPlaySpeed },
					},
				],
			},
			{
				type: "group",
				heading: "Pieces & notation",
				items: [
					{
						name: "Piece set",
						desc: PIECE_SET_DESC,
						aliases: ["pieces", "figurine", "fan"],
						control: {
							type: "dropdown",
							key: "fanPieceSet",
							options: pieceSetOptions(),
							defaultValue: DEFAULT_SETTINGS.fanPieceSet,
						},
					},
				],
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		await this.plugin.saveSettings();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("How to use").setHeading();
		renderReference(containerEl);

		new Setting(containerEl).setName("Playback").setHeading();

		// Before 1.13 the slider does not show its value, so the description does.
		const speedDesc = (ms: number) => `${AUTO_PLAY_DESC} Now ${ms} ms.`;
		const speedSetting = new Setting(containerEl)
			.setName("Auto-play speed")
			.setDesc(speedDesc(this.plugin.settings.autoPlaySpeed));
		speedSetting.addSlider((slider) =>
			slider
				.setLimits(AUTO_PLAY.min, AUTO_PLAY.max, AUTO_PLAY.step)
				.setValue(this.plugin.settings.autoPlaySpeed)
				.onChange(async (value) => {
					this.plugin.settings.autoPlaySpeed = value;
					speedSetting.setDesc(speedDesc(value));
					await this.plugin.saveSettings();
				})
		);

		new Setting(containerEl).setName("Pieces & notation").setHeading();

		const pieceSetting = new Setting(containerEl)
			.setName("Piece set")
			.setDesc(PIECE_SET_DESC);

		pieceSetting.addDropdown((dropdown) => {
			for (const s of listPieceSets()) {
				dropdown.addOption(s, s);
			}
			dropdown.setValue(this.plugin.settings.fanPieceSet);
			dropdown.onChange(async (value) => {
				this.plugin.settings.fanPieceSet = value;
				await this.plugin.saveSettings();
			});
		});
	}
}

// The quick reference: code blocks, header tags, options and comments.
function renderReference(containerEl: HTMLElement): void {
	const usageDesc = containerEl.createDiv({ cls: "sfb-chess-settings-usage" });

	usageDesc.createEl("p", {
		text: "Create a chessboard code block with type:fen or type:pgn.",
	});

	const fenExample = usageDesc.createEl("pre");
	fenExample.createEl("code", {
		text: "```chessboard type:fen\nrnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1\n```",
	});

	const pgnExample = usageDesc.createEl("pre");
	pgnExample.createEl("code", {
		text: '```chessboard type:pgn\n[Event "My Game"]\n[White "Player 1"]\n[Black "Player 2"]\n\n1.e4 e5 2.Nf3 Nc6 *\n```',
	});

	new Setting(containerEl).setName("Supported header tags").setHeading();

	const table = containerEl.createEl("table", { cls: "sfb-chess-settings-table" });
	const thead = table.createEl("thead");
	const headerRow = thead.createEl("tr");
	headerRow.createEl("th", { text: "Tag" });
	headerRow.createEl("th", { text: "Display" });
	headerRow.createEl("th", { text: "Notes" });

	const tbody = table.createEl("tbody");
	const rows: [string, string, string][] = [
		['[White "..."]', "Player name (left)", "Hidden if missing"],
		['[Black "..."]', "Player name (right, bold)", "Hidden if missing"],
		['[Result "..."]', "In meta line", 'Hidden if "*" or missing'],
		['[Event "..."]', "In meta line", ""],
		['[Site "..."]', "In meta line", ""],
		['[Date "YYYY.MM.DD"]', "In meta line", 'Hidden if "????.??.??"'],
		['[Round "..."]', '"Round: X" in meta', 'Hidden if "?"'],
		['[ECO "..."]', '"ECO: X" in meta', ""],
	];
	for (const [tag, display, notes] of rows) {
		const tr = tbody.createEl("tr");
		tr.createEl("td").createEl("code", { text: tag });
		tr.createEl("td", { text: display });
		tr.createEl("td", { text: notes });
	}

	const note = containerEl.createEl("p", { cls: "sfb-chess-settings-note" });
	note.textContent = "Placeholder values (?, ??, ????.??.??) are treated as missing and hidden automatically.";

	new Setting(containerEl).setName("Available parameters").setHeading();

	const optsDesc = containerEl.createDiv({ cls: "sfb-chess-settings-usage" });
	optsDesc.createEl("p", {
		text: 'Add options on the header line. Quoted values use key:"value" syntax.',
	});

	const optsTable = containerEl.createEl("table", { cls: "sfb-chess-settings-table" });
	const optsHead = optsTable.createEl("thead");
	const optsHeaderRow = optsHead.createEl("tr");
	optsHeaderRow.createEl("th", { text: "Option" });
	optsHeaderRow.createEl("th", { text: "Description" });

	const optsTbody = optsTable.createEl("tbody");
	const optRows: [string, string][] = [
		["center:true|false", "Center the board horizontally (default: true)"],
		["mode:normal|puzzle|step|drill", "Start in specified mode"],
		["color:white|black", "Side you play in drill mode"],
		["flipped:true", "Flip board to Black's perspective; puzzle quizzes Black moves"],
		["notation:san|fan", "SAN (text) or FAN (figurine piece icons) notation"],
		["pieces:name", "Override piece set for board and FAN (e.g. pieces:fantasy)"],
		["start_at:start|end|N", "Initial position: start, end, or half-move index N counted from 0 (0 is after White's first move)"],
		['title:"..."', "Display a title in the header bar"],
		['white:"..."', "Override or set White player name"],
		['black:"..."', "Override or set Black player name"],
		['event:"..."', "Override event name"],
		['site:"..."', "Override site name"],
		['date:"..."', "Override date"],
		['round:"..."', "Override round"],
		['eco:"..."', "Override ECO code"],
		['result:"..."', "Override result"],
	];
	for (const [opt, desc] of optRows) {
		const tr = optsTbody.createEl("tr");
		tr.createEl("td").createEl("code", { text: opt });
		tr.createEl("td", { text: desc });
	}

	const optsExample = optsDesc.createEl("pre");
	optsExample.createEl("code", {
		text: '```chessboard type:pgn center:true title:"Vienna Gambit" white:"Player 1" black:"Player 2"',
	});

	new Setting(containerEl).setName("Inline comments").setHeading();

	const commentDesc = containerEl.createDiv();
	commentDesc.createEl("p", {
		text: "Add comments in curly braces after any move. Comments appear inline in the move list, dimmed until you navigate to that move.",
	});
	const commentExample = commentDesc.createEl("pre");
	commentExample.createEl("code", {
		text: '1.e4 e5 {The most popular reply.} 2.Nf3 Nc6 {Defending the pawn.}',
	});
}
