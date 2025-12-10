import { container, injectable } from 'tsyringe';
import { LineUpAddCommand } from './lineup/add.command';
import { Command } from './type';
import { LineUpCreateCommand } from './lineup/create.command';
import { GoalKeeperAddCommand } from './lineup/goalkeeper.command';
import { GiveUpCommand } from './lineup/giveup.command';
import { GuestCommand } from './lineup/guest.command';
import { OutCommand } from './lineup/out.command';
import { PaymentCommand } from './payment/payment.command';
import { UncheckPaymentCommand } from './payment/uncheckPayment.command';
import { TagCommand } from './notification/tag.command';
import { StickerCommand } from './entertainment/sticker.command';
import { HelpCommand } from './help/help.command';
import { WeatherCommand } from './weather/weather.command';
import { BindCommand } from './admin/bind.command';
import { CloseCommand } from './lineup/close.command';
import { DebtsCommand } from './payment/debts.command';
import { ScheduleCommand } from './admin/schedule.command';
import { CancelCommand } from './lineup/cancel.command';
import { WorkspaceBalanceCommand } from './payment/workspaceBalance.command';
import { PayFieldCommand } from './payment/payField.command';
import { AddCreditCommand } from './payment/addCredit.command';
import { AddDebitCommand } from './payment/addDebit.command';
import { CreateBBQCommand } from './bbq/createBBQ.command';
import { JoinBBQCommand } from './bbq/joinBBQ.command';

@injectable()
export class CommandFactory {
  public create(command: string): Command | undefined {
    console.log('command', command);

    switch (command) {
      case '/lista': return container.resolve(LineUpCreateCommand);
      case '/bora': return container.resolve(LineUpAddCommand);
      case '/goleiro': return container.resolve(GoalKeeperAddCommand);
      case '/desistir': return container.resolve(GiveUpCommand);
      case '/convidado': return container.resolve(GuestCommand);
      case '/fora': return container.resolve(OutCommand);
      case '/pagar-campo': return container.resolve(PayFieldCommand);
      case '/adicionar-credito': return container.resolve(AddCreditCommand);
      case '/adicionar-debito': return container.resolve(AddDebitCommand);
      case '/pago': return container.resolve(PaymentCommand);
      case '/debitos': return container.resolve(DebtsCommand);
      case '/desmarcar': return container.resolve(UncheckPaymentCommand);
      case '/saldo': return container.resolve(WorkspaceBalanceCommand);
      case '/schedule': return container.resolve(ScheduleCommand);
      case '/marcar': return container.resolve(TagCommand);
      case '/joao': return container.resolve(StickerCommand);
      case '/help': return container.resolve(HelpCommand);
      case '/previsao': return container.resolve(WeatherCommand);
      case '/bind': return container.resolve(BindCommand);
      case '/fechar': return container.resolve(CloseCommand);
      case '/cancelar': return container.resolve(CancelCommand);
      //churras
      case '/lista-churras': return container.resolve(CreateBBQCommand);
      case '/churras': return container.resolve(JoinBBQCommand);

      default: return undefined;
    }
  }
}
