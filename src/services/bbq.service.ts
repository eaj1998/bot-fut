import { inject, injectable } from 'tsyringe';
import { BBQ_REPOSITORY_TOKEN, BBQRepository } from '../core/repositories/bbq.repository';
import { IBBQ, IBBQParticipant } from '../core/models/bbq.model';
import { TRANSACTION_REPOSITORY_TOKEN, TransactionRepository } from '../core/repositories/transaction.repository';
import { MEMBERSHIP_REPOSITORY_TOKEN, MembershipRepository } from '../core/repositories/membership.repository';
import { MembershipStatus } from '../core/models/membership.model';
import { TransactionType, TransactionCategory, TransactionStatus } from '../core/models/transaction.model';
import { ChatModel } from '../core/models/chat.model';
import { getNextWeekday, getNowInSPAsUTC } from '../utils/date';
import { formatDateBR } from '../utils/date';
import { BBQStatus } from '../api/dto/bbq.dto';

@injectable()
export class BBQService {
  constructor(
    @inject(BBQ_REPOSITORY_TOKEN) private readonly bbqRepository: BBQRepository,
    @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepository: TransactionRepository,
    @inject(MEMBERSHIP_REPOSITORY_TOKEN) private readonly membershipRepository: MembershipRepository,
  ) { }

  private async getGameDateFromSchedule(workspaceId: string, chatId: string): Promise<Date> {
    const chat = await ChatModel.findOne({ chatId, workspaceId }).lean();

    if (!chat || !chat.schedule) {
      throw new Error("Chat sem configuração de schedule. Configure o dia do jogo primeiro.");
    }

    const weekday = chat.schedule.weekday ?? 2; // Default to Tuesday
    const base = getNowInSPAsUTC();
    return getNextWeekday(base, weekday);
  }

  async getOrCreateBBQForGameDay(workspaceId: string, chatId: string): Promise<IBBQ> {

    let bbq = await this.bbqRepository.findRecentBBQByStatus(workspaceId, chatId, BBQStatus.OPEN);

    if (!bbq) {
      const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
      bbq = await this.bbqRepository.create(workspaceId, chatId, gameDate);
    }

    return bbq;
  }

  async joinBBQ(workspaceId: string, chatId: string, userId: string, userName: string, bbqId?: string): Promise<{ success: boolean; message: string; bbq?: IBBQ }> {
    let bbq: IBBQ | null;

    if (bbqId) {
      bbq = await this.bbqRepository.findById(bbqId);
      if (!bbq) {
        return { success: false, message: '❌ Churrasco não encontrado.' };
      }
    } else {
      bbq = await this.getOrCreateBBQForGameDay(workspaceId, chatId);
    }

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    const alreadyIn = bbq.participants.some(p => p.userId === userId);
    if (alreadyIn) {
      return { success: false, message: '⚠️ Você já está na lista do churrasco!' };
    }

    // Regra: 1 Churrasco Grátis por mês para Mensalistas Ativos
    let isFree = false;
    const membership = await this.membershipRepository.findByUserId(userId, workspaceId);

    if (membership && membership.status === MembershipStatus.ACTIVE) {
      // Verificar se já usou o benefício no mês do churrasco
      const bbqMonth = bbq.date.getUTCMonth();
      const bbqYear = bbq.date.getUTCFullYear();

      // Construct start/end dates in UTC Wall Time to match stored dates
      const startOfMonth = new Date(Date.UTC(bbqYear, bbqMonth, 1, 0, 0, 0, 0));
      // End of month: Day 0 of next month
      const endOfMonth = new Date(Date.UTC(bbqYear, bbqMonth + 1, 0, 23, 59, 59, 999));

      const participatedBBQs = await this.bbqRepository.findByParticipant(workspaceId, userId, startOfMonth, endOfMonth);

      // Se não participou de nenhum outro BBQ gratuito neste mês, este é grátis
      const usedFreeBenefit = participatedBBQs.length > 0;

      if (!usedFreeBenefit) {
        isFree = true;
      }
    }

    const participant: IBBQParticipant = {
      userId,
      userName,
      invitedBy: null,
      isPaid: false,
      isGuest: false,
      isFree
    };

    const updatedBBQ = await this.bbqRepository.addParticipant(bbq._id.toString(), participant);

    return {
      success: true,
      message: `🍖 *${userName}* entrou no churrasco!${isFree ? ' (Grátis - Benefício Mensalista)' : ''}`,
      bbq: updatedBBQ || undefined
    };
  }

  async leaveBBQ(workspaceId: string, chatId: string, userId: string, userName: string, bbqId?: string): Promise<{ success: boolean; message: string; bbq?: IBBQ }> {
    let bbq: IBBQ | null;

    if (bbqId) {
      bbq = await this.bbqRepository.findById(bbqId);
    } else {
      const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
      bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);
    }

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

