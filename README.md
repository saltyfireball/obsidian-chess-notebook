# Chess Notebook

Interactive chessboards in your notes, from FEN and PGN code blocks. Step through games, read inline comments and annotations, quiz yourself in puzzle mode, and keep games in their own `.pgn` files.

## Usage

Create a `chessboard` code block and say what it holds with `type:fen` or `type:pgn`.

A position:

````markdown
```chessboard type:fen
rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1
```
````

A board-only FEN, as printed in books, works too. Several FEN lines in one block become a sequence you can step through.

A game:

````markdown
```chessboard type:pgn
[Event "My Game"]
[White "Player 1"]
[Black "Player 2"]

1.e4 e5 {The most popular reply.} 2.Nf3 Nc6 {Defending the pawn.} *
```
````

### Options

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
| `pieces:name` | Piece set for this block (see below) |
| `start_at:start\|end\|N` | Initial position: start, end, or a move number |
| `src:path` | Read the FEN or PGN from a file in the vault, e.g. `src:"Games/Opera Game.pgn"` |
| `title:"..."` | Title in the header bar |
| `white:"..."`, `black:"..."` | Set or override the player names |
| `event:"..."`, `site:"..."`, `date:"..."`, `round:"..."`, `eco:"..."`, `result:"..."` | Set or override the game details |

### PGN support

- Header tags: White, Black, Result, Event, Site, Date, Round and ECO show in the header. Placeholder values (`?`, `??`, `????.??.??`) are hidden.
- `{comments}` after a move show inline in the move list, dimmed until you reach that move. `**bold**` inside a comment is shown bold.
- Variations in `( ... )`, annotation symbols (`!`, `?`, `!?`, `$1`, `+-`, and the Unicode forms), and a `[FEN "..."]` starting position.

### Controls

Under the board: puzzle mode, step mode, hint, reset, flip, auto-play, first/previous/next/last move, and copy PGN.

With the board focused: Left and Right arrows step through moves, Home and End jump to the start and end, and F flips the board.

- **Puzzle mode**: hides the moves; play the next move on the board and the reply is made for you. Hint highlights the piece, then the square.
- **Step mode**: hides the moves you have not reached yet, so the game unfolds as you step forward.

### Game files

`src:` reads a `.pgn` or `.fen` file, and the board updates when the file changes. `.pgn` and `.fen` files also open in the editor, so you can edit a game next to the board that shows it.

## Settings

- **Auto-play speed**: time between moves during auto-play.
- **Piece set**: the default set for boards and figurine notation. Override it per block with `pieces:name`.

Piece sets: `standard` (default), `celtic`, `fantasy`, `firi`, `kiwen-suwi`, `rhosgfx`, `shapes`, `spatial`.

## Installation

From Community plugins in Obsidian's settings, once it is listed. Until then, copy `main.js`, `manifest.json` and `styles.css` from the latest release into `.obsidian/plugins/chess-notebook/` in your vault and enable the plugin.

## Development

```sh
npm ci
npm test
npm run build
```

## License

MIT, see [LICENSE](LICENSE). The bundled libraries and piece sets keep their own licenses; see [NOTICE](NOTICE).
