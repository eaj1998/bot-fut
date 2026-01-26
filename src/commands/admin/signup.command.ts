import { injectable, inject } from "tsyringe";
import { Message } from "whatsapp-web.js";
import { IBotServerPort, BOT_CLIENT_TOKEN } from "../../server/type";
import { IRole } from "../type";
import { WorkspaceService } from "../../services/workspace.service";
import { UserService } from "../../services/user.service";

@injectable()
export class ScheduleCommand {
    role = IRole.ADMIN;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
        @inject(UserService) private readonly userService: UserService,
    ) { }

    async handle(message: Message) {

        const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

        if (!workspace) {
            await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
            return;
        }

        const user = await this.userService.resolveUserFromMessage(message, workspace._id);

        if (!user) {
            await message.reply("NÃO FOI POSSÍVEL CRIAR O USUÁRIO");
            return;
        }

        await message.reply("USUÁRIO CRIADO COM SUCESSO");
    }
}
