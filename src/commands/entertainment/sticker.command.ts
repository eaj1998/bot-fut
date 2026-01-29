import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message, MessageMedia } from 'whatsapp-web.js';

@injectable()
export class StickerCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort
  ) { }

  async handle(message: Message): Promise<void> {
    const stickers: Record<string, string> = {
      '/joao': './assets/joao.webp',
      '/pedro': './assets/pedro.webp',
      '/tailon': './assets/tailon.webp',
      '/andrei': './assets/andrei.webp',
      '/luan': './assets/luan.webp',
    };

    if (stickers[message.body]) {
      try {
        const stickerPath = stickers[message.body];
        const sticker = MessageMedia.fromFilePath(stickerPath);
        this.server.sendMessage(message.from, sticker, { sendMediaAsSticker: true });
      } catch (error) {
        message.reply(`Desculpe, não consegui encontrar a figurinha para o comando ${message.body}`);
      }
    }
  }
}
