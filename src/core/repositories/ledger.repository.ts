import { LEDGER_MODEL_TOKEN, LedgerDoc, LedgerModel } from "../models/ledger.model";
import { BalanceModel } from "../models/balance.model";
import { Model, Types } from "mongoose";
import { inject, injectable, singleton } from "tsyringe";


type AddDebitInput = {
  workspaceId: string;
  userId?: string;
  amountCents: number;
  gameId?: string;
  note?: string;
  category: "field-payment" | "player-payment" | "player-debt" | "general";
  method?: string;
  status?: "pendente" | "confirmado";
  confirmedAt?: Date;
};


@singleton()
@injectable()
export class LedgerRepository {
  constructor(
    @inject(LEDGER_MODEL_TOKEN) private readonly model: Model<LedgerDoc> = LedgerModel
  ) { }

  async addCredit({ workspaceId, userId, amountCents, gameId, method = "pix", note, category }: {
    workspaceId: string; userId: string; amountCents: number; gameId?: string; method?: string; note?: string; category: string
  }) {
    await this.model.create({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      gameId: gameId ? new Types.ObjectId(gameId) : undefined,
      type: "credit", method, amountCents, status: "confirmado", confirmedAt: new Date(), note,
      category: category,
    });

    if (userId && ["player-payment", "player-debt"].includes(category)) {
      await this.recomputeUserBalance(workspaceId, userId);
    }

    return 0;
  }

  async addDebit(input: AddDebitInput) {
    const {
      workspaceId,
      userId,
      amountCents,
      gameId,
      note,
      category = "general",
      status = "confirmado",
      confirmedAt = new Date(),
    } = input;

    const doc: any = {
      workspaceId: new Types.ObjectId(workspaceId),
      type: "debit",
      method: "pix",
      amountCents,
      status,
      confirmedAt,
      note,
      category,
    };

    if (userId && Types.ObjectId.isValid(userId)) {
      doc.userId = new Types.ObjectId(userId);
    }
    if (gameId && Types.ObjectId.isValid(gameId)) {
      doc.gameId = new Types.ObjectId(gameId);
    }

    await this.model.create(doc);

    if (doc.userId) {
      return await this.recomputeUserBalance(workspaceId, (doc.userId as Types.ObjectId).toString());
    }
    return 0;
  }

  async deleteCredit(workspaceId: Types.ObjectId, userId: Types.ObjectId, gameId?: Types.ObjectId) {
    return this.model.deleteOne({ workspaceId: workspaceId, userId: userId, gameId: gameId, type: 'credit' });
  }

  async recomputeUserBalance(workspaceId: string, userId: string) {
    const [agg] = await this.model.aggregate([
      {
        $match: {
          workspaceId: new Types.ObjectId(workspaceId),
          userId: new Types.ObjectId(userId),
          status: "confirmado",
        }
      },
      {
        $group: {
          _id: "$userId",
          debits: {
            $sum: {
              $cond: [{ $eq: ["$type", "debit"] }, "$amountCents", 0]
            }
          },
          credits: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$type", "credit"] },
                    { $ne: ["$category", "general"] }   
                  ]
                },
                "$amountCents",
                0
              ]
            }
          }
        }
      },
      { $project: { _id: 0, balanceCents: { $subtract: ["$credits", "$debits"] } } }
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

  async getUserBalance(workspaceId: string, userId: string): Promise<number> {
    const doc = await BalanceModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
    }).lean();

    return doc?.balanceCents ?? 0;
  }

  async listBalancesByUser(userId: string) {
    return BalanceModel
      .find({ userId: new Types.ObjectId(userId) })
      .select({ _id: 0, workspaceId: 1, userId: 1, balanceCents: 1, lastUpdatedAt: 1 })
      .lean();
  }

  async listLedgersByUser(userId: string) {
    return this.model
      .find({
        userId: new Types.ObjectId(userId),
        status: "confirmado"
      })
      .select({ _id: 1, workspaceId: 1, userId: 1, gameId: 1, type: 1, amountCents: 1, confirmedAt: 1, note: 1 })
      .lean();
  }


  async sumWorkspaceNet(workspaceId: string): Promise<number> {
    const [agg] = await this.model.aggregate([
      { $match: { workspaceId: new Types.ObjectId(workspaceId), status: "confirmado" } },
      {
        $group: {
          _id: "$workspaceId",
          debits: { $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amountCents", 0] } },
          credits: { $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amountCents", 0] } },
        },
      },
      { $project: { _id: 0, netCents: { $subtract: ["$credits", "$debits"] } } },
    ]);
    return agg?.netCents ?? 0;
  }

  async sumBalances(workspaceId: string): Promise<number> {
    const [agg] = await BalanceModel.aggregate([
      { $match: { workspaceId: new Types.ObjectId(workspaceId) } },
      { $group: { _id: "$workspaceId", total: { $sum: "$balanceCents" } } },
      { $project: { _id: 0, total: 1 } },
    ]);
    return agg?.total ?? 0;
  }

  async sumWorkspaceCashbox(workspaceId: string): Promise<number> {
    const ws = new Types.ObjectId(workspaceId);

    const [agg] = await this.model.aggregate([
      { $match: { workspaceId: ws, status: "confirmado" } },
      {
        $group: {
          _id: null,
          playerCredits: {
            $sum: {
              $cond: [{ $eq: ["$type", "credit"] }, "$amountCents", 0]
            }
          },
          fieldDebits: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$type", "debit"] }, { $eq: ["$category", "field-payment"] }] },
                "$amountCents",
                0
              ]
            }
          }
        }
      },
      { $project: { _id: 0, cashCents: { $subtract: ["$playerCredits", "$fieldDebits"] } } }
    ]);

    return agg?.cashCents ?? 0;
  }

}
