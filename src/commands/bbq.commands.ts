import { inject, injectable } from 'tsyringe';
import { BBQService } from '../services/bbq.service';
import { Message } from 'whatsapp-web.js';

@injectable()
export class BBQCommands {
  constructor(
    @inject('BBQService') private readonly bbqService: BBQService
  ) {}



  async handleChurrascoEntra(message: Message): Promise<void> {
    const chatId = message.from;
    const contact = await message.getContact();
    const userId = contact.id.user;
    const userName = contact.pushname || contact.name || 'Usuário';

    const result = await this.bbqService.joinBBQ(chatId, userId, userName);
    await message.reply(result.message);

    if (result.success && result.bbq) {
      const listMessage = this.bbqService.formatBBQList(result.bbq);
      await message.reply(listMessage);
    }
  }

  async handleChurrascoSai(message: Message): Promise<void> {
    const chatId = message.from;
    const contact = await message.getContact();
    const userId = contact.id.user;
    const userName = contact.pushname || contact.name || 'Usuário';

    const result = await this.bbqService.leaveBBQ(chatId, userId, userName);
    await message.reply(result.message);

    if (result.success && result.bbq) {
      const listMessage = this.bbqService.formatBBQList(result.bbq);
      await message.reply(listMessage);
    }
  }

  async handleChurrascoAddConvidado(message: Message): Promise<void> {
    const chatId = message.from;
    const contact = await message.getContact();
    const inviterId = contact.id.user;
    const inviterName = contact.pushname || contact.name || 'Usuário';

    const commandText = message.body;
    const parts = commandText.split(' ');
    
    if (parts.length < 2) {
      await message.reply('❌ Use: `/churrasco_addconvidado NomeDoConvidado`');
      return;
    }

    const guestName = parts.slice(1).join(' ');

    const result = await this.bbqService.addGuest(chatId, inviterId, inviterName, guestName);
    await message.reply(result.message);
  }

  async handleChurrascoRemoveConvidado(message: Message): Promise<void> {
    const chatId = message.from;
    const contact = await message.getContact();
    const inviterId = contact.id.user;

    const commandText = message.body;
    const parts = commandText.split(' ');
    
    if (parts.length < 2) {
      await message.reply('❌ Use: `/churrasco_removeconvidado NomeDoConvidado`');
      return;
    }

    const guestName = parts.slice(1).join(' ');

    const result = await this.bbqService.removeGuest(chatId, inviterId, guestName);
    await message.reply(result.message);
  }

  async handleChurrascoLista(message: Message): Promise<void> {
    const chatId = message.from;
    const bbq = await this.bbqService.getOrCreateTodayBBQ(chatId);
    const listMessage = this.bbqService.formatBBQList(bbq);
    await message.reply(listMessage);
  }

  async handleValorChurrasco(message: Message): Promise<void> {
    const chatId = message.from;
    const commandText = message.body;
    const parts = commandText.split(' ');
    
    if (parts.length < 2) {
      await message.reply('❌ Use: `/valor_churrasco 15` (valor em reais)');
      return;
    }

    const value = parseFloat(parts[1]);
    
    if (isNaN(value) || value <= 0) {
      await message.reply('❌ Valor inválido! Use um número maior que zero.');
      return;
    }

    const result = await this.bbqService.setBBQValue(chatId, value);
    await message.reply(result.message);
  }

  async handleChurrascoFechaLista(message: Message): Promise<void> {
    const chatId = message.from;
    const result = await this.bbqService.closeBBQ(chatId);
    await message.reply(result.message);
  }
}
