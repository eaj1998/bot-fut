import { Schema, model, Document, Types, Model } from "mongoose";

/**
 * Subdocumento: jogador que está na lista (roster.players)
 */
export interface GamePlayer {
  slot?: number;
  userId?: Types.ObjectId;
  name?: string;
  paid: boolean;
  paidAt?: Date;
}

/**
 * Subdocumento: suplente (roster.waitlist)
 */
export interface GameWaitlistEntry {
  userId?: Types.ObjectId;
  name?: string;
  createdAt: Date;
}

/**
 * Subdocumento: estrutura do roster
 */
export interface GameRoster {
  goalieSlots: number;
  players: GamePlayer[];
  waitlist: GameWaitlistEntry[];
}

/**
 * Documento principal do Game
 */
export interface GameDoc extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  date: Date;
  title?: string;
  priceCents?: number;
  maxPlayers?: number;
  status: "aberta" | "fechada" | "cancelada" | "finalizada";
  roster: GameRoster;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema
 */
const RosterPlayerSchema = new Schema<GamePlayer>(
  {
    slot: Number,
    userId: { type: Types.ObjectId, ref: "User" },
    name: String,
    paid: { type: Boolean, default: false },
    paidAt: Date,
  },
  { _id: false }
);

const RosterWaitlistSchema = new Schema<GameWaitlistEntry>(
  {
    userId: { type: Types.ObjectId, ref: "User" },
    name: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RosterSchema = new Schema<GameRoster>(
  {
    goalieSlots: { type: Number, default: 2 },
    players: { type: [RosterPlayerSchema], default: [] },
    waitlist: { type: [RosterWaitlistSchema], default: [] },
  },
  { _id: false }
);

const GameSchema = new Schema<GameDoc>(
  {
    workspaceId: { type: Types.ObjectId, ref: "Workspace", required: true, index: true },
    date: { type: Date, required: true, index: true },
    title: String,
    priceCents: Number,
    maxPlayers: Number,
    status: {
      type: String,
      enum: ["aberta", "fechada", "cancelada", "finalizada"],
      default: "aberta",
    },
    roster: {
      type: RosterSchema,
      default: () => ({ goalieSlots: 2, players: [], waitlist: [] }),
    },
  },
  { timestamps: true }
);

export const GameModel: Model<GameDoc> = model<GameDoc>("Game", GameSchema);
