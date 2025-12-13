import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { WorkspaceService } from "../../services/workspace.service";
import { GameService } from "../../services/game.service";
import { Message } from "whatsapp-web.js";
import { UserRepository } from "../../core/repositories/user.repository";
import Utils from "../../utils/utils";

@injectable()
export class DebtsCommand implements Command {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(GameService) private readonly gameSvc: GameService,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserRepository) private readonly userRepo: UserRepository,
        @inject(Utils) private util: Utils
    ) { }


    async handle(message: Message): Promise<void> {
        // if (!message.from.endsWith("@c.us")) {
        //     await message.reply("Use este comando no privado comigo. Ex.: */debitos viana*");
        //     return;
        // }

        const [, ...args] = message.body.trim().split(/\s+/);
        const slug = (args[0] || "");

        const contact = await message.getContact();
        const phone = this.util.normalizePhone(contact.id._serialized);
        const user = await this.userRepo.findByPhoneE164(phone);
        if (!user) {
            await message.reply("Seu número não está cadastrado. Peça a um admin para cadastrar.");
            return;
        }

        if (slug) {
            const workspace = await this.workspaceSvc.resolveWorkspaceBySlug(slug);
            if (!workspace) {
                await message.reply(`Workspace *${slug}* não encontrado.`);
                return;
            }
            const summary = await this.gameSvc.getDebtsSummary(workspace, user);
            const texto = this.gameSvc.formatDebtsMessage(summary);
            this.server.sendMessage(message.from, texto);
            return;
        }

        const grouped = await this.gameSvc.getUserDebtsGrouped(user._id.toString());
        const texto = this.gameSvc.formatUserDebtsDetailedMessage(grouped);
        this.server.sendMessage(message.from, texto);
    }
}