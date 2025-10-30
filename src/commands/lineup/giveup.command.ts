import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { GameDoc } from '../../core/models/game.model';
import { WorkspaceService } from '../../services/workspace.service';

@injectable()
export class GiveUpCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(LineUpService) private readonly lineupSvc: LineUpService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService
    ) { }

    async handle(message: Message): Promise<void> {
        let nomeAutor = await this.lineupSvc.getAuthorName(message);
        const nomeConvidado = this.lineupSvc.argsFromMessage(message).join(" ").trim();
        if (nomeConvidado) nomeAutor = nomeConvidado;

        const groupId = message.from;
        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);
        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        const game = await this.lineupSvc.getActiveListOrWarn(
            workspace._id.toString(),
            groupId,
            (txt: string) => message.reply(txt)
        ) as GameDoc | null;
        if (!game) return;

        if (!this.lineupSvc.giveUpFromList(workspace, game, nomeAutor, (txt: string) => message.reply(txt))) {
            await message.reply("Seu nome não foi encontrado na lista.");
        }
    }
}