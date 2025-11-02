import { GamePlayer } from "../core/models/game.model";

export function parseGuestArg(raw: string): { name: string; asGoalie: boolean } {
    const glove = "🧤";
    const trimmed = (raw ?? "").trim();
    const asGoalie = trimmed.startsWith(glove) || trimmed.includes(` ${glove}`) || trimmed.includes(`${glove} `);
    const name = trimmed.replace(new RegExp(`[${glove}]`, "g"), "").trim().replace(/^\-+\s*/, "");
    return { name, asGoalie };
}

export function isOutfield(p: GamePlayer, goalieSlots = 2){
    return (p.slot ?? 0) > Math.max(0, goalieSlots ?? 2);
}