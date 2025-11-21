import { injectable } from 'tsyringe';

@injectable()
export class LoggerService {
  private name: string = 'Unnamed';

  public log(...args: any[]) {
    console.log(`[${this.name}]`, ...args, new Date());
  }

  public setName(name: string) {
    this.name = name;
  }

  public error(...args: any[]) {
    console.error(`[${this.name}]`, ...args, new Date());
  }

  public warn(...args: any[]) {
    console.warn(`[${this.name}]`, ...args, new Date());
  }

  public info(...args: any[]) {
    console.info(`[${this.name}]`, ...args, new Date());
  }
}
