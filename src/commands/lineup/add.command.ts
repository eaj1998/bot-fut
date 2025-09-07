import { inject, injectable } from 'tsyringe';
import { Command } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message } from 'whatsapp-web.js';

@injectable()
export class LineUpAddCommand implements Command {
  constructor(@inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort) {}

  async handle(message: Message): Promise<void> {
    this.server.sendMessage(message.from, 'LineUpAddCommand Called');
    message.reply(
      'Nenhuma lista de jogo ativa no momento. Aguarde um admin enviar com o comando /lista.'
    );
    console.log('LineUpAddCommand Called');
  }
}
