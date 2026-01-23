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
                const results = result.results as any[];

                const successCount = results.filter(r => r.success).length;
                const memberCount = results.filter(r => r.success && r.isMember).length;
                const billedCount = results.filter(r => r.success && !r.isMember).length;
                const failedPlayers = results.filter(r => !r.success);

                let msg = `✅ *Jogo fechado com sucesso!*\n\n`;
                msg += `📊 *Resumo:*\n`;
                msg += `- Total Processado: ${results.length}\n`;
                msg += `- Cobranças Geradas: ${billedCount}\n`;
                msg += `- Mensalistas (Isentos): ${memberCount}\n`;

                if (failedPlayers.length > 0) {
                    msg += `\n⚠ *Falhas (${failedPlayers.length}):*\n`;
                    failedPlayers.forEach(p => {
                        msg += `- ${p.playerName}: ${p.error || 'Erro desconhecido'}\n`;
                    });
                } else {
                    msg += `\n✨ Todos os jogadores processados corretamente!`;
                }

                await this.server.sendMessage(game.chatId, msg);
                return;
            } else {
                this.loggerService.log('❌ Erro ao fechar o jogo.');
                await this.server.sendMessage(groupId, 'Erro inesperado ao fechar o jogo.');
                return;
            }

        } catch (error) {
            this.loggerService.log('Erro inesperado ao fechar o jogo:', error);
            return;
        }
    }

}
