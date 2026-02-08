import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message, MessageMedia } from 'whatsapp-web.js';

@injectable()
export class HelpCommand implements Command {
  role = IRole.USER;

  constructor(
    @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
  ) { }

  async handle(message: Message): Promise<void> {
    const helpText = `Você pode ver a lista de comandos em: <a href="https://fazosimplesfc.app/help" target="_blank">fazosimplesfc.app/help</a>`;

    await this.server.sendMessage(message.from, helpText);

  }
}
