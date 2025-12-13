import { inject, injectable } from 'tsyringe';
import { BBQ_REPOSITORY_TOKEN, BBQRepository } from '../core/repositories/bbq.repository';
import { IBBQ, IBBQParticipant } from '../core/models/bbq.model';
import { LEDGER_REPOSITORY_TOKEN, LedgerRepository } from '../core/repositories/ledger.repository';
import { ChatModel } from '../core/models/chat.model';
import { getNextWeekday } from '../utils/date';

@injectable()
export class BBQService {
  constructor(
    @inject(BBQ_REPOSITORY_TOKEN) private readonly bbqRepository: BBQRepository,
    @inject(LEDGER_REPOSITORY_TOKEN) private readonly ledgerRepository: LedgerRepository,
  ) { }

  private async getGameDateFromSchedule(workspaceId: string, chatId: string): Promise<Date> {
    const chat = await ChatModel.findOne({ chatId, workspaceId }).lean();

    if (!chat || !chat.schedule) {
      throw new Error("Chat sem configuração de schedule. Configure o dia do jogo primeiro.");
    }

    const weekday = chat.schedule.weekday ?? 2; // Default to Tuesday
    const base = new Date();
    return getNextWeekday(base, weekday);
  }

  async getOrCreateBBQForGameDay(workspaceId: string, chatId: string): Promise<IBBQ> {
    const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);

    let bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);

    if (!bbq) {
      bbq = await this.bbqRepository.create(workspaceId, chatId, gameDate);
    }

    return bbq;
  }

  async joinBBQ(workspaceId: string, chatId: string, userId: string, userName: string): Promise<{ success: boolean; message: string; bbq?: IBBQ }> {
    const bbq = await this.getOrCreateBBQForGameDay(workspaceId, chatId);

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }
    console.log('bbq', bbq);
    console.log('userId', userId);

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

  async leaveBBQ(workspaceId: string, chatId: string, userId: string, userName: string): Promise<{ success: boolean; message: string; bbq?: IBBQ }> {
    const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
    const bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);

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

  async addGuest(workspaceId: string, chatId: string, inviterId: string, inviterName: string, guestName: string): Promise<{ success: boolean; message: string }> {
    const bbq = await this.getOrCreateBBQForGameDay(workspaceId, chatId);

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

  async removeGuest(workspaceId: string, chatId: string, inviterId: string, guestName: string): Promise<{ success: boolean; message: string }> {
    const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
    const bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);

    if (!bbq) {
      return { success: false, message: '❌ Não existe lista de churrasco hoje.' };
    }

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    const guest = bbq.participants.find((p: IBBQParticipant) => p.userName === guestName && p.invitedBy === inviterId);

    if (!guest) {
      return { success: false, message: `❌ Convidado *${guestName}* não encontrado na sua lista.` };
    }

    await this.bbqRepository.removeParticipant(bbq._id.toString(), guest.userId);

    return {
      success: true,
      message: `👋 Convidado *${guestName}* foi removido do churrasco.`
    };
  }

  async setBBQValue(workspaceId: string, chatId: string, value: number): Promise<{ success: boolean; message: string }> {
    const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
    const bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);

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
    const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
    const bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);

    if (!bbq) {
      return { success: false, message: '❌ Não existe lista de churrasco hoje.' };
    }

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    if (!bbq.valuePerPerson) {
      return { success: false, message: '❌ Defina o valor do churrasco antes de fechar a lista! Use `/valor-churras X`' };
    }

    if (bbq.participants.length === 0) {
      return { success: false, message: '❌ Não há participantes no churrasco!' };
    }

    const debtsMap = new Map<string, { userId: string; userName: string; count: number }>();

    for (const participant of bbq.participants) {
      const debtor = participant.invitedBy || participant.userId;
      const debtorName = participant.invitedBy
        ? bbq.participants.find((p: IBBQParticipant) => p.userId === participant.invitedBy)?.userName || 'Desconhecido'
        : participant.userName;

      if (debtsMap.has(debtor)) {
        debtsMap.get(debtor)!.count += 1;
      } else {
        debtsMap.set(debtor, { userId: debtor, userName: debtorName, count: 1 });
      }
    }

    for (const [_, debt] of debtsMap) {
      const totalAmount = bbq.valuePerPerson * debt.count;

      const year = bbq.date.getFullYear();
      const month = String(bbq.date.getMonth() + 1).padStart(2, '0');
      const day = String(bbq.date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      await this.ledgerRepository.addDebit({
        workspaceId: workspaceId,
        userId: debt.userId,
        amountCents: totalAmount * 100,
        bbqId: bbq._id.toString(),
        note: `Debito de churrasco - ${dateStr} - ${debt.userName}`,
        category: "churrasco",
        status: "pendente",
        createdAt: bbq.date
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

  async cancelBBQ(workspaceId: string, chatId: string): Promise<{ success: boolean; message: string }> {
    const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
    const bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);

    if (!bbq || bbq.status !== 'open') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    await this.bbqRepository.cancel(bbq._id.toString());

    return { success: true, message: '✅ Lista de churrasco cancelada!' };
  }

  async checkAndFinishBBQ(bbqId: string, workspaceId: string): Promise<void> {
    const bbq = await this.bbqRepository.findById(bbqId);

    if (!bbq || bbq.status !== 'closed') {
      return;
    }

    const allDebts = await this.ledgerRepository['model']
      .find({
        workspaceId: bbq.workspaceId,
        bbqId: bbq._id,
        category: 'churrasco',
        type: 'debit'
      })
      .lean();

    const allPaid = allDebts.length > 0 && allDebts.every(debt => debt.status === 'confirmado');

    if (allPaid) {
      await this.bbqRepository.markAsFinished(bbqId);
      console.log(`[BBQ] Marked BBQ ${bbqId} as finished - all participants have paid`);
    }
  }

  formatBBQList(bbq: IBBQ): string {
    if (!bbq || bbq.participants.length === 0) {
      return '🍖 *CHURRASCO*\n\nNinguém confirmou ainda. Seja o primeiro! 🔥';
    }

    const d = new Date(bbq.date);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');

    let message = `🍖 *CHURRASCO*\n`;
    message += `📅 Data: ${dia}/${mes}\n`;
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