import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message, MessageMedia } from 'whatsapp-web.js';
import { LineUpService } from '../../services/lineup.service';

@injectable()
export class StickerCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
    @inject(LineUpService) private readonly lineupSvc: LineUpService
  ) { }

  async handle(message: Message): Promise<void> {
    const stickers: Record<string, string> = {
      '/joao': './assets/joao.webp',      
    };

    if (stickers[message.body]) {
      console.log(`[COMANDO] Figurinha "${message.body}" recebida.`);
      try {
        console.log(`[COMANDO] Figurinha :"${stickers[message.body]}".`);
        const stickerPath = stickers[message.body];
        const sticker = MessageMedia.fromFilePath(stickerPath);
        this.server.sendMessage(message.from, sticker, { sendMediaAsSticker: true });
      } catch (error) {
        message.reply(`Desculpe, não consegui encontrar a figurinha para o comando ${message.body}.`);
      }
    }
  }
}
