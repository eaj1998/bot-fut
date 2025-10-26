import { Message } from "whatsapp-web.js";
import { inject, injectable } from "tsyringe";
import { LineUpRepository } from "../repository/lineup.repository";
import { singleton } from "tsyringe";

export type LineUpInfo = {
  data: Date;
  horario: string;
  jogadores: (string | null)[];
  jogadoresFora: (string | null)[];
  suplentes: string[];
};

@singleton()

export class LineUpService {
  constructor(
    @inject(LineUpRepository) private readonly repo: LineUpRepository
  ) { }

  async getAuthorName(message: Message): Promise<string> {
    const contato = await message.getContact();
    return (
      contato.pushname ??
      contato.name ??
      message.author?.split("@")[0] ??
      "Desconhecido"
    );
  }

  getActiveListOrWarn(groupId: string, reply: (txt: string) => void): LineUpInfo | null {
    const list = this.repo.listasAtuais[groupId];
    if (!list) {
      reply(
        "Nenhuma lista de jogo ativa no momento. Aguarde um admin enviar com o comando /lista."
      );
      return null;
    }
    return list;
  }

  alreadyInList(list: LineUpInfo, name: string): boolean {
    return list.jogadores.includes(name) || list.suplentes.includes(name);
  }

  addOutfieldPlayer(list: LineUpInfo, name: string): { added: boolean; suplentePos?: number } {
    for (let i = 2; i < 16; i++) {
      if (list.jogadores[i] === null) {
        list.jogadores[i] = name;
        return { added: true };
      }
    }
    list.suplentes.push(name);
    return { added: false, suplentePos: list.suplentes.length };
  }

  addGoalkeeper(list: LineUpInfo, name: string): { added: boolean; suplentePos?: number } {
    for (let i = 0; i < 2; i++) {
      if (list.jogadores[i] === "🧤" || list.jogadores[i] === null) {
        list.jogadores[i] = `🧤 ${name}`;
        return { added: true };
      }
    }
    list.suplentes.push(name);
    return { added: false, suplentePos: list.suplentes.length };
  }

  initList(groupId: string, gameDate: Date, gameTime: string) {
    const jogadores = Array<string | null>(16).fill(null);
    jogadores[0] = "🧤"; // goleiro 1
    jogadores[1] = "🧤"; // goleiro 2

    this.repo.listasAtuais[groupId] = {
      data: gameDate,
      horario: gameTime,
      jogadores,
      suplentes: [],
      jogadoresFora: [],
    };
  }

  addOffLineupPlayer(list: LineUpInfo, name: string): { added: boolean; } {
    try {
      list.jogadoresFora.push(name);
      return { added: true };
     } catch {
      return { added: false };
      }
  }

  formatList(
    list: LineUpInfo,
    opts?: { titulo?: string; pix?: string; valor?: string }
  ): string {
    if (!list) return "Erro: lista não encontrada.";

    const dia = String(list.data.getDate()).padStart(2, "0");
    const mes = String(list.data.getMonth() + 1).padStart(2, "0");

    const titulo = opts?.titulo ?? "⚽ CAMPO DO VIANA";
    const pix = opts?.pix ?? "fcjogasimples@gmail.com";
    const valor = opts?.valor ?? "R$ 14,00";

    let texto = `${titulo}\n${dia}/${mes} às ${list.horario}\nPix💲${pix}\nValor: ${valor}\n\n`;

    for (let i = 0; i < 16; i++) {
      const jogador = list.jogadores[i] || "";
      texto += `${i + 1} - ${jogador}\n`;
    }

    if (list.suplentes.length > 0) {
      texto += "\n--- SUPLENTES ---\n";
      list.suplentes.forEach((s, idx) => {
        texto += `${idx + 1} - ${s}\n`;
      });
    }

    return texto.trim();
  }

  argsFromMessage(message: Message): string[] {
    const commandParts = message.body.split('\n');
    return commandParts[0].split(' ').slice(1);
  }
}
