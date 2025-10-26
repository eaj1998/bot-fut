import { singleton } from "tsyringe";

@singleton()
export class LineUpRepository {
  listasAtuais: {[key: string]: {
    jogadores: (string | null)[],
    suplentes: string[],
    data: Date,
    horario: string
  }} = {};
}