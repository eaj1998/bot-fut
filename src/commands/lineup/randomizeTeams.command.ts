import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { Message } from "whatsapp-web.js";
import { WorkspaceService } from "../../services/workspace.service";
import { GameRepository } from "../../core/repositories/game.respository";
import { GamePlayer } from "../../core/models/game.model";

@injectable()
export class RandomizeTeamsCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(GameRepository) private readonly gameRepo: GameRepository
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;

        if (!groupId.endsWith("@g.us")) {
            await message.reply("Este comando só pode ser usado em grupos.");
            return;
        }

        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);
        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        const game = await this.gameRepo.findActiveForChat(workspace._id, groupId);
        if (!game) {
            await message.reply("Nenhum jogo agendado encontrado para este grupo.");
            return;
        }

        const players = game.roster.players || [];
        if (players.length === 0) {
            await message.reply("Não há jogadores na lista para sortear os times.");
            return;
        }

        const goalieSlots = game.roster.goalieSlots ?? 2;
        const goalies = players.filter(p => (p.slot ?? 0) <= goalieSlots);
        const outfield = players.filter(p => (p.slot ?? 0) > goalieSlots);

        if (outfield.length < 2) {
            await message.reply("É necessário pelo menos 2 jogadores de linha para sortear os times.");
            return;
        }

        const shuffledOutfield = this.shuffle(outfield);
        const midpoint = Math.ceil(shuffledOutfield.length / 2);
        const team1Outfield = shuffledOutfield.slice(0, midpoint);
        const team2Outfield = shuffledOutfield.slice(midpoint);

        const shuffledGoalies = this.shuffle(goalies);
        const team1Goalie = shuffledGoalies[0];
        const team2Goalie = shuffledGoalies[1];

        const formattedMessage = this.formatTeams(
            team1Goalie,
            team1Outfield,
            team2Goalie,
            team2Outfield
        );

        await this.server.sendMessage(groupId, formattedMessage);
    }

    private shuffle<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    private formatTeams(
        team1Goalie: GamePlayer | undefined,
        team1Outfield: GamePlayer[],
        team2Goalie: GamePlayer | undefined,
        team2Outfield: GamePlayer[]
    ): string {
        let message = "⚽ *TIMES SORTEADOS* ⚽\n\n";

        message += "🔵 *TIME A*\n";
        if (team1Goalie) {
            message += `🧤 Goleiro: ${team1Goalie.name}\n`;
        } else {
            message += "🧤 Goleiro: _Sem goleiro_\n";
        }
        team1Outfield.forEach((player, index) => {
            message += `${index + 1}. ${player.name}\n`;
        });

        message += "\n";

        message += "🔴 *TIME B*\n";
        if (team2Goalie) {
            message += `🧤 Goleiro: ${team2Goalie.name}\n`;
        } else {
            message += "🧤 Goleiro: _Sem goleiro_\n";
        }
        team2Outfield.forEach((player, index) => {
            message += `${index + 1}. ${player.name}\n`;
        });

        return message;
    }
}
