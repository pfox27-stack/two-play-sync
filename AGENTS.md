<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Chess moves/actions go through server functions in src/lib/game.functions.ts that replay moves with chess.js and use the admin client; the games table is read-only to clients (realtime SELECT) so modified clients can't cheat.
- Players are identified per game by a secret seat token (game_seats table, never exposed to clients) stored in localStorage; this lets guests rejoin after refresh without accounts.
