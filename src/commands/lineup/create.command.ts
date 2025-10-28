import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpRepository } from '../../repository/lineup.repository';
import { ConfigService } from '../../config/config.service';
import { LineUpService } from '../../services/lineup.service';
import Utils from "../../utils/utils";
import { resolveWorkspaceFromMessage } from "../../utils/workspace.utils";

@injectable()
export class LineUpCreateCommand implements Command {
  role = IRole.ADMIN;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(ConfigService) private readonly configService: ConfigService,
    @inject(LineUpRepository) private readonly lineUpRepo: LineUpRepository,
    @inject(LineUpService) private readonly lineupSvc: LineUpService
  ) { }

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
    const { workspace } = await resolveWorkspaceFromMessage(message);

    if (!workspace) {
      await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
      return;
    }

    const { game, priceCents, pix } = await this.lineupSvc.initListForChat(workspace, message.from);

    const texto = this.lineupSvc.formatList(game, {
      valor: Utils.formatCentsToReal(priceCents),
      pix: pix ?? (workspace.settings?.pix || "fcjogasimples@gmail.com"),
      titulo: workspace.settings?.title ?? "⚽ CAMPO DO VIANA",
    });

    await this.server.sendMessage(groupId, texto);
  }
}
