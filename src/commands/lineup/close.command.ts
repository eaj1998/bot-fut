import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { GameService } from '../../services/game.service';
import { WorkspaceService } from '../../services/workspace.service';
import { LoggerService } from '../../logger/logger.service';

@injectable()
export class CloseCommand implements Command {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(GameService) private readonly gameService: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(LoggerService) private readonly loggerService: LoggerService
    ) { }

    async handle(message: Message): Promise<void> {
        const groupId = message.from;
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        let game = await this.gameService.getActiveGame(workspace._id.toString(), groupId);

        if (!game) {
            await message.reply("Nenhum jogo agendado encontrado para este grupo.");
            return;
        }

        try {
            const result = await this.gameService.closeGameForBot(game);
            if (result.added) {
                const failedPlayers: string[] = [];

                result.results.forEach((r: any) => {
                    if (r.success) {
                        console.log(`✔ ${r.playerName} processado com sucesso`);
                    } else {
                        failedPlayers.push(r.playerName);
                    }
                });

                if (failedPlayers.length > 0) {
                    const msg = `⚠ Os seguintes jogadores falharam ao adicionar o débito:\n${failedPlayers
                        .map((name) => `- ${name}`)
                        .join('\n')}`;
                    this.server.sendMessage(game.chatId, msg);
                } else {
                    this.server.sendMessage(game.chatId, '✅ Todos os débitos foram adicionados com sucesso!');
                    return;
                }
            } else {
                this.loggerService.log('❌ Erro ao fechar o jogo.');
                await this.server.sendMessage(groupId, 'Erro inesperado ao fechar o jogo.');
                return
            }

        } catch (error) {
            this.loggerService.log('Erro inesperado ao fechar o jogo:', error);
            return;
        }
    }

}
