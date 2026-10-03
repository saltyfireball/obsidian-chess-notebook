# Chess Notebook

Interactive chessboards in your notes, from FEN and PGN code blocks. Step through games, read inline comments and annotations, quiz yourself in puzzle mode, and keep games in their own `.pgn` files.

![The Opera Game, Morphy's 1858 win, with its header, annotated move list, a variation and the board controls](docs/media/hero.png)

## Quick start

Create a `chessboard` code block and say what it holds with `type:fen` or `type:pgn`.

A position:

````markdown
```chessboard type:fen
rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1
```
````

A game:

````markdown
```chessboard type:pgn
[Event "My Game"]
[White "Player 1"]
[Black "Player 2"]

1.e4 e5 {The most popular reply.} 2.Nf3 Nc6 {Defending the pawn.} *
```
````

Or copy a FEN or PGN and run **Paste a chess position or game as a board** from the command palette: it inserts a new block with the right `type:` at the cursor.

## Features

### Games with comments, variations and annotations

Paste a PGN and get a board with a header (players, event, site, date, ECO, result) and a move list. `{comments}` show inline, dimmed until you reach that move, and `**bold**` inside a comment is shown bold. Variations in `( ... )` show under the move they branch from. Annotation symbols (`!`, `?`, `!?`, `$1`, `+-` and the Unicode forms) are shown as symbols; hover one to see what it means.

![A Giuoco Piano with inline comments, a variation and annotation glyphs](docs/media/annotations.png)

````markdown
```chessboard type:pgn title:"Italian Game" start_at:4
[White "Player 1"]
[Black "Player 2"]
[ECO "C53"]

1.e4 e5 {The most popular reply.} 2.Nf3 Nc6 3.Bc4 Bc5 {The **Giuoco Piano**, the quiet game.}
(3...Nf6 {The Two Knights Defence.} 4.Ng5 $5 d5 5.exd5 Na5)
4.c3 $1 {Preparing d4.} Nf6 5.d4 exd4 6.cxd4 Bb4+ 7.Bd2 Bxd2+ 8.Nbxd2 d5! $14 *
```
````

A `[FEN "..."]` tag starts the game from that position instead of the opening position.

### Positions from FEN

One FEN line shows one position. A board-only FEN, as printed in books (`r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR`), works too.

<img src="docs/media/fen.png" width="420" alt="A single position from a FEN line">

````markdown
```chessboard type:fen
r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4
```
````

### FEN sequences

Several FEN lines in one block become a sequence you step through like a game, one position per line.

<img src="docs/media/fen-sequence.gif" width="360" alt="Stepping through Scholar's mate one FEN at a time">

````markdown
```chessboard type:fen title:"Scholar's mate"
rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1
rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2
r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4
```
````

### Puzzle mode

Puzzle mode hides the moves. Play the next move on the board; picking up a piece puts a dot on each square it can move to (a ring on a piece it can take). A right move is played and the reply is made for you, a wrong one is undone. Each press of Hint shows a little more: the comment on the move to find (when it has one), then the piece to move, then the move as an arrow. With `flipped:true` the board is shown from Black's side and you play Black's moves.

![Solving the finish of the Opera Game with the help of a hint](docs/media/puzzle.gif)

````markdown
```chessboard type:pgn mode:puzzle title:"Find Morphy's finish"
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[FEN "3rkb1r/p2nqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR3R w k - 3 13"]
[SetUp "1"]

13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0
```
````

You can also switch any board into puzzle mode with the puzzle button under it.

### Drill mode

Drill mode is for practising an opening. With `mode:drill color:white` (or `color:black`) you play your side and the board plays the other, picking its replies from the main line and the variations, so each run can go down a different line. A move the PGN does not have is shown as a red arrow and undone. Where the PGN gives more than one move for your side, any of them is accepted and the line the run follows is shown under the board. Hint works as in puzzle mode, the reset button starts a new run, and when the line runs out you get the same report as a puzzle, with the moves list shown again. Nothing is written back to the note.

````markdown
```chessboard type:pgn mode:drill color:white title:"Italian or Ruy Lopez"
1.e4 e5 2.Nf3 Nc6 3.Bc4 (3.Bb5 a6 4.Ba4) Bc5 (3...Nf6 4.Ng5) 4.c3 *
```
````

### Step mode and the keyboard

Step mode hides the moves you have not reached yet, so the game unfolds as you step forward, comments included. Turn it on with `mode:step` or the step button.

With the board focused: Left and Right arrows step through moves, Home and End jump to the start and end, and F flips the board.

![Stepping through the Italian Game one move at a time, with the moves and comments appearing as they are reached](docs/media/step-mode.gif)

````markdown
```chessboard type:pgn mode:step title:"Italian Game"
1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4 *
```
````

### Auto-play

The play button plays the game through at the speed set in the settings. Press it again to pause.

![The Opera Game playing itself from the start](docs/media/autoplay.gif)

````markdown
```chessboard type:pgn start_at:start
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]

1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 ...
```
````

### Games in their own files

`src:` reads a `.pgn` or `.fen` file from your vault, and the board updates when the file changes. `.pgn` and `.fen` files also open in Obsidian's editor, so you can keep a game in its own file, edit it on one side and watch the board follow on the other.

![Typing moves into Opera Game.pgn while a note showing that file updates its board](docs/media/game-file.gif)

````markdown
```chessboard type:pgn start_at:end src:"Games/Opera Game.pgn"
```
````

### chess, pgn and fen blocks

Notes written for other tools can work without edits: `pgn`, `fen` and `chess` code blocks can render too. These are off by default; turn each one on under Code blocks in the plugin's settings (Render chess blocks, Render pgn blocks, Render fen blocks), then reload Obsidian. A `pgn` block is a `chessboard type:pgn` block and a `fen` block is a `chessboard type:fen` block. A `chess` block holds either: text with `[Tags]` or move numbers is a PGN, anything else a FEN. All the options work on these blocks as well.

<img src="docs/media/pgn-block.png" width="420" alt="A pgn code block rendered as a board">

````markdown
```pgn title:"Scholar's Mate"
1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7# 1-0
```
````

Only one plugin can render a code block name: when another plugin also renders `pgn`, `fen` or `chess` blocks, whichever loads first keeps them and the other skips that name. Leave a name off when something else in your vault already renders it. Obsidian reads code block names when it loads, so reload it after changing one.

### Eight piece sets and figurine notation

Pick a default piece set in the settings, or set one per block with `pieces:name`: `standard` (default), `celtic`, `fantasy`, `firi`, `kiwen-suwi`, `rhosgfx`, `shapes`, `spatial`.

![The same position in all eight piece sets](docs/media/piece-sets.png)

`notation:fan` shows the move list with piece icons from the same set instead of letters.

![A move list in figurine notation with the fantasy piece set](docs/media/fan-notation.png)

````markdown
```chessboard type:pgn notation:fan pieces:fantasy
1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 *
```
````

### Light and dark themes

Boards follow Obsidian's theme.

![The Opera Game in the light theme](docs/media/light-theme.png)

### Settings

The settings tab has a How to use page, a quick reference for blocks, header tags and options. It also has:

- **Board size**: the default board width, small, medium or large. Override it per block with `size:`.
- **Auto-play speed**: time between moves during auto-play.
- **Piece set**: the default set for boards and figurine notation. Override it per block with `pieces:name`.
- **Render chess / pgn / fen blocks**: which of the extra code block names render as boards (all off by default). Reload Obsidian after changing one.

<img src="docs/media/settings.png" width="420" alt="The settings tab with its How to use page, auto-play speed and piece set">
<img src="docs/media/settings-how-to-use.png" width="420" alt="The How to use page with example blocks, the header tags table and the options">

## Options

Add options on the fence line. Quoted values use `key:"value"`.

````markdown
```chessboard type:pgn title:"Vienna Gambit" mode:puzzle flipped:true
````

| Option | Description |
| --- | --- |
| `center:true\|false` | Center the board horizontally (default: true) |
| `mode:normal\|puzzle\|step\|drill` | Start in the given mode |
| `color:white\|black` | The side you play in drill mode (default: White, or Black with `flipped:true`) |
| `flipped:true` | Show the board from Black's side; puzzle mode then quizzes Black's moves |
| `notation:san\|fan` | Text moves (SAN) or figurine piece icons (FAN) |
| `pieces:name` | Piece set for this block |
| `size:small\|medium\|large\|N` | Board width: `small` (300px), `medium` (420px), `large` (560px), or `N` pixels, e.g. `size:360` (default: the Board size setting) |
| `start_at:start\|end\|N` | Initial position: the start, the end, or index N (see below) |
| `src:path` | Read the FEN or PGN from a file in the vault, e.g. `src:"Games/Opera Game.pgn"` |
| `title:"..."` | Title in the header bar |
| `white:"..."`, `black:"..."` | Set or override the player names |
| `event:"..."`, `site:"..."`, `date:"..."`, `round:"..."`, `eco:"..."`, `result:"..."` | Set or override the game details |

`start_at:N` counts from zero. In a PGN it counts half-moves (single moves by either side): `start_at:0` shows the position after White's first move, `start_at:1` after Black's reply, and `start_at:4` after White's third move. In a FEN sequence, `start_at:0` is the first FEN line, `start_at:1` the second, and so on. For a game from the starting position, N is 2M-2 to open after White's move M and 2M-1 after Black's move M (after 6...Nf6 is `start_at:11`). A number past the end shows the last position.

Header tags White, Black, Result, Event, Site, Date, Round and ECO show in the header. Placeholder values (`?`, `??`, `????.??.??`) are hidden.

## Controls

Under the board: puzzle mode, step mode, hint, reset, flip, auto-play, first/previous/next/last move, copy FEN (the position on the board) and copy PGN. FEN sequences have copy FEN too.

## Installation

From Community plugins in Obsidian's settings, once it is listed. Until then, copy `main.js`, `manifest.json` and `styles.css` from the latest release into `.obsidian/plugins/chess-notebook/` in your vault and enable the plugin.

## Development

```sh
npm ci
npm test
npm run build
```

The images and GIFs in `docs/media/` are taken in the real Obsidian app by the showcase runner, a separate repo checked out next to this one as `../obsidian-plugin-showcase`. This plugin's scenes are in its `plugins/chess-notebook/scenes.mjs`. Run `npm run build` here first so `main.js` is current, then from the showcase folder:

```sh
NODE_PATH=$(npm root -g) node src/run.mjs plugins/chess-notebook/scenes.mjs [scene ...] --out ../obsidian-chess-notebook/docs/media
```

It opens Obsidian from /Applications against a throwaway vault and profile, so your own vaults and settings are not touched. It needs Playwright (installed globally, found through `NODE_PATH`) and ffmpeg for the GIFs. `--smoke` instead only checks that the plugin loads and renders a board.

## License

MIT, see [LICENSE](LICENSE). The bundled libraries and piece sets keep their own licenses; see [NOTICE](NOTICE).