  async addGuest(workspaceId: string, chatId: string, inviterId: string, inviterName: string, guestName: string, bbqId?: string): Promise<{ success: boolean; message: string }> {
    let bbq: IBBQ | null;

    if (bbqId) {
      bbq = await this.bbqRepository.findById(bbqId);
      if (!bbq) return { success: false, message: '❌ Churrasco não encontrado.' };
    } else {
      bbq = await this.getOrCreateBBQForGameDay(workspaceId, chatId);
    }

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    const guest: IBBQParticipant = {
      userId: `guest_${Date.now()}`,
      userName: guestName,
      invitedBy: inviterId,
      isPaid: false,
      isGuest: true,
      isFree: false
    };

    await this.bbqRepository.addParticipant(bbq._id.toString(), guest);

    return {
      success: true,
      message: `🍖 *${inviterName}* adicionou *${guestName}* como convidado do churrasco!`
    };
  }

  async removeGuest(workspaceId: string, chatId: string, inviterId: string, guestName: string, bbqId?: string): Promise<{ success: boolean; message: string }> {
    let bbq: IBBQ | null;

    if (bbqId) {
      bbq = await this.bbqRepository.findById(bbqId);
    } else {
      const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
      bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);
    }

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

  async setFinancials(workspaceId: string, chatId: string, financials: { meatCost: number, cookCost: number, ticketPrice: number }): Promise<{ success: boolean; message: string }> {
    const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
    const bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);

    if (!bbq) {
      return { success: false, message: '❌ Não existe lista de churrasco hoje.' };
    }

    await this.bbqRepository.setFinancials(bbq._id.toString(), financials);

