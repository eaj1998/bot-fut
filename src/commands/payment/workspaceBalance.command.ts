import { inject, injectable } from "tsyringe";
import { Command, IRole } from "../type";
import { BOT_CLIENT_TOKEN, IBotServerPort } from "../../server/type";
import { WorkspaceService } from "../../services/workspace.service";
import { LedgerRepository } from "../../core/repositories/ledger.repository";
import { LineUpService } from "../../services/lineup.service";
import { Message } from "whatsapp-web.js";
import Utils from "../../utils/utils";
import { ChatService } from "../../services/chat.service";

@injectable()
export class WorkspaceBalanceCommand implements Command {
  role = IRole.ADMIN;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(WorkspaceService) private readonly workspaceSvc: WorkspaceService,
    @inject(LedgerRepository) private readonly ledgerRepo: LedgerRepository,
    @inject(LineUpService) private readonly lineupSvc: LineUpService,
    @inject(ChatService) private readonly chatSvc: ChatService,
  ) {}

  async handle(message: Message): Promise<void> {
    const [, ...args] = message.body.trim().split(/\s+/);
    const slug = (args[0] || "").toLowerCase();
    const chat = await message.getChat();

    if (!slug) {
      await message.reply("Informe o workspace. Ex.: */saldo viana*");
      return;
    }

    const ws = await this.workspaceSvc.resolveWorkspaceBySlug(slug);
    if (!ws) {
      await message.reply(`Workspace *${slug}* não encontrado.`);
      return;
    }    

    console.log('from: ', message.from);
    console.log('ws._id', ws._id);
    
    

    const chatBot = await this.chatSvc.findByWorkspaceAndChat(ws._id, chat.id._serialized);

    console.log('chat',chatBot);
    
    if (!chatBot) {
      await message.reply(`Este grupo não está vinculado ao workspace *${ws.slug}*.`);
      return;
    }
    const netCents = await this.ledgerRepo.sumWorkspaceCashbox(ws._id.toString());

    const receivables = await this.lineupSvc.getWorkspaceReceivablesCents(ws._id.toString());

    const linhas: string[] = [];
    linhas.push(`🏦 ${ws.name} (${ws.slug})`);
    linhas.push(`Em conta: ${Utils.formatCentsToReal(netCents)}`);

    if (receivables.totalCents > 0) {
      linhas.push(`A receber: ${Utils.formatCentsToReal(receivables.totalCents)}`);
      for (const g of receivables.games.sort((a,b)=>+new Date(b.date)-+new Date(a.date))) {
        const d = new Date(g.date);
        const data = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
        linhas.push(`— ${data} · ${g.title}: ${Utils.formatCentsToReal(g.receivableCents)}`);
      }
    } else {
      linhas.push("A receber: R$ 0,00");
    }

    this.server.sendMessage(message.from, linhas.join("\n"));
  }
}
