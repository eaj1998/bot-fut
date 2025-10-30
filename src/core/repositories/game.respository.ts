import { GameDoc, GameModel } from "../models/game.model";
import { Model, Types } from "mongoose";
import { UserDoc } from "../models/user.model";

export class GameRepository {
    constructor(private readonly model: Model<GameDoc> = GameModel) { }

    async findActiveForChat(workspaceId: Types.ObjectId, chatId: string) {
        return this.model.findOne({
            workspaceId,
            chatId,
            status: "aberta",
        });
    }

    async save(game: GameDoc) {
        return game.save();
    }

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


    async addOutfieldPlayer(
        game: GameDoc,
        user: UserDoc,
        maxPlayers = 16
    ): Promise<{ added: boolean; suplentePos?: number }> {
        game.roster.players = game.roster.players ?? [];
        game.roster.waitlist = game.roster.waitlist ?? [];

        const firstOutfieldSlot = Math.max(1, (game.roster.goalieSlots ?? 2) + 1);

        const used = new Set<number>(
            game.roster.players
                .map(p => p.slot)
                .filter((s): s is number => typeof s === 'number')
        );

        for (let slot = firstOutfieldSlot; slot <= maxPlayers; slot++) {
            if (!used.has(slot)) {
                game.roster.players.push({ userId: user._id, slot, name: user.name, paid: false });
                game.save();
                return { added: true };
            }
        }

        game.roster.waitlist.push({ userId: user._id, name: user.name, createdAt: new Date() });
        game.save();
        return { added: false, suplentePos: game.roster.waitlist.length };
    }
}
