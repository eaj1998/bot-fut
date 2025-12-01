import { inject, injectable, singleton } from "tsyringe";
import { Model, Types } from "mongoose";
import { USER_MODEL_TOKEN, UserDoc } from "../models/user.model";

@singleton()
@injectable()
export class UserRepository {
    constructor(@inject(USER_MODEL_TOKEN) private readonly model: Model<UserDoc>) { }

    async findByWorkspaceAndPhone(workspaceId: Types.ObjectId, phoneE164: string) {
        return this.model.findOne({ workspaceId, phoneE164 });
    }

    async upsertByPhone(workspaceId: Types.ObjectId, phoneE164: string, name: string, lid?: string) {
        if (lid) lid = lid.replace(/\D/g, '');
        let user = await this.model.findOne({ workspaceId, phoneE164 });
        if (!user && lid) {
            user = await this.model.findOne({ workspaceId, lid });
        }

        if (user) {
            if (lid && !user.lid) {
                user.lid = lid;
                await user.save();
            }
            return user;
        }

        return this.model.create({ workspaceId, phoneE164, name, lid });
    }

    async findByPhoneE164(phone: string) {
        return this.model.findOne({ phoneE164: phone });
    }

    async findById(userId: string) {
        return await this.model.findOne({ _id: userId });
    }

    async create(data: Partial<UserDoc>) {
        return this.model.create(data);
    }
}