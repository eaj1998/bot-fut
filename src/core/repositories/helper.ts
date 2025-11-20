import { UserModel } from "../models/user.model";

export async function ensureUser(workspaceId: string, phoneE164: string, name?: string) {
  const u = await UserModel.findOne({ workspaceId, phoneE164 });
  if (u) return u;
  return UserModel.create({ workspaceId, phoneE164, name: name ?? phoneE164 });
}
