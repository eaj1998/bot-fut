import { LEDGER_MODEL_TOKEN, LedgerDoc, LedgerModel } from "../models/ledger.model";
import { BalanceModel } from "../models/balance.model";
import { Model, Types } from "mongoose";
import { inject, injectable, singleton } from "tsyringe";


export type AddDebitInput = {
  workspaceId: string;
  userId?: string;
  amountCents: number;
  gameId?: string;
  bbqId?: string;
  note?: string;
  category: "field-payment" | "player-payment" | "player-debt" | "general" | "equipment" | "rental-goalkeeper" | "churrasco";
  method?: string;
  status?: "pendente" | "confirmado";
  confirmedAt?: Date;
  createdAt?: Date;
  organizzeId?: number;
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
      bbqId,
      note,
      category = "general",
      status = "confirmado",
      confirmedAt = new Date(),
      createdAt,
      organizzeId,
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
      organizzeId,
    };

    if (userId && Types.ObjectId.isValid(userId)) {
      doc.userId = new Types.ObjectId(userId);
    }
    if (gameId && Types.ObjectId.isValid(gameId)) {
      doc.gameId = new Types.ObjectId(gameId);
    }
    if (bbqId && Types.ObjectId.isValid(bbqId)) {
      doc.bbqId = new Types.ObjectId(bbqId);
    }
    if (createdAt) {
      doc.createdAt = createdAt;
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
          status: { $in: ["confirmado", "pendente"] }, // Incluir débitos pendentes e confirmados
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
        status: { $in: ["pendente"] }
      })
      .select({ _id: 1, workspaceId: 1, userId: 1, gameId: 1, type: 1, amountCents: 1, confirmedAt: 1, note: 1, category: 1 })
      .lean();
  }

  async findBBQDebtsByUser(workspaceId: string, userId: string) {
    return this.model
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
        category: "churrasco",
        type: "debit",
        status: { $in: ["pendente"] }
      })
      .select({ amountCents: 1, note: 1, createdAt: 1 })
      .lean();
  }

  async findPendingBBQDebtsByWorkspace(workspaceId: string) {
    return this.model
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        category: "churrasco",
        type: "debit",
        status: "pendente"
      })
      .select({ amountCents: 1, note: 1, createdAt: 1 })
      .lean();
  }

  async findPendingBBQDebtByUserAndDate(
    workspaceId: string,
    userId: string,
    date: Date
  ): Promise<LedgerDoc | null> {
    // Create date range for the target day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    console.log('[BBQ Payment] Looking for debt on date:', date);
    console.log('[BBQ Payment] Date range:', startOfDay, 'to', endOfDay);
    console.log('[BBQ Payment] WorkspaceId:', workspaceId);
    console.log('[BBQ Payment] UserId:', userId);

    const result = await this.model.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      category: "churrasco",
      type: "debit",
      status: "pendente",
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).exec();

    console.log('[BBQ Payment] Found debt:', result ? 'YES' : 'NO');
    return result;
  }



  async sumWorkspaceNet(workspaceId: string): Promise<number> {
    const [agg] = await this.model.aggregate([
      { $match: { workspaceId: new Types.ObjectId(workspaceId), status: { $in: ["confirmado", "pendente"] } } },
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
              $cond: [
                { $and: [{ $eq: ["$type", "credit"] }, { $in: ["$category", ["player-payment", "player-credit", "general"]] }] },
                "$amountCents",
                0
              ]
            }
          },
          fieldDebits: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$type", "debit"] }, { $in: ["$category", ["field-payment", "equipment", "rental-goalkeeper", "general"]] }] },
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

  /**
   * Obtém o saldo de um usuário (soma de todos os workspaces)
   */
  async getBalance(userId: Types.ObjectId): Promise<number> {
    const balances = await BalanceModel.find({ userId }).lean();
    return balances.reduce((sum, b) => sum + (b.balanceCents || 0), 0);
  }

  /**
   * Busca entradas do ledger por usuário (confirmados e pendentes)
   */
  async findByUserId(userId: Types.ObjectId) {
    return this.model
      .find({ userId, status: { $in: ['confirmado'] } })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Busca entradas do ledger por usuário (pendentes) com informações do workspace e chat
   */
  async findDebtsByUserId(userId: Types.ObjectId) {
    const ledgers = await this.model
      .find({ userId, status: { $in: ['pendente'] }, type: 'debit' })
      .populate('workspaceId', 'name slug')
      .populate('gameId', 'chatId')
      .sort({ createdAt: -1 })
      .lean();

    const chatIds = ledgers
      .map(l => (l.gameId as any)?.chatId)
      .filter(Boolean);

    if (chatIds.length > 0) {
      const { ChatModel } = await import('../models/chat.model');
      const chats = await ChatModel.find({ chatId: { $in: chatIds } })
        .select('chatId schedule.pix')
        .lean();

      const chatMap = new Map(chats.map(c => [c.chatId, c.schedule?.pix]));

      return ledgers.map(ledger => ({
        ...ledger,
        pix: chatMap.get((ledger.gameId as any)?.chatId)
      }));
    }

    return ledgers;
  }

  /**
   * Busca movimentações do usuário com paginação
   */
  async findByUserIdPaginated(userId: Types.ObjectId, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [ledgers, total] = await Promise.all([
      this.model
        .find({ userId, status: { $in: ['confirmado', 'pendente'] } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments({ userId, status: { $in: ['confirmado', 'pendente'] } })
    ]);

    return {
      ledgers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit
    };
  }

  /**
   * Busca débito pendente por usuário e jogo
   */
  async findPendingDebitByUserAndGame(
    workspaceId: string,
    userId: string,
    gameId: string
  ): Promise<LedgerDoc | null> {
    return this.model.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      gameId: new Types.ObjectId(gameId),
      type: "debit",
      status: "pendente",
      category: "player-debt"
    }).exec();
  }

  /**
   * Confirma um débito pendente
   */
  async confirmDebit(debitId: string): Promise<LedgerDoc | null> {
    const debit = await this.model.findByIdAndUpdate(
      debitId,
      {
        $set: {
          status: "confirmado",
          confirmedAt: new Date()
        }
      },
      { new: true }
    ).exec();

    if (debit && debit.userId) {
      await this.recomputeUserBalance(
        debit.workspaceId.toString(),
        debit.userId.toString()
      );
    }

    return debit;
  }

  /**
   * Busca todos os débitos pendentes de um usuário em um workspace
   */
  async findPendingDebitsByUser(
    workspaceId: string,
    userId: string
  ): Promise<LedgerDoc[]> {
    return this.model.find({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      type: "debit",
      status: "pendente",
      category: "player-debt"
    })
      .sort({ createdAt: -1 })
      .exec() as Promise<LedgerDoc[]>;
  }

  /**
   * Reverte um débito confirmado para pendente
   */
  async unconfirmDebit(workspaceId: string, userId: string, gameId: string): Promise<LedgerDoc | null> {
    const debit = await this.model.findOneAndUpdate(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
        gameId: new Types.ObjectId(gameId),
        type: "debit",
        status: "confirmado",
        category: "player-debt"
      },
      {
        $set: {
          status: "pendente",
          confirmedAt: undefined
        }
      },
      { new: true }
    ).exec();

    if (debit && debit.userId) {
      await this.recomputeUserBalance(
        debit.workspaceId.toString(),
        debit.userId.toString()
      );
    }

    return debit;
  }


}

export const LEDGER_REPOSITORY_TOKEN = 'LEDGER_REPOSITORY_TOKEN';
