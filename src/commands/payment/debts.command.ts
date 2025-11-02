import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { WorkspaceService } from "../../services/workspace.service";
import { LineUpService } from "../../services/lineup.service";
import { Message } from "whatsapp-web.js";
import { UserRepository } from "../../core/repositories/user.repository";

@injectable()
export class DebtsCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(LineUpService) private readonly lineupSvc: LineUpService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository
    ) { }


    async handle(message: Message): Promise<void> {
        console.log('message from: ', message.from);
        
        if (!message.from.endsWith("@c.us")) {
            await message.reply("Use este comando no privado comigo. Ex.: */debitos viana*");
            return;
        }

        const [, ...args] = message.body.trim().split(/\s+/);
        const slug = (args[0] || "").toLowerCase();
        if (!slug) {
            await message.reply("Informe o workspace. Ex.: */debitos viana*");
            return;
        }

        const contact = await message.getContact();
        const phoneE164 = contact.number ? `${contact.number}` : undefined;
        
        if (!phoneE164) {
            await message.reply("Não consegui identificar seu telefone. Tente novamente.");
            return;
        }
        const user = await this.userRepo.findByPhoneE164(phoneE164);
        if (!user) {
            await message.reply("Seu número não está cadastrado. Peça a um admin para cadastrar.");
            return;
        }

        const workspace = await this.workspaceSvc.resolveWorkspaceBySlug(slug);
        if (!workspace) {
            await message.reply(`Workspace *${slug}* não encontrado.`);
            return;
        }

        const summary = await this.lineupSvc.getDebtsSummary(workspace, user);
        const texto = this.lineupSvc.formatDebtsMessage(summary);

        this.server.sendMessage(message.from, texto);
    }
}