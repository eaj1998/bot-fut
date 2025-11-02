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

    async upsertByPhone(workspaceId: Types.ObjectId, phoneE164: string, name: string) {
        return this.model.findOneAndUpdate(
            { workspaceId, phoneE164 },
            { $setOnInsert: { name } },
            { new: true, upsert: true }
        );
    }

    async findByPhoneE164(phone: string) {
        return this.model.findOne({ phoneE164: phone });
    }

    async create(data: Partial<UserDoc>) {
        return this.model.create(data);
    }
}