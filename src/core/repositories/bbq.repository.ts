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

  async create(workspaceId: string, chatId: string, date: Date): Promise<IBBQ> {
    const bbq = new this.model({
      workspaceId,
      chatId,
      status: 'open',
      date: date,
      createdAt: new Date(),
      participants: [],
      valuePerPerson: null
    });

    return bbq.save();
  }

  async addParticipant(bbqId: string, participant: IBBQParticipant): Promise<IBBQ | null> {
    return this.model.findByIdAndUpdate(
      bbqId,
      { $push: { participants: participant } },
      { new: true }
    ).exec();
  }

  async removeParticipant(bbqId: string, userId: string): Promise<IBBQ | null> {
    return this.model.findByIdAndUpdate(
      bbqId,
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

  async setValue(bbqId: string, value: number): Promise<IBBQ | null> {
    return this.model.findByIdAndUpdate(
      bbqId,
      { valuePerPerson: value },
      { new: true }
    ).exec();
  }

  async close(bbqId: string): Promise<IBBQ | null> {
    return this.model.findByIdAndUpdate(
      bbqId,
      {
        status: 'closed',
        closedAt: new Date()
      },
      { new: true }
    ).exec();
  }

  async cancel(bbqId: string): Promise<IBBQ | null> {
    return this.model.findByIdAndUpdate(
      bbqId,
      {
        status: 'cancelled',
        canceledAt: new Date()
      },
      { new: true }
    ).exec();
  }

  async markAsFinished(bbqId: string): Promise<IBBQ | null> {
    return this.model.findByIdAndUpdate(
      bbqId,
      {
        status: 'finished',
        finishedAt: new Date()
      },
      { new: true }
    ).exec();
  }

  async finish(bbqId: string): Promise<IBBQ | null> {
    return this.markAsFinished(bbqId);
  }

  async unfinish(bbqId: string): Promise<IBBQ | null> {
    return this.model.findByIdAndUpdate(
      bbqId,
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

  async updateParticipantPaymentStatus(bbqId: string, userId: string, isPaid: boolean): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, 'participants.userId': userId },
      { $set: { 'participants.$.isPaid': isPaid } },
      { new: true }
    ).exec();
  }

  async updateParticipantDebtId(bbqId: string, userId: string, debtId: string): Promise<IBBQ | null> {
    return this.model.findOneAndUpdate(
      { _id: bbqId, 'participants.userId': userId },
      { $set: { 'participants.$.debtId': debtId } },
      { new: true }
    ).exec();
  }
}

export const BBQ_REPOSITORY_TOKEN = 'BBQ_REPOSITORY_TOKEN';
