import { NodeExecutor } from './types';
import { MessageExecutor } from './MessageExecutor';
import { QuestionExecutor } from './QuestionExecutor';
import { PollExecutor } from './PollExecutor';
import { CatalogExecutor } from './CatalogExecutor';
import { SlotExecutor } from './SlotExecutor';
import { CreateOrderExecutor } from './CreateOrderExecutor';
import { ConditionExecutor } from './ConditionExecutor';
import { FlowLinkExecutor } from './FlowLinkExecutor';
import { MediaUploadExecutor } from './MediaUploadExecutor';
import { DocumentExecutor } from './DocumentExecutor';
import { ThreadManagerExecutor } from './ThreadManagerExecutor';
import { OrderSummaryExecutor } from './OrderSummaryExecutor';
import { TimerExecutor } from './TimerExecutor';
import { StartNodeExecutor } from './StartNodeExecutor';
import { ReportExecutor } from './ReportExecutor';
import { StockCheckExecutor } from './StockCheckExecutor';
import { AddToCartExecutor } from './AddToCartExecutor';
import { OrderStatusExecutor } from './OrderStatusExecutor';
import { HandoverExecutor } from './HandoverExecutor';
import { BusinessHoursExecutor } from './BusinessHoursExecutor';
import { SendCatalogExecutor } from './SendCatalogExecutor';
import { SendMediaExecutor } from './SendMediaExecutor';

export class NodeExecutorFactory {
  private executors = new Map<string, NodeExecutor>();

  constructor() {
    this.register('messageNode', new MessageExecutor());
    this.register('questionNode', new QuestionExecutor());
    this.register('pollNode', new PollExecutor());
    this.register('catalogNode', new CatalogExecutor());
    this.register('slotNode', new SlotExecutor());
    this.register('createOrderNode', new CreateOrderExecutor());
    this.register('orderSummaryNode', new OrderSummaryExecutor());
    this.register('conditionNode', new ConditionExecutor());
    this.register('flowLinkNode', new FlowLinkExecutor());
    this.register('mediaUploadNode', new MediaUploadExecutor());
    this.register('documentNode', new DocumentExecutor());
    this.register('threadNode', new ThreadManagerExecutor());
    this.register('timerNode', new TimerExecutor());
    this.register('reportNode', new ReportExecutor());
    this.register('stockCheckNode', new StockCheckExecutor());
    this.register('addToCartNode', new AddToCartExecutor());
    this.register('handoverNode', new HandoverExecutor());
    this.register('businessHoursNode', new BusinessHoursExecutor());
    this.register('sendCatalogNode', new SendCatalogExecutor());
    this.register('sendMediaNode', new SendMediaExecutor());
    this.register('orderStatusNode', new OrderStatusExecutor());
    
    // Start / Input nodes
    this.register('input', new StartNodeExecutor());
    this.register('start', new StartNodeExecutor());
    
    // Legacy support
    this.register('send_message', new MessageExecutor());
    this.register('wait_input', new QuestionExecutor());
  }

  private register(type: string, executor: NodeExecutor): void {
    this.executors.set(type, executor);
  }

  getExecutor(type: string): NodeExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`[NodeExecutorFactory] No executor found for type: ${type}`);
    }
    return executor;
  }
}

export const nodeExecutorFactory = new NodeExecutorFactory();
