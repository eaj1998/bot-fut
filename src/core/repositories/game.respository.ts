import { GAME_MODEL_TOKEN, GameDoc, GameModel, GamePlayer } from "../models/game.model";
import { Model, Types } from "mongoose";
import { UserDoc } from "../models/user.model";
import { inject, injectable } from "tsyringe";
import { ConfigService } from "../../config/config.service";
import axios from 'axios';
import { isOutfield } from "../../utils/lineup";

@injectable()
export class GameRepository {
    constructor(
        @inject(ConfigService) private readonly configService: ConfigService,
        @inject(GAME_MODEL_TOKEN) private readonly model: Model<GameDoc> = GameModel
    ) { }



    async findById(id: Types.ObjectId) {
        return this.model.findOne(id)
    }

    async findActiveForChat(workspaceId: Types.ObjectId, chatId: string) {
        return this.model.findOne({
            workspaceId,
            chatId,
            status: "open",
        });
    }

    async findWaitingPaymentForChatByDate(workspaceId: Types.ObjectId, day: { start: Date; end: Date }) {

        return this.model.findOne({
            workspaceId,
            date: { $gte: day.start, $lte: day.end },
            status: "closed",
        }).exec();
    }

    async findGameClosedOrFinishedByDate(workspaceId: Types.ObjectId, day: { start: Date; end: Date }) {
        return this.model.findOne({
            workspaceId,
            date: { $gte: day.start, $lte: day.end },
            status: { $in: ["closed", "finished"] }
        }).exec();
    }

    async findWaitingPaymentForChat(workspaceId: Types.ObjectId, chatId: string) {
        return this.model.findOne({
            workspaceId,
            chatId,
            status: "closed",
        });
    }

    async save(game: GameDoc) {
        return game.save();
    }
    async criarMovimentacaoOrganizze(player: GamePlayer, dataDoJogo: Date): Promise<{ added: boolean }> {
        if (!this.configService.organizze.email || !this.configService.organizze.apiKey) {
            console.log('[ORGANIZZE] Credenciais não configuradas. Pulando integração.');
            return { added: false };
        }

        const hoje = new Date();
        const dataPagamento = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        const dataJogoFormatada = `${String(dataDoJogo.getDate()).padStart(2, '0')}/${String(dataDoJogo.getMonth() + 1).padStart(2, '0')}`;

        const payload = {
            description: `${player.name} - Jogo ${dataJogoFormatada}`,
            amount_cents: this.configService.organizze.valorJogo,
            date: dataPagamento,
            account_id: 9099386,
            category_id: 152977750,
            paid: false,
        };

        try {
            const res = await axios.post('https://api.organizze.com.br/rest/v2/transactions', payload, {
                auth: {
                    username: this.configService.organizze.email,
                    password: this.configService.organizze.apiKey,
                },
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BotFutebol (edipo1998@gmail.com)',
                },
            });

            if (res.status === 201) {
                player.organizzeId = res.data.id;
                return { added: true };
            }
        } catch (error: any) {
            console.error(
                error.response ? error.response.data : error.message
            );
            return { added: false };
        }

        return { added: false };
    }

    async setPlayerPaid(game: GameDoc, playerNumber: number, paid: boolean) {
        if (!game) return { updated: false, PlayerName: "" };
        if (!game.roster?.players) return { updated: false, PlayerName: "" };

        const player = game.roster.players.find(p => p.slot === playerNumber);
        if (!player) return { updated: false, PlayerName: "" };
        player.paid = paid;
        player.paidAt = paid ? new Date() : undefined;
        await game.save();
        return { updated: true, PlayerName: player.name };
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

    async findUnpaidGamesForUser(workspaceId: Types.ObjectId, userId: Types.ObjectId, limit = 20) {
        const games = await GameModel.find({
            workspaceId,
            "roster.players": { $exists: true, $ne: [] },
        })
            .sort({ date: -1 })
            .limit(limit)
            .lean();

        return games.filter((g) => {
            const goalieSlots = Math.max(0, g.roster?.goalieSlots ?? 2);
            const players: GamePlayer[] = g.roster?.players ?? [];

            const ownUnpaid = players.some(p =>
                String(p.userId) === String(userId) &&
                isOutfield(p, goalieSlots) &&
                !p.paid
            );

            const guestUnpaid = players.some(p =>
                p.guest === true &&
                String(p.invitedByUserId) === String(userId) &&
                !p.paid
            );

            return ownUnpaid || guestUnpaid;
        });
    }
}
