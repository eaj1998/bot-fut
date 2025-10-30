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

export interface GameOutlistEntry {
  userId?: Types.ObjectId;
  name?: string;
  phoneE164?: string;
  createdAt: Date;
}

/**
 * Subdocumento: estrutura do roster
 */
export interface GameRoster {
  goalieSlots: number;
  players: GamePlayer[];
  waitlist: GameWaitlistEntry[];
  outlist: GameOutlistEntry[];
}

/**
 * Documento principal do Game
 */
export interface GameDoc extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  chatId: string;
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

const RosterOutlistSchema = new Schema<GameOutlistEntry>(
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
    outlist: { type: [RosterOutlistSchema], default: [] },
  },
  { _id: false }
);

const GameSchema = new Schema<GameDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    chatId: { type: String, required: true, index: true },
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
      default: () => ({ goalieSlots: 2, players: [], waitlist: [], outlist: [] }),
    },
  },
  { timestamps: true }
);

export const GameModel: Model<GameDoc> = model<GameDoc>("Game", GameSchema);
