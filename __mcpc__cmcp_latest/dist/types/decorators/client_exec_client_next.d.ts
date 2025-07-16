import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";
import { type JSONRPCMessage, type MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";
import type { ClientToolDefinition } from "../shared/types.js";
export declare class ToolAugmentingClient {
  private client: any;
  private clientId: any;
  private tools: any;
  private toolDefinitions: any;
  constructor(client: Client, clientId: string);
  /**
   * Register tools (store locally, will be sent to server on connect)
   */ registerTools(tools: ClientToolDefinition[]): void;
  /**
   * Intercept incoming tools
   */ interceptIncomingResponse(message: JSONRPCMessage, extra: MessageExtraInfo | undefined, originalOnMessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void): void;
  /**
   * Intercept outgoing tool calls
   */ interceptOutgoingRequest(message: JSONRPCMessage, options: TransportSendOptions, originalSend: (message: JSONRPCMessage, options?: TransportSendOptions) => Promise<void>, originalOnMessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void): Promise<void> | void;
  /**
   * Override connect method to register tools after connection
   */ connect(transport: Transport): Promise<void>;
  private registerToolsToServer: any;
  private handleExecutionNotification: any;
  /**
   * Get client status
   */ getStatus(): {
    clientId: string;
    toolCount: number;
    tools: string[];
    registeredToServer: boolean;
  };
}
export declare function createToolAugmentingClient(client: Client, clientId: string): ToolAugmentingClient & Client;
//# sourceMappingURL=client_exec_client_next.d.ts.map