    return {
      success: true,
      message: `💰 Financeiro do churrasco atualizado!\n🥩 Custo Carne: R$ ${financials.meatCost}\n👨‍🍳 Custo Assador: R$ ${financials.cookCost}\n🎟️ Valor por Pessoa: R$ ${financials.ticketPrice}`
    };
  }

  async closeBBQ(workspaceId: string, chatId: string, bbqId?: string): Promise<{ success: boolean; message: string }> {
    let bbq: IBBQ | null;

    if (bbqId) {
      bbq = await this.bbqRepository.findById(bbqId);
      if (!bbq) return { success: false, message: '❌ Churrasco não encontrado.' };
    } else {
      const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
      bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);
    }

    if (!bbq) {
      return { success: false, message: '❌ Não existe lista de churrasco hoje.' };
    }

    if (bbq.status === 'closed') {
      return { success: false, message: '❌ A lista do churrasco já está fechada!' };
    }

    if (bbq.financials.ticketPrice <= 0) {
      return { success: false, message: '❌ Defina o valor (ticketPrice) do churrasco antes de fechar! Use o comando de configuração financeira.' };
    }

    if (bbq.participants.length === 0) {
      return { success: false, message: '❌ Não há participantes no churrasco!' };
    }

    // 1. Gerar Despesa Total (Carne + Assador)
    const totalCost = (bbq.financials.meatCost || 0) + (bbq.financials.cookCost || 0);
    if (totalCost > 0) {
      await this.transactionRepository.createTransaction({
        workspaceId,
        type: TransactionType.EXPENSE,
        category: TransactionCategory.BBQ_COST, // Ensure category exists or use GENERAL
        amount: totalCost,
        status: TransactionStatus.COMPLETED,
        description: `Custos Churrasco - ${formatDateBR(bbq.date)}`,
        dueDate: bbq.date,
        paidAt: new Date(),
        method: 'dinheiro' // Default
      });
    }

    // 2. Gerar Receitas (Cobranças)
    let payingCount = 0;
    let freeCount = 0;

    for (const participant of bbq.participants) {
      if (participant.isFree) {
        freeCount++;
        continue;
      }

      payingCount++;
      const debtorId = participant.invitedBy || participant.userId;
      const description = participant.invitedBy
        ? `Churrasco - ${formatDateBR(bbq.date)} (Convidado: ${participant.userName})`
        : `Churrasco - ${formatDateBR(bbq.date)}`;

      const transaction = await this.transactionRepository.createTransaction({
        workspaceId,
        userId: debtorId,
        gameId: bbq._id.toString(), // Link to BBQ ID in gameId field or add generic link
        type: TransactionType.INCOME,
        category: TransactionCategory.BBQ_REVENUE,
        amount: bbq.financials.ticketPrice,
        status: participant.isPaid ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
        description,
        dueDate: bbq.date,
        paidAt: participant.isPaid ? new Date() : undefined,
        method: participant.isPaid ? 'dinheiro' : 'pix'
      });

      // Salvar transactionId no participante
      // Note: Isso requer um metodo especifico no repo ou re-save
      // Vamos usar o updatePoll
      await this.membershipRepository['model'].db.collection('bbqs').updateOne(
        { _id: bbq._id, "participants.userId": participant.userId },
        { $set: { "participants.$.transactionId": transaction._id.toString() } }
      );
    }

    await this.bbqRepository.close(bbq._id.toString());

    const totalCollected = payingCount * bbq.financials.ticketPrice;

    return {
      success: true,
      message: `✅ *Lista de churrasco fechada!*\n\n` +
        `👥 Total: *${bbq.participants.length}* (${freeCount} grátis)\n` +
        `💰 Preço: *R$ ${bbq.financials.ticketPrice}*\n` +
        `💵 Arrecadação Prevista: *R$ ${totalCollected.toFixed(2)}*\n` +
        `📉 Custos: *R$ ${totalCost.toFixed(2)}*\n\n` +
        `Cobranças geradas! 🎯`
    };
  }

  async cancelBBQ(workspaceId: string, chatId: string, bbqId?: string): Promise<{ success: boolean; message: string }> {
    let bbq: IBBQ | null;

    if (bbqId) {
      bbq = await this.bbqRepository.findById(bbqId);
    } else {
      const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
      bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);
    }

    if (!bbq || bbq.status !== 'open') {
      return { success: false, message: '❌ A lista do churrasco já está fechada ou não encontrada!' };
    }

    await this.bbqRepository.cancel(bbq._id.toString());

    return { success: true, message: '✅ Lista de churrasco cancelada!' };
  }

  // Legacy method kept empty or refactored if needed
  async checkAndFinishBBQ(bbqId: string, workspaceId: string): Promise<void> {
    // Implementation depends on transaction status checking if needed
  }

  formatBBQList(bbq: IBBQ): string {
    if (!bbq || bbq.participants.length === 0) {
      return '🍖 *CHURRASCO*\n\nNinguém confirmou ainda. Seja o primeiro! 🔥';
    }

    const d = new Date(bbq.date);
    const dia = String(d.getUTCDate()).padStart(2, '0');
    const mes = String(d.getUTCMonth() + 1).padStart(2, '0');

    let message = `🍖 *CHURRASCO*\n`;
    message += `📅 Data: ${dia}/${mes}\n`;
    message += `Status: ${bbq.status === 'open' ? '🟢 ABERTO' : '🔴 FECHADO'}\n`;

    if (bbq.financials?.ticketPrice) {
      message += `💰 Valor: R$ ${bbq.financials.ticketPrice.toFixed(2)}\n`;
    }

    message += `\n👥 *Participantes (${bbq.participants.length})*:\n\n`;

    const directParticipants = bbq.participants.filter(p => !p.invitedBy);
    const guests = bbq.participants.filter(p => p.invitedBy);

    directParticipants.forEach((p, idx) => {
      const freeBadge = p.isFree ? ' (🆓)' : '';
      message += `${idx + 1}. ${p.userName}${freeBadge}\n`;

      const myGuests = guests.filter(g => g.invitedBy === p.userId);
      myGuests.forEach(g => {
        message += `   └ 👤 ${g.userName} (convidado)\n`;
      });
    });

    return message;
  }

  async toggleParticipantFree(workspaceId: string, chatId: string, userId: string, isFree: boolean, bbqId?: string): Promise<{ success: boolean; message: string; bbq?: IBBQ }> {
    let bbq: IBBQ | null;

    if (bbqId) {
      bbq = await this.bbqRepository.findById(bbqId);
    } else {
      const gameDate = await this.getGameDateFromSchedule(workspaceId, chatId);
      bbq = await this.bbqRepository.findBBQForDate(workspaceId, chatId, gameDate);
    }

    if (!bbq) {
      return { success: false, message: '❌ Churrasco não encontrado.' };
    }

    if (bbq.status !== 'open') {
      return { success: false, message: '❌ O churrasco não está aberto para alterações.' };
    }

    const participant = bbq.participants.find(p => p.userId === userId);
    if (!participant) {
      return { success: false, message: '❌ Participante não encontrado.' };
    }

    // Update isFree status
    bbq = await this.bbqRepository.updateParticipantIsFree(bbq._id.toString(), userId, isFree);

    if (!bbq) {
      return { success: false, message: '❌ Erro ao atualizar participante.' };
    }

    return {
      success: true,
      message: `✅ ${participant.userName} agora é ${isFree ? 'ISENTO' : 'PAGANTE'}. ${bbq?.financials.ticketPrice ? `Novo valor por pessoa: R$ ${bbq.financials.ticketPrice}` : ''}`,
      bbq: bbq || undefined
    };
  }
}

export const BBQ_SERVICE_TOKEN = 'BBQ_SERVICE_TOKEN';