import { GameModel } from "../models/game.model";
import { Types } from "mongoose";

export class GameRepository {
    static async setPlayerPaid(gameId: string, userId: string, paid: boolean) {
        const game = await GameModel.findById(gameId);
        if (!game) return null;
        if (!game.roster?.players) return null;

        const p = game.roster.players.find(x => x.userId?.toString() === userId);
        if (!p) return null;
        p.paid = paid;
        p.paidAt = paid ? new Date() : undefined;
        await game.save();
        return game;
    }

    static async addPlayer(gameId: string, userId: string, name: string, maxPlayers: number) {
        const game = await GameModel.findById(gameId);
        if (!game) throw new Error("game not found");
        if (!game.roster?.players) throw new Error("roster not found");

        const used = new Set(game.roster.players.map(p => p.slot));
        const limit = game.maxPlayers ?? maxPlayers;
        for (let slot = 1; slot <= limit; slot++) {
            if (!used.has(slot)) {
                game.roster.players.push({ slot, userId: new Types.ObjectId(userId), name });
                await game.save();
                return { slot, waitlist: false };
            }
        }
        game.roster.waitlist.push({ userId: new Types.ObjectId(userId), name, createdAt: new Date() });
        await game.save();
        return { waitlist: true };
    }

    static async getOrCreateTodayList(workspaceId: string) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        let game = await GameModel.findOne({ workspaceId, date: { $gte: start, $lte: end } });
        if (!game) {
            game = await GameModel.create({
                workspaceId,
                date: now,
                title: "⚽ Jogo de Hoje",
                roster: { goalieSlots: 2, players: [], waitlist: [] }
            });
        }
        
        return game;
    }

}
