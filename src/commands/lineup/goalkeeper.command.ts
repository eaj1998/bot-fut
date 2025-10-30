import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';
import { WorkspaceService } from '../../services/workspace.service';
import { GameRepository } from '../../core/repositories/game.respository';
import { UserRepository } from '../../core/repositories/user.repository';

@injectable()
export class GoalKeeperAddCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(LineUpService) private readonly lineupSvc: LineUpService,
    @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
    @inject(GameRepository) private readonly gameRepo: GameRepository,
    @inject(UserRepository) private readonly userRepo: UserRepository
  ) { }

  async handle(message: Message): Promise<void> {
    const groupId = message.from;
    const { workspace } = await this.workspaceSvc.resolveWorkspaceFromMessage(message);

    const author = await message.getContact();

    if (!workspace) {
      await message.reply("🔗 Este grupo ainda não está vinculado a um workspace. Use /bind <slug>");
      return;
    }

    let game = await this.gameRepo.findActiveForChat(workspace._id, groupId);

    if (!game) {
      await message.reply("Nenhum jogo agendado encontrado para este grupo.");
      return;
    }
    
    const user = await this.userRepo.upsertByPhone(workspace._id, author.id._serialized, author.pushname || author.name || "Jogador");

    if (this.lineupSvc.alreadyInList(game.roster, user)) {
      await message.reply("Você já está na lista!");
      return;
    }

    this.lineupSvc.pullFromOutlist(game, user);

    const { placed } = this.lineupSvc.takeNextGoalieSlot(game, user, user.name);
    if (!placed) {
      const pos = this.lineupSvc.pushToWaitlist(game, user, user.name);
      await this.gameRepo.save(game);

      await message.reply(`🧤 Sem vaga de goleiro no momento — você foi adicionado como o ${pos}º suplente.`);
      const textoWait = await this.lineupSvc.formatList(game);
      await this.server.sendMessage(groupId, textoWait);
      return;
    }

    await this.gameRepo.save(game);

    const texto = await this.lineupSvc.formatList(game);
    await this.server.sendMessage(groupId, texto);
  }
}
