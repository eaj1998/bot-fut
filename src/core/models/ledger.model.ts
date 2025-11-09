import { Schema, model, Types, Model } from "mongoose";

export interface LedgerDoc extends Document {
    _id: Types.ObjectId;
    workspaceId: Types.ObjectId;
    gameId?: Types.ObjectId;
    userId?: Types.ObjectId;
    type: "debit" | "credit";
    method: "pix" | "dinheiro" | "transf" | "ajuste";
    category: "field-payment" | "player-payment" | "player-debt" | "general";
    amountCents: number;
    note?: string;
    status: "pendente" | "confirmado" | "estornado";
    confirmedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const LedgerSchema = new Schema({
    workspaceId: { type: Types.ObjectId, ref: "Workspace", index: true, required: true },
    gameId: { type: Types.ObjectId, ref: "Game" },
    userId: { type: Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["debit", "credit"], required: true },
    method: { type: String, enum: ["pix", "dinheiro", "transf", "ajuste"], default: "pix" },
    category: { type: String, enum: ["field-payment", "player-payment", "player-debt", "general"], default: "general" },
    amountCents: { type: Number, required: true },
    note: String,
    status: { type: String, enum: ["pendente", "confirmado", "estornado"], default: "confirmado" },
    confirmedAt: Date
}, { timestamps: true });

export const LedgerModel = model<LedgerDoc>("Ledger", LedgerSchema);

export const LEDGER_MODEL_TOKEN = "LEDGER_MODEL_TOKEN";