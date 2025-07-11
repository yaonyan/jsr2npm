import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { ClientToolDefinition } from "../shared/types.js";
export declare class ClientExecClient {
  private client: any;
  private clientId: any;
  private tools: any;
  private toolDefinitions: any;
  constructor(client: Client, clientId: string);
  /**
   * Register tools (store locally, will be sent to server on connect)
   */ registerTools(tools: ClientToolDefinition[]): void;
  /**
   * Override connect method to register tools after connection
   */ connect(transport: Parameters<Client["connect"]>[0]): Promise<void>;
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
export declare function createClientExecClient(client: Client, clientId: string): ClientExecClient & Client;
//# sourceMappingURL=client_exec_client.d.ts.map