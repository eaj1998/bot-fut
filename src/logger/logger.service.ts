import { injectable } from 'tsyringe';

@injectable()
export class LoggerService {
  private name: string = 'Unnamed';

  public log(...args: any[]) {
    console.log.apply(null, [`[${this.name}]`, ...args, new Date()]);
  }

  public setName(name: string) {
    this.name = name;
  }
}
