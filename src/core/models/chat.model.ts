import { Schema, model, Types, Model } from "mongoose";

export interface ChatSchedule {
    weekday?: number;       // 0 = Dom, 1 = Seg, ..., 6 = Sáb
    time?: string;          // "HH:mm"
    title?: string;
    priceCents?: number;
    pix?: string;
}

export interface ChatDoc extends Document {
    _id: Types.ObjectId;
    workspaceId: { type: Types.ObjectId, ref: "Workspace", required: true, index: true };
    chatId: string;
    label?: string;
    schedule?: ChatSchedule;

    createdAt: Date;
    updatedAt: Date;
}


const ChatSchema = new Schema<ChatDoc>({
  workspaceId: { type: Types.ObjectId, ref: "Workspace", required: true, index: true },
  chatId: { type: String, required: true, unique: true },
  label: String,
  schedule: {
    weekday: { type: Number, min: 0, max: 6 },
    time: { type: String, default: "20:30" },
    title: { type: String, default: "⚽ CAMPO DO VIANA" },
    priceCents: { type: Number, default: 1400 },
    pix: { type: String, default: "fcjogasimples@gmail.com" }
  }
}, { timestamps: true });

export const ChatModel: Model<ChatDoc> = model<ChatDoc>("Chat", ChatSchema);

export const CHAT_MODEL_TOKEN = "CHAT_MODEL_TOKEN";
