import { inject, injectable } from 'tsyringe';
import { BBQ_REPOSITORY_TOKEN, BBQRepository } from '../core/repositories/bbq.repository';
import { IBBQ, IBBQParticipant } from '../core/models/bbq.model';
import { LEDGER_REPOSITORY_TOKEN, LedgerRepository } from '../core/repositories/ledger.repository';

@injectable()
export class BBQService {
  constructor(
    @inject(BBQ_REPOSITORY_TOKEN) private readonly bbqRepository: BBQRepository,
    @inject(LEDGER_REPOSITORY_TOKEN) private readonly ledgerRepository: LedgerRepository,
  ) { }

  async getOrCreateTodayBBQ(workspaceId: string, chatId: string): Promise<IBBQ> {
    let bbq = await this.bbqRepository.findTodayBBQ(workspaceId, chatId);

    if (!bbq) {
      bbq = await this.bbqRepository.create(workspaceId, chatId);
    }

    return bbq;
  }

  async joinBBQ(workspaceId: string, chatId: string, userId: string, userName: string): Promise<{ success: boolean; message: string; bbq?: IBBQ }> {
    const bbq = await this.getOrCreateTodayBBQ(workspaceId,chatId);

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    const alreadyIn = bbq.participants.some(p => p.userId === userId);
    if (alreadyIn) {
      return { success: false, message: '⚠️ Você já está na lista do churrasco!' };
    }

    const participant: IBBQParticipant = {
      userId,
      userName,
      invitedBy: null
    };

    const updatedBBQ = await this.bbqRepository.addParticipant(bbq._id.toString(), participant);

    return {
      success: true,
      message: `🍖 *${userName}* entrou no churrasco!`,
      bbq: updatedBBQ || undefined
    };
  }

  async leaveBBQ(chatId: string, userId: string, userName: string): Promise<{ success: boolean; message: string; bbq?: IBBQ }> {
    const bbq = await this.bbqRepository.findTodayBBQ(chatId);

    if (!bbq) {
      return { success: false, message: '❌ Não existe lista de churrasco hoje.' };
    }

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    const updatedBBQ = await this.bbqRepository.removeParticipant(bbq._id.toString(), userId);

    return {
      success: true,
      message: `👋 *${userName}* saiu do churrasco.`,
      bbq: updatedBBQ || undefined
    };
  }

  async addGuest(chatId: string, inviterId: string, inviterName: string, guestName: string): Promise<{ success: boolean; message: string }> {
    const bbq = await this.getOrCreateTodayBBQ(chatId);

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    const guest: IBBQParticipant = {
      userId: `guest_${Date.now()}`,
      userName: guestName,
      invitedBy: inviterId
    };

    await this.bbqRepository.addParticipant(bbq._id.toString(), guest);

    return {
      success: true,
      message: `🍖 *${inviterName}* adicionou *${guestName}* como convidado do churrasco!`
    };
  }

  async removeGuest(chatId: string, inviterId: string, guestName: string): Promise<{ success: boolean; message: string }> {
    const bbq = await this.bbqRepository.findTodayBBQ(chatId);

    if (!bbq) {
      return { success: false, message: '❌ Não existe lista de churrasco hoje.' };
    }

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    const guest = bbq.participants.find(p => p.userName === guestName && p.invitedBy === inviterId);

    if (!guest) {
      return { success: false, message: `❌ Convidado *${guestName}* não encontrado na sua lista.` };
    }

    await this.bbqRepository.removeParticipant(bbq._id.toString(), guest.userId);

    return {
      success: true,
      message: `👋 Convidado *${guestName}* foi removido do churrasco.`
    };
  }

  async setBBQValue(chatId: string, value: number): Promise<{ success: boolean; message: string }> {
    const bbq = await this.bbqRepository.findTodayBBQ(chatId);

    if (!bbq) {
      return { success: false, message: '❌ Não existe lista de churrasco hoje.' };
    }

    await this.bbqRepository.setValue(bbq._id.toString(), value);

    return {
      success: true,
      message: `💰 Valor do churrasco definido: *R$ ${value.toFixed(2)}* por pessoa.`
    };
  }

  async closeBBQ(workspaceId: string, chatId: string): Promise<{ success: boolean; message: string }> {
    const bbq = await this.bbqRepository.findTodayBBQ(chatId);

    if (!bbq) {
      return { success: false, message: '❌ Não existe lista de churrasco hoje.' };
    }

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    if (!bbq.valuePerPerson) {
      return { success: false, message: '❌ Defina o valor do churrasco antes de fechar a lista! Use `/valor_churrasco X`' };
    }

    if (bbq.participants.length === 0) {
      return { success: false, message: '❌ Não há participantes no churrasco!' };
    }

    const debtsMap = new Map<string, { userId: string; userName: string; count: number }>();

    for (const participant of bbq.participants) {
      const debtor = participant.invitedBy || participant.userId;
      const debtorName = participant.invitedBy
        ? bbq.participants.find(p => p.userId === participant.invitedBy)?.userName || 'Desconhecido'
        : participant.userName;

      if (debtsMap.has(debtor)) {
        debtsMap.get(debtor)!.count += 1;
      } else {
        debtsMap.set(debtor, { userId: debtor, userName: debtorName, count: 1 });
      }
    }

    for (const [_, debt] of debtsMap) {
      const totalAmount = bbq.valuePerPerson * debt.count;

      await this.ledgerRepository.addDebit({
        workspaceId: workspaceId,
        userId: debt.userId,
        amountCents: totalAmount * 100,
        
        note: `Debito de churrasco - ${bbq.date.toISOString().split('T')[0]} - ${debt.userName}`,
        category: "churrasco",
        status: "pendente"
      });
    }

    await this.bbqRepository.close(bbq._id.toString());

    const totalParticipants = bbq.participants.length;
    const totalValue = bbq.valuePerPerson * totalParticipants;

    return {
      success: true,
      message: `✅ *Lista de churrasco fechada!*\n\n` +
        `👥 Total de participantes: *${totalParticipants}*\n` +
        `💰 Valor por pessoa: *R$ ${bbq.valuePerPerson.toFixed(2)}*\n` +
        `💵 Total arrecadado: *R$ ${totalValue.toFixed(2)}*\n\n` +
        `Os débitos foram gerados! 🎯`
    };
  }

  formatBBQList(bbq: IBBQ): string {
    if (!bbq || bbq.participants.length === 0) {
      return '🍖 *CHURRASCO*\n\nNinguém confirmou ainda. Seja o primeiro! 🔥';
    }

    let message = `🍖 *CHURRASCO*\n`;
    message += `Status: ${bbq.status === 'open' ? '🟢 ABERTO' : '🔴 FECHADO'}\n`;

    if (bbq.valuePerPerson) {
      message += `💰 Valor: R$ ${bbq.valuePerPerson.toFixed(2)}\n`;
    }

    message += `\n👥 *Participantes (${bbq.participants.length})*:\n\n`;

    const directParticipants = bbq.participants.filter(p => !p.invitedBy);
    const guests = bbq.participants.filter(p => p.invitedBy);

    directParticipants.forEach((p, idx) => {
      message += `${idx + 1}. ${p.userName}\n`;

      const myGuests = guests.filter(g => g.invitedBy === p.userId);
      myGuests.forEach(g => {
        message += `   └ 👤 ${g.userName} (convidado)\n`;
      });
    });

    return message;
  }
}

export const BBQ_SERVICE_TOKEN = 'BBQ_SERVICE_TOKEN';