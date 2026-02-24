import { UserModel } from "../models/user.model";

async function ensureUser(workspaceId: string, phoneE164: string, name?: string, lid?: string) {
  if (lid) lid = lid.replace(/\D/g, '');
  let u = await UserModel.findOne({ workspaceId, phoneE164 });
  if (!u && lid) {
    u = await UserModel.findOne({ workspaceId, lid });
  }

  if (u) {
    if (lid && !u.lid) {
      u.lid = lid;
      await u.save();
    }
    return u;
  }
  return UserModel.create({ workspaceId, phoneE164, name: name ?? phoneE164, lid });
}
