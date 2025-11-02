import { Schema, model, Types, Model } from "mongoose";

export interface WorkspaceDoc extends Document {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    timezone: string;
    settings: {
        maxPlayers: number;
        pricePerGameCents: number;
        commandsEnabled: string[];
        pix?: string;
        title?: string;
    };
}

const WorkspaceSchema = new Schema({
    name: { type: String, required: true },
    slug: { type: String, unique: true, index: true },
    timezone: { type: String, default: "America/Sao_Paulo" },
    settings: {
        maxPlayers: { type: Number, default: 16 },
        pricePerGameCents: { type: Number, default: 1400 },
        commandsEnabled: { type: [String], default: ["/lista", "/entrar", "/sair", "/pagar", "/devedores"] },
        pix: { type: String },
        title: { type: String },
        default: { type: Object, default: {} }
    },
    roles: [{ userId: { type: Types.ObjectId, ref: "User" }, role: String }]
}, { timestamps: true });

export const WorkspaceModel: Model<WorkspaceDoc> = model<WorkspaceDoc>(
  "Workspace",
  WorkspaceSchema
);

export const WORKSPACE_MODEL_TOKEN = "WORKSPACE_MODEL_TOKEN";