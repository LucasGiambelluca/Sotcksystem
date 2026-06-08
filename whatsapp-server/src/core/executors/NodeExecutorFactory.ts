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
import { GroqExecutor } from './GroqExecutor';
import { LocationValidatorExecutor } from './LocationValidatorExecutor';
import { IntentResolverExecutor } from './IntentResolverExecutor';
import { OrderValidatorExecutor } from './OrderValidatorExecutor';
import { ClearCartExecutor } from './ClearCartExecutor';
import { ProductSearchExecutor } from './ProductSearchExecutor';
import { AudioToTextExecutor } from './AudioToTextExecutor';
import { AIAgentExecutor } from './AIAgentExecutor';
import { MediaTypeDetectorExecutor } from './MediaTypeDetectorExecutor';
import { WebhookExecutor } from './WebhookExecutor';
import { BufferMemoryExecutor } from './BufferMemoryExecutor';
import { KeywordExecutor } from './KeywordExecutor';
import { SwitchExecutor } from './SwitchExecutor';
import { TextSplitterExecutor } from './TextSplitterExecutor';
import { ArraySwitchExecutor } from './ArraySwitchExecutor';

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
    this.register('groqNode', new GroqExecutor());
    this.register('orderStatusNode', new OrderStatusExecutor());
    this.register('locationValidatorNode', new LocationValidatorExecutor());
    this.register('intentResolverNode', new IntentResolverExecutor());
    this.register('orderValidatorNode', new OrderValidatorExecutor());
    this.register('clearCartNode', new ClearCartExecutor());
    this.register('productSearchNode', new ProductSearchExecutor());
    this.register('audioTranscriberNode', new AudioToTextExecutor());
    this.register('audioToTextNode', new AudioToTextExecutor());
    this.register('aiAgentNode', new AIAgentExecutor());
    this.register('mediaTypeDetectorNode', new MediaTypeDetectorExecutor());
    this.register('mediaDetectorNode', new MediaTypeDetectorExecutor());
    this.register('webhookNode', new WebhookExecutor());
    this.register('bufferMemoryNode', new BufferMemoryExecutor());
    this.register('keywordNode', new KeywordExecutor());
    this.register('switchNode', new SwitchExecutor());
    this.register('textSplitterNode', new TextSplitterExecutor());
    this.register('arraySwitchNode', new ArraySwitchExecutor());

    
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
      console.warn(`[NodeExecutorFactory] No executor for type "${type}": using no-op pass-through.`);
      const noop: NodeExecutor = {
        async execute() {
          return { messages: [], wait_for_input: false };
        },
      };
      this.executors.set(type, noop); // cache so the warn fires only once per type
      return noop;
    }
    return executor;
  }
}

export const nodeExecutorFactory = new NodeExecutorFactory();
