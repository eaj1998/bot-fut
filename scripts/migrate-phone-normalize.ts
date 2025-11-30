import { MongoClient } from "mongodb";

async function run() {

    const uri = "   ";

    // Nome do banco
    const dbName = "";

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
