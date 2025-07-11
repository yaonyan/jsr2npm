import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { type CallToolRequest, type CallToolResult, type ListToolsRequest, type ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ClientToolDefinition } from "../shared/types.js";
export declare const ToolResponseRequestSchema: z.ZodObject<{
  method: z.ZodLiteral<"proxy/tool_response">;
  params: z.ZodObject<{
    id: z.ZodString;
    success: z.ZodBoolean;
    result: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
  }>;
}>;
export declare const ClientToolRegistrationRequestSchema: z.ZodObject<{
  method: z.ZodLiteral<"client/register_tools">;
  params: z.ZodObject<{
    clientId: z.ZodString;
    tools: z.ZodArray<z.ZodObject<{
      name: z.ZodString;
      description: z.ZodString;
      inputSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }>>;
  }>;
}>;
export declare class ClientExecServer {
  private server: any;
  private clientId: any;
  private tools: any;
  private clientTools: any;
  private toolToClient: any;
  private useNamespacing: any;
  private pendingRequests: any;
  private requestTimeoutMs: any;
  constructor(server: Server, clientId: string);
  private getServerRequestHandler: any;
  private setupStandardHandlers: any;
  /**
   * Enable or disable tool namespacing for multi-client isolation
   */ setNamespacing(enabled: boolean): void;
  private getToolName: any;
  private getOriginalToolName: any;
  /**
   * Handle client tool registration
   */ handleClientToolRegistration(params: {
    clientId: string;
    tools: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>;
  }): {
    status: string;
    registeredTools: string[];
    conflicts: string[];
  };
  /**
   * Unregister all tools from a specific client
   */ unregisterClientTools(clientId: string): void;
  /**
   * Register tools (static registration for backward compatibility)
   */ registerToolSchemas(tools: ClientToolDefinition[]): void;
  private notifyClientExecute: any;
  /**
   * Handle tool execution response from client
   */ handleClientResponse(params: {
    id: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }): {
    status: string;
  };
  /**
   * List all tools
   */ listTools(toolListHandler: ((request: ListToolsRequest, extra?: unknown) => Promise<ListToolsResult>) | undefined, request: ListToolsRequest, extra: unknown): Promise<ListToolsResult>;
  /**
   * Call tool
   */ callTool(toolCallHandler: ((request: CallToolRequest, extra?: unknown) => Promise<CallToolResult>) | undefined, request: CallToolRequest, extra?: unknown): Promise<CallToolResult>;
  /**
   * Handle client disconnect
   */ handleClientDisconnect(clientId: string): void;
  /**
   * Set request timeout
   */ setRequestTimeout(timeoutMs: number): void;
  /**
   * Get status information
   */ getStatus(): {
    clientId: string;
    registeredTools: string[];
    connectedClients: string[];
    clientToolMapping: Record<string, string[]>;
    pendingRequests: number;
  };
  /**
   * Clean up resources
   */ cleanup(): void;
}
export declare function createClientExecServer(server: Server, clientId: string): ClientExecServer & Server;
//# sourceMappingURL=client_exec_server.d.ts.map