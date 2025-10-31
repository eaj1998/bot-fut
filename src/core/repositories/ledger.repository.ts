import { LEDGER_MODEL_TOKEN, LedgerDoc, LedgerModel } from "../models/ledger.model";
import { BalanceModel } from "../models/balance.model";
import { Model, Types } from "mongoose";
import { inject, injectable, singleton } from "tsyringe";

@singleton()
@injectable()
export class LedgerRepository {
  constructor(
    @inject(LEDGER_MODEL_TOKEN) private readonly model: Model<LedgerDoc> = LedgerModel
  ) { }

  async addCredit({ workspaceId, userId, amountCents, gameId, method = "pix", note }: {
    workspaceId: string; userId: string; amountCents: number; gameId?: string; method?: string; note?: string;
  }) {
    await this.model.create({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      gameId: gameId ? new Types.ObjectId(gameId) : undefined,
      type: "credit", method, amountCents, status: "confirmado", confirmedAt: new Date(), note
    });
    return await this.recomputeUserBalance(workspaceId, userId);
  }

  async addDebit({ workspaceId, userId, amountCents, gameId, note }: {
    workspaceId: string; userId: string; amountCents: number; gameId?: string; note?: string;
  }) {
    await this.model.create({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      gameId: gameId ? new Types.ObjectId(gameId) : undefined,
      type: "debit", method: "ajuste", amountCents, status: "confirmado", confirmedAt: new Date(), note
    });
    return await this.recomputeUserBalance(workspaceId, userId);
  }

  async recomputeUserBalance(workspaceId: string, userId: string) {
    const [agg] = await this.model.aggregate([
      { $match: { workspaceId: new Types.ObjectId(workspaceId), userId: new Types.ObjectId(userId), status: "confirmado" } },
      {
        $group: {
          _id: "$userId",
          debits: { $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amountCents", 0] } },
          credits: { $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amountCents", 0] } }
        }
      },
      { $project: { _id: 0, balanceCents: { $subtract: ["$debits", "$credits"] } } }
    ]);

    const balanceCents = agg?.balanceCents ?? 0;
    await BalanceModel.findOneAndUpdate(
      { workspaceId: new Types.ObjectId(workspaceId), userId: new Types.ObjectId(userId) },
      { $set: { balanceCents, lastUpdatedAt: new Date() } },
      { upsert: true }
    );
    return balanceCents;
  }

  static listDebtors(workspaceId: string, minDebtCents = 1) {
    return BalanceModel.find({ workspaceId, balanceCents: { $gte: minDebtCents } })
      .sort({ balanceCents: -1 })
      .lean();
  }
}
