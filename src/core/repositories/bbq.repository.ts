import { inject, injectable } from 'tsyringe';
import { Model } from 'mongoose';
import { BBQ_MODEL_TOKEN, IBBQ, IBBQParticipant } from '../models/bbq.model';

@injectable()
export class BBQRepository {
  constructor(
    @inject(BBQ_MODEL_TOKEN) private readonly model: Model<IBBQ>
  ) {}

  async findTodayBBQ(workspaceId: string, chatId: string): Promise<IBBQ | null> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.model.findOne({
      workspaceId,
      chatId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).exec();
  }

  async create(workspaceId: string, chatId: string): Promise<IBBQ> {
    const bbq = new this.model({
      workspaceId,
      chatId,
      status: 'open',
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

  async findById(bbqId: string): Promise<IBBQ | null> {
    return this.model.findById(bbqId).exec();
  }
}

export const BBQ_REPOSITORY_TOKEN = 'BBQ_REPOSITORY_TOKEN';
