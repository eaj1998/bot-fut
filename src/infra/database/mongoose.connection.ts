import mongoose from "mongoose";

export async function connectMongo(uri: string, db: string) {
  if (!uri) throw new Error("MONGO_URI não definido");
  await mongoose.connect(uri, { dbName: db });
  console.log(`[mongo] conectado em ${db}`);
}

export async function disconnectMongo() {
  await mongoose.disconnect();
  console.log("[mongo] desconectado");
}
