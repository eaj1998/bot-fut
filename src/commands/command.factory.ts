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
import { UnbindCommand } from './admin/unbind.command';
import { CloseCommand } from './lineup/close.command';
import { ScheduleCommand } from './admin/schedule.command';
import { CancelCommand } from './lineup/cancel.command';
import { WorkspaceBalanceCommand } from './payment/workspaceBalance.command';
import { CreateBBQCommand } from './bbq/createBBQ.command';
import { JoinBBQCommand } from './bbq/joinBBQ.command';
import { GiveupBBQCommand } from './bbq/giveupBBQ.command';
import { GuestBBQCommand } from './bbq/guestBBQ.command';
import { PriceBBQCommand } from './bbq/priceBBQ.command';
import { CloseBBQCommand } from './bbq/closeBBQ.command';
import { PayBBQCommand } from './bbq/payBBQ.command';
import { CancelBBQCommand } from './bbq/cancelBBQ.command';
import { RandomizeTeamsCommand } from './lineup/randomizeTeams.command';
import { DebtsCommand } from './payment/debts.command';
import { SignupCommand } from './admin/signup.command';
import { RemoveCommand } from './lineup/remove.command';

@injectable()
export class CommandFactory {
  public create(command: string): Command | undefined {
    switch (command) {

      case '/cadastrar': return container.resolve(SignupCommand);
      case '/lista': return container.resolve(LineUpCreateCommand);
      case '/bora': return container.resolve(LineUpAddCommand);
      case '/goleiro': return container.resolve(GoalKeeperAddCommand);
      case '/desistir': return container.resolve(GiveUpCommand);
      case '/remover': return container.resolve(RemoveCommand);
      case '/convidado': return container.resolve(GuestCommand);
      case '/fora': return container.resolve(OutCommand);
      case '/pago': return container.resolve(PaymentCommand);
      case '/desmarcar': return container.resolve(UncheckPaymentCommand);
      case '/saldo': return container.resolve(WorkspaceBalanceCommand);
      case '/schedule': return container.resolve(ScheduleCommand);
      case '/marcar': return container.resolve(TagCommand);
      case '/joao':
      case '/pedro':
      case '/tailon':
      case '/andrei':
      case '/luan':
      case '/cleomar':
      case '/pedro-lgbt':
      case '/arthur':
        return container.resolve(StickerCommand);
      case '/help': return container.resolve(HelpCommand);
      case '/previsao': return container.resolve(WeatherCommand);
      case '/bind': return container.resolve(BindCommand);
      case '/unbind': return container.resolve(UnbindCommand);
      case '/fechar': return container.resolve(CloseCommand);
      case '/cancelar': return container.resolve(CancelCommand);
      case '/debitos': return container.resolve(DebtsCommand);
      //churras
      case '/lista-churras': return container.resolve(CreateBBQCommand);
      case '/churras': return container.resolve(JoinBBQCommand);
      case '/desistir-churras': return container.resolve(GiveupBBQCommand);
      case '/convidado-churras': return container.resolve(GuestBBQCommand);
      case '/valor-churras': return container.resolve(PriceBBQCommand);
      case '/fechar-churras': return container.resolve(CloseBBQCommand);
      case '/pagar-churras': return container.resolve(PayBBQCommand);
      case '/cancelar-churras': return container.resolve(CancelBBQCommand);
      case '/times': return container.resolve(RandomizeTeamsCommand);

      default: return undefined;
    }
  }
}
