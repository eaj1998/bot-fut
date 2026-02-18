import { inject, injectable } from 'tsyringe';
import { Model } from 'mongoose';
import { BBQ_MODEL_TOKEN, IBBQ, IBBQParticipant } from '../models/bbq.model';

@injectable()
export class BBQRepository {
  constructor(
    @inject(BBQ_MODEL_TOKEN) private readonly model: Model<IBBQ>
  ) { }

  async findBBQForDate(workspaceId: string, chatId: string, targetDate: Date): Promise<IBBQ | null> {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return this.model.findOne({
      workspaceId,
      chatId,
      status: 'open',
      date: { $gte: startOfDay, $lte: endOfDay }
    }).exec();
  }

  async findOneByIdAndWorkspace(id: string, workspaceId: string): Promise<IBBQ | null> {
    return this.model.findOne({ _id: id, workspaceId }).exec();
  }

  async create(workspaceId: string, chatId: string, date: Date): Promise<IBBQ> {
    const bbq = new this.model({
      workspaceId,
      chatId,
      status: 'open',
      date: date,
      createdAt: new Date(),
      participants: [],
      financials: {
        meatCost: 0,
        cookCost: 0,
        ticketPrice: 0
      }
    });

    return bbq.save();
  }

  async addParticipant(bbqId: string, workspaceId: string, participant: IBBQParticipant): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, workspaceId },
      { $push: { participants: participant } },
      { new: true }
    ).exec();
  }

  async removeParticipant(bbqId: string, workspaceId: string, userId: string): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, workspaceId },
      {
        $pull: {
          participants: {
            $or: [
              { userId },
              { invitedBy: userId }
            ]
          }
        }
      },
      { new: true }
    ).exec();
  }

  /**
   * Encontra BBQs onde o usuário participou em um determinado intervalo de datas.
   * Usado para verificar a regra de "1 grátis por mês".
   */
  async findByParticipant(workspaceId: string, userId: string, startDate: Date, endDate: Date): Promise<IBBQ[]> {
    return this.model.find({
      workspaceId,
      status: { $in: ['closed', 'finished'] },
      date: { $gte: startDate, $lte: endDate },
      'participants.userId': userId,
      'participants.isFree': true
    }).exec();
  }

  async setFinancials(bbqId: string, workspaceId: string, financials: { meatCost: number, cookCost: number, ticketPrice: number }): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, workspaceId },
      { financials },
      { new: true }
    ).exec();
  }

  async close(bbqId: string, workspaceId: string): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, workspaceId },
      {
        status: 'closed',
        closedAt: new Date()
      },
      { new: true }
    ).exec();
  }

  async cancel(bbqId: string, workspaceId: string): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, workspaceId },
      {
        status: 'cancelled',
        canceledAt: new Date()
      },
      { new: true }
    ).exec();
  }

  async markAsFinished(bbqId: string, workspaceId: string): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, workspaceId },
      {
        status: 'finished',
        finishedAt: new Date()
      },
      { new: true }
    ).exec();
  }

  async finish(bbqId: string, workspaceId: string): Promise<IBBQ | null> {
    return this.markAsFinished(bbqId, workspaceId);
  }

  async unfinish(bbqId: string, workspaceId: string): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, workspaceId },
      {
        status: 'closed',
        finishedAt: undefined
      },
      { new: true }
    ).exec();
  }

  async findById(bbqId: string): Promise<IBBQ | null> {
    return this.model.findById(bbqId).exec();
  }

  async updateParticipantPaymentStatus(bbqId: string, workspaceId: string, userId: string, isPaid: boolean): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, workspaceId, 'participants.userId': userId },
      { $set: { 'participants.$.isPaid': isPaid } },
      { new: true }
    ).exec();
  }

  async updateParticipantDebtId(bbqId: string, workspaceId: string, userId: string, debtId: string): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, workspaceId, 'participants.userId': userId },
      { $set: { 'participants.$.debtId': debtId } },
      { new: true }
    ).exec();
  }
  async updateParticipantIsFree(bbqId: string, workspaceId: string, userId: string, isFree: boolean): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, workspaceId, 'participants.userId': userId },
      { $set: { 'participants.$.isFree': isFree } },
      { new: true }
    ).exec();
  }

  async update(id: string, workspaceId: string, updateData: any): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: id, workspaceId },
      updateData,
      { new: true }
    ).exec();
  }
}

export const BBQ_REPOSITORY_TOKEN = 'BBQ_REPOSITORY_TOKEN';
