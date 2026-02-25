import { injectable, inject } from "tsyringe";
import { Message } from "whatsapp-web.js";
import { Types } from "mongoose";
import { IBotServerPort, BOT_CLIENT_TOKEN } from "../../server/type";
import { ChatModel } from "../../core/models/chat.model";
import { IRole } from "../type";

@injectable()
export class UnbindCommand {
    role = IRole.USER;

    constructor(
        @inject(BOT_CLIENT_TOKEN) private server: IBotServerPort
    ) { }

    async handle(message: Message) {
        const chat = await message.getChat();
        const chatId = chat.id._serialized;

        const existingChat = await ChatModel.findOne({ chatId });

        if (!existingChat || !existingChat.workspaceId) {
            await this.server.sendMessage(
                message.from,
                "⚠️ Este grupo não está vinculado a nenhum workspace no momento."
            );
            return;
        }

        await ChatModel.findOneAndUpdate(
            { chatId },
            {
                $unset: {
                    workspaceId: "",
                    schedule: "",
                    financials: ""
                }
            }
        );

        await this.server.sendMessage(
            message.from,
            "✅ Grupo desvinculado com sucesso!\n\nAgora você pode vinculá-lo a um novo workspace usando o comando */bind <slug_do_workspace>*."
        );
    }
}
