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

Puzzle mode hides the moves. Play the next move on the board; a right move is played and the reply is made for you, a wrong one is undone. Hint highlights the piece to move, then the square it goes to. With `flipped:true` the board is shown from Black's side and you play Black's moves.

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

The settings tab has a quick reference for blocks, header tags and options, plus:

- **Auto-play speed**: time between moves during auto-play.
- **Piece set**: the default set for boards and figurine notation. Override it per block with `pieces:name`.

<img src="docs/media/settings.png" width="420" alt="The settings tab with its How to use page, auto-play speed and piece set">

## Options

Add options on the fence line. Quoted values use `key:"value"`.

````markdown
```chessboard type:pgn title:"Vienna Gambit" mode:puzzle flipped:true
````

| Option | Description |
| --- | --- |
| `center:true\|false` | Center the board horizontally (default: true) |
| `mode:normal\|puzzle\|step` | Start in the given mode |
| `flipped:true` | Show the board from Black's side; puzzle mode then quizzes Black's moves |
| `notation:san\|fan` | Text moves (SAN) or figurine piece icons (FAN) |
| `pieces:name` | Piece set for this block |
| `start_at:start\|end\|N` | Initial position: the start, the end, or index N (see below) |
| `src:path` | Read the FEN or PGN from a file in the vault, e.g. `src:"Games/Opera Game.pgn"` |
| `title:"..."` | Title in the header bar |
| `white:"..."`, `black:"..."` | Set or override the player names |
| `event:"..."`, `site:"..."`, `date:"..."`, `round:"..."`, `eco:"..."`, `result:"..."` | Set or override the game details |

`start_at:N` counts from zero. In a PGN it counts half-moves (single moves by either side): `start_at:0` shows the position after White's first move, `start_at:1` after Black's reply, and `start_at:4` after White's third move. In a FEN sequence, `start_at:0` is the first FEN line, `start_at:1` the second, and so on.

Header tags White, Black, Result, Event, Site, Date, Round and ECO show in the header. Placeholder values (`?`, `??`, `????.??.??`) are hidden.

## Controls

Under the board: puzzle mode, step mode, hint, reset, flip, auto-play, first/previous/next/last move, and copy PGN.

## Installation

From Community plugins in Obsidian's settings, once it is listed. Until then, copy `main.js`, `manifest.json` and `styles.css` from the latest release into `.obsidian/plugins/chess-notebook/` in your vault and enable the plugin.

## Development

```sh
npm ci
npm test
npm run build
```

The README images are made by `tools/readme-media/`, which runs the plugin in a browser page with a small Obsidian stub:

```sh
node tools/readme-media/build.mjs
node tools/readme-media/capture.mjs [scene ...]
```

It needs Playwright with Chromium, and ffmpeg for the GIFs.

## License

MIT, see [LICENSE](LICENSE). The bundled libraries and piece sets keep their own licenses; see [NOTICE](NOTICE).
