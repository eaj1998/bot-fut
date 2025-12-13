import { MongoClient } from "mongodb";

import { config } from 'dotenv';

config();

async function run() {
    const uri = process.env.MONGO_URI || "";
    const dbName = process.env.MONGO_DB || "";

    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Conectado ao MongoDB...");

        const db = client.db(dbName);
        const collection = db.collection("users");

        const result = await collection.updateMany(
            { phoneE164: { $regex: "@c\\.us$" } },
            [
                {
                    $set: {
                        phoneE164: {
                            $replaceOne: {
                                input: "$phoneE164",
                                find: "@c.us",
                                replacement: ""
                            }
                        }
                    }
                }
            ]
        );

        console.log(`Documents matched: ${result.matchedCount}`);
        console.log(`Documents modified: ${result.modifiedCount}`);
    } catch (error) {
        console.error("Erro ao executar update:", error);
    } finally {
        await client.close();
        console.log("Conexão encerrada.");
    }
}

run();
