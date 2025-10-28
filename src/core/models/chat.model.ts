import { Schema, model, Types } from "mongoose";

const ChatSchema = new Schema({
    workspaceId: { type: Types.ObjectId, ref: "Workspace", required: true, index: true },
    chatId: { type: String, required: true, unique: true },
    label: String,
    schedule: {
        weekday: { type: Number, min: 0, max: 6 },       // 0=Dom, 1=Seg, ... 6=Sáb
        time: { type: String, default: "20:30" },        // "HH:mm"
        title: { type: String, default: "⚽ CAMPO DO VIANA" },
        priceCents: { type: Number, default: 1400 },
        pix: { type: String, default: "fcjogasimples@gmail.com" }
    }
}, { timestamps: true });


export const ChatModel = model("Chat", ChatSchema);
