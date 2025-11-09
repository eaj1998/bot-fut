import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { GameDoc } from '../../core/models/game.model';
import { WorkspaceService } from '../../services/workspace.service';
import { UserRepository } from '../../core/repositories/user.repository';
import { LoggerService } from '../../logger/logger.service';

@injectable()
export class GiveUpCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService,
        @inject(LoggerService) private readonly loggerSvc: LoggerService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository
    ) { }

    async handle(message: Message): Promise<void> {
        let nomeAutor = ""
        const author = await message.getContact();
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

        const user = await this.userRepo.upsertByPhone(author.id._serialized, author.pushname || author.name || "Jogador");
        this.loggerSvc.log(`user: ${user}`);
        
        const res = await this.lineupSvc.giveUpFromList(game, user, nomeAutor);
        if (!res.removed) {
            await this.server.sendMessage(message.from, res.message);
            return;
        }

        this.server.sendMessage(message.from, res.message, { mentions: res.mentions })
    }
}