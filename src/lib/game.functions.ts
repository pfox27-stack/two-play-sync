import { createServerFn } from "@tanstack/react-start";
import { Chess } from "chess.js";
import type { Database } from "@/integrations/supabase/types";

type Color = "white" | "black";
type GameUpdate = Database["public"]["Tables"]["games"]["Update"];

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function randomToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function seatColor(gameId: string, token: string): Promise<Color | null> {
  const db = await admin();
  const { data } = await db.from("game_seats").select("color").eq("game_id", gameId).eq("token", token);
  return (data?.[0]?.color as Color) ?? null;
}

const str = (v: unknown, max = 200) => {
  if (typeof v !== "string" || v.length === 0 || v.length > max) throw new Error("Invalid input");
  return v;
};

export const createGame = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; color: Color | "random"; baseMin: number; incSec: number }) => ({
    name: str(d.name, 24).trim(),
    color: d.color === "black" || d.color === "white" ? d.color : "random",
    baseMin: Math.min(180, Math.max(1, Number(d.baseMin) || 5)),
    incSec: Math.min(60, Math.max(0, Number(d.incSec) || 0)),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    const color: Color = data.color === "random" ? (Math.random() < 0.5 ? "white" : "black") : data.color;
    const base = Math.round(data.baseMin * 60000);
    const { data: game, error } = await db
      .from("games")
      .insert({
        white_name: color === "white" ? data.name : null,
        black_name: color === "black" ? data.name : null,
        base_ms: base,
        increment_ms: data.incSec * 1000,
        white_time_ms: base,
        black_time_ms: base,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const token = randomToken();
    await db.from("game_seats").insert({ game_id: game.id, color, token });
    return { gameId: game.id, token, color };
  });

export const joinGame = createServerFn({ method: "POST" })
  .inputValidator((d: { gameId: string; name: string }) => ({ gameId: str(d.gameId, 64), name: str(d.name, 24).trim() }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: game } = await db.from("games").select("*").eq("id", data.gameId).single();
    if (!game) throw new Error("Game not found");
    if (game.status !== "waiting") throw new Error("This game already has two players");
    const color: Color = game.white_name ? "black" : "white";
    const token = randomToken();
    const { error } = await db.from("game_seats").insert({ game_id: game.id, color, token });
    if (error) throw new Error("Seat already taken");
    await db
      .from("games")
      .update({ [color === "white" ? "white_name" : "black_name"]: data.name, status: "active", last_move_at: new Date().toISOString() })
      .eq("id", game.id);
    return { token, color };
  });

export const getMySeat = createServerFn({ method: "POST" })
  .inputValidator((d: { gameId: string; token: string }) => ({ gameId: str(d.gameId, 64), token: str(d.token, 100) }))
  .handler(async ({ data }) => ({ color: await seatColor(data.gameId, data.token) }));

function endFields(chess: Chess) {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? "black" : "white";
    return { status: "finished", result: winner === "white" ? "1-0" : "0-1", reason: "checkmate" };
  }
  if (chess.isStalemate()) return { status: "finished", result: "1/2-1/2", reason: "stalemate" };
  if (chess.isThreefoldRepetition()) return { status: "finished", result: "1/2-1/2", reason: "threefold repetition" };
  if (chess.isInsufficientMaterial()) return { status: "finished", result: "1/2-1/2", reason: "insufficient material" };
  if (chess.isDraw()) return { status: "finished", result: "1/2-1/2", reason: "fifty-move rule" };
  return null;
}

export const makeMove = createServerFn({ method: "POST" })
  .inputValidator((d: { gameId: string; token: string; from: string; to: string; promotion?: string }) => ({
    gameId: str(d.gameId, 64),
    token: str(d.token, 100),
    from: str(d.from, 2),
    to: str(d.to, 2),
    promotion: d.promotion && "qrbn".includes(d.promotion) ? d.promotion : undefined,
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    const color = await seatColor(data.gameId, data.token);
    if (!color) throw new Error("You are not a player in this game");
    const { data: game } = await db.from("games").select("*").eq("id", data.gameId).single();
    if (!game || game.status !== "active") throw new Error("Game is not active");

    const chess = new Chess();
    const history = (game.moves as string[]) ?? [];
    for (const san of history) chess.move(san);
    if ((chess.turn() === "w" ? "white" : "black") !== color) throw new Error("Not your turn");

    const now = Date.now();
    const elapsed = game.last_move_at ? now - new Date(game.last_move_at).getTime() : 0;
    const key = color === "white" ? "white_time_ms" : "black_time_ms";
    const remaining = (game[key] as number) - elapsed;
    if (remaining <= 0) {
      await db
        .from("games")
        .update({ [key]: 0, status: "finished", result: color === "white" ? "0-1" : "1-0", reason: "timeout" })
        .eq("id", game.id);
      throw new Error("Time ran out");
    }

    let move;
    try {
      move = chess.move({ from: data.from, to: data.to, promotion: data.promotion ?? "q" });
    } catch {
      throw new Error("Illegal move");
    }
    const update: GameUpdate = {
      fen: chess.fen(),
      pgn: chess.pgn(),
      moves: [...history, move.san],
      [key]: remaining + game.increment_ms,
      last_move_at: new Date(now).toISOString(),
      draw_offer: null,
      ...(endFields(chess) ?? {}),
    };
    const { data: updated } = await db.from("games").update(update).eq("id", game.id).eq("fen", game.fen).select("id");
    if (!updated?.length) throw new Error("Position changed, try again");
    return { ok: true };
  });

export const gameAction = createServerFn({ method: "POST" })
  .inputValidator((d: { gameId: string; token?: string; action: "resign" | "offer_draw" | "accept_draw" | "decline_draw" | "flag" }) => ({
    gameId: str(d.gameId, 64),
    token: typeof d.token === "string" ? d.token : "",
    action: d.action,
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: game } = await db.from("games").select("*").eq("id", data.gameId).single();
    if (!game || game.status !== "active") return { ok: false };

    if (data.action === "flag") {
      // anyone (even spectators) may ask the server to check the clock
      const turn = game.fen.split(" ")[1] === "w" ? "white" : "black";
      const key = turn === "white" ? "white_time_ms" : "black_time_ms";
      const elapsed = game.last_move_at ? Date.now() - new Date(game.last_move_at).getTime() : 0;
      if ((game[key] as number) - elapsed <= 0) {
        const update: GameUpdate = { [key]: 0, status: "finished", result: turn === "white" ? "0-1" : "1-0", reason: "timeout" };
        await db.from("games").update(update).eq("id", game.id).eq("status", "active");
      }
      return { ok: true };
    }

    const color = await seatColor(data.gameId, data.token);
    if (!color) throw new Error("You are not a player in this game");
    const opp = color === "white" ? "black" : "white";
    if (data.action === "resign") {
      await db.from("games").update({ status: "finished", result: color === "white" ? "0-1" : "1-0", reason: "resignation" }).eq("id", game.id);
    } else if (data.action === "offer_draw") {
      await db.from("games").update({ draw_offer: color }).eq("id", game.id);
    } else if (data.action === "accept_draw" && game.draw_offer === opp) {
      await db.from("games").update({ status: "finished", result: "1/2-1/2", reason: "agreement", draw_offer: null }).eq("id", game.id);
    } else if (data.action === "decline_draw" && game.draw_offer === opp) {
      await db.from("games").update({ draw_offer: null }).eq("id", game.id);
    }
    return { ok: true };
  });
