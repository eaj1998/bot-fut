import { LedgerModel } from "../models/ledger.model";
import { BalanceModel } from "../models/balance.model";
import { Types } from "mongoose";

export class LedgerRepository {
  static async addCredit({ workspaceId, userId, amountCents, gameId, method = "pix", note }:{
    workspaceId: string; userId: string; amountCents: number; gameId?: string; method?: string; note?: string;
  }) {
    await LedgerModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      gameId: gameId ? new Types.ObjectId(gameId) : undefined,
      type: "credit", method, amountCents, status: "confirmado", confirmedAt: new Date(), note
    });
    return this.recomputeUserBalance(workspaceId, userId);
  }

  static async addDebit({ workspaceId, userId, amountCents, gameId, note }:{
    workspaceId: string; userId: string; amountCents: number; gameId?: string; note?: string;
  }) {
    await LedgerModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      gameId: gameId ? new Types.ObjectId(gameId) : undefined,
      type: "debit", method: "ajuste", amountCents, status: "confirmado", confirmedAt: new Date(), note
    });
    return this.recomputeUserBalance(workspaceId, userId);
  }

  static async recomputeUserBalance(workspaceId: string, userId: string) {
    const [agg] = await LedgerModel.aggregate([
      { $match: { workspaceId: new Types.ObjectId(workspaceId), userId: new Types.ObjectId(userId), status: "confirmado" } },
      { $group: {
          _id: "$userId",
          debits: { $sum: { $cond: [{ $eq: ["$type","debit"] }, "$amountCents", 0] } },
          credits:{ $sum: { $cond: [{ $eq: ["$type","credit"]}, "$amountCents", 0] } }
        }
      },
      { $project: { _id: 0, balanceCents: { $subtract: ["$debits","$credits"] } } }
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
