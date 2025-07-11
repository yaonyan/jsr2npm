#!/usr/bin/env node

// node_modules/@mcpc/cmcp/decorators/client_exec_server.js
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
var ToolResponseRequestSchema = z.object({
  method: z.literal("proxy/tool_response"),
  params: z.object({
    id: z.string(),
    success: z.boolean(),
    result: z.unknown().optional(),
    error: z.string().optional()
  })
});
var ClientToolRegistrationRequestSchema = z.object({
  method: z.literal("client/register_tools"),
  params: z.object({
    clientId: z.string(),
    tools: z.array(z.object({
      name: z.string(),
      description: z.string(),
      inputSchema: z.record(z.unknown())
    }))
  })
});
var ClientExecServer = class {
  server;
  clientId;
  tools = /* @__PURE__ */ new Map();
  clientTools = /* @__PURE__ */ new Map();
  toolToClient = /* @__PURE__ */ new Map();
  useNamespacing = false;
  pendingRequests = /* @__PURE__ */ new Map();
  requestTimeoutMs = 3e4;
  constructor(server, clientId) {
    this.server = server;
    this.clientId = clientId;
    this.setupStandardHandlers();
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        const serverProp = target.server[prop];
        if (typeof serverProp === "function") {
          return serverProp.bind(target.server);
        }
        return serverProp;
      }
    });
  }
  /**
   * Calls a JSON-RPC method on the server.
   */
  getServerRequestHandler(method) {
    return this.server._requestHandlers.get(method)?.bind(this.server);
  }
  setupStandardHandlers() {
    const toolListHandler = this.getServerRequestHandler(ListToolsRequestSchema.shape.method.value);
    const toolCallHandler = this.getServerRequestHandler(CallToolRequestSchema.shape.method.value);
    this.server.setRequestHandler(ListToolsRequestSchema, (request, _extra) => {
      return this.listTools(toolListHandler, request, _extra);
    });
    this.server.setRequestHandler(CallToolRequestSchema, (request, _extra) => {
      return this.callTool(toolCallHandler, request, _extra);
    });
    this.server.setRequestHandler(ClientToolRegistrationRequestSchema, (request) => this.handleClientToolRegistration(request.params));
    this.server.setRequestHandler(ToolResponseRequestSchema, (request) => this.handleClientResponse(request.params));
  }
  /**
   * Enable or disable tool namespacing for multi-client isolation
   */
  setNamespacing(enabled) {
    this.useNamespacing = enabled;
  }
  /**
   * Generate tool name with optional namespacing
   */
  getToolName(clientId, toolName) {
    return this.useNamespacing ? `${clientId}:${toolName}` : toolName;
  }
  /**
   * Extract original tool name from namespaced name
   */
  getOriginalToolName(namespacedName) {
    if (this.useNamespacing && namespacedName.includes(":")) {
      return namespacedName.split(":").slice(1).join(":");
    }
    return namespacedName;
  }
  /**
   * Handle client tool registration
   */
  handleClientToolRegistration(params) {
    const { clientId, tools } = params;
    this.unregisterClientTools(clientId);
    const registeredTools = [];
    const conflicts = [];
    const clientToolNames = /* @__PURE__ */ new Set();
    for (const tool of tools) {
      const toolName = this.getToolName(clientId, tool.name);
      if (this.tools.has(toolName)) {
        const existingOwner = this.toolToClient.get(toolName);
        if (this.useNamespacing) {
          console.error(`Unexpected tool name conflict with namespacing: ${toolName}`);
          conflicts.push(tool.name);
          continue;
        } else {
          console.warn(`Tool ${tool.name} already exists, owned by client ${existingOwner}. Skipping registration for client ${clientId}`);
          conflicts.push(tool.name);
          continue;
        }
      }
      this.tools.set(toolName, {
        name: this.useNamespacing ? tool.name : toolName,
        description: this.useNamespacing ? `[${clientId}] ${tool.description}` : tool.description,
        inputSchema: tool.inputSchema
      });
      clientToolNames.add(toolName);
      registeredTools.push(tool.name);
      this.toolToClient.set(toolName, clientId);
    }
    this.clientTools.set(clientId, clientToolNames);
    if (conflicts.length > 0) {
      console.warn(`Client ${clientId} had ${conflicts.length} tool conflicts:`, conflicts);
    }
    return {
      status: "success",
      registeredTools,
      conflicts
    };
  }
  /**
   * Unregister all tools from a specific client
   */
  unregisterClientTools(clientId) {
    const clientToolNames = this.clientTools.get(clientId);
    if (clientToolNames) {
      for (const toolName of clientToolNames) {
        this.tools.delete(toolName);
        this.toolToClient.delete(toolName);
      }
      this.clientTools.delete(clientId);
    }
  }
  /**
   * Register tools (static registration for backward compatibility)
   */
  registerToolSchemas(tools) {
    for (const tool of tools) {
      const toolName = this.getToolName("server", tool.name);
      this.tools.set(toolName, {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      });
      this.toolToClient.set(toolName, "server");
    }
  }
  /**
   * Notify client to execute tool via notification
   */
  async notifyClientExecute(requestId, toolName, args) {
    const targetClientId = this.toolToClient.get(toolName);
    if (!targetClientId) {
      throw new Error(`No client found for tool: ${toolName}`);
    }
    if (targetClientId === "server") {
      throw new Error(`Server-owned tools cannot be executed remotely: ${toolName}`);
    }
    const originalToolName = this.getOriginalToolName(toolName);
    await this.server.notification({
      method: "proxy/execute_tool",
      params: {
        id: requestId,
        toolName: originalToolName,
        args,
        clientId: targetClientId
      }
    });
  }
  /**
   * Handle tool execution response from client
   */
  handleClientResponse(params) {
    const pending = this.pendingRequests.get(params.id);
    if (!pending) {
      throw new McpError(ErrorCode.InvalidRequest, "Request not found");
    }
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(params.id);
    if (params.success) {
      const result = {
        content: [
          {
            type: "text",
            text: typeof params.result === "string" ? params.result : JSON.stringify(params.result, null, 2)
          }
        ]
      };
      pending.resolve(result);
    } else {
      const errorResult = {
        content: [
          {
            type: "text",
            text: `Tool execution failed: ${params.error || "Unknown error"}`
          }
        ],
        isError: true
      };
      pending.resolve(errorResult);
    }
    return {
      status: "received"
    };
  }
  /**
   * List all tools
   */
  async listTools(toolListHandler, request, extra) {
    const { tools: serverTools } = await toolListHandler?.(request, extra) ?? {
      tools: []
    };
    const toolList = Array.from(this.tools.values());
    return Promise.resolve({
      tools: toolList.concat(serverTools)
    });
  }
  /**
   * Call tool
   */
  async callTool(toolCallHandler, request, extra) {
    const { name, arguments: args } = request.params;
    const tool = this.tools.get(name);
    if (!tool) {
      if (!toolCallHandler) {
        throw new McpError(ErrorCode.InvalidRequest, "Tool not found");
      }
      return toolCallHandler?.(request, extra);
    }
    const requestId = crypto.randomUUID();
    const resultPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new McpError(ErrorCode.InternalError, `Tool execution timeout for ${name}`));
      }, this.requestTimeoutMs);
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout
      });
    });
    try {
      await this.notifyClientExecute(requestId, name, args || {});
    } catch (error) {
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);
      }
      throw new McpError(ErrorCode.InternalError, `Failed to notify client: ${error}`);
    }
    return await resultPromise;
  }
  /**
   * Handle client disconnect
   */
  handleClientDisconnect(clientId) {
    this.unregisterClientTools(clientId);
  }
  /**
   * Set request timeout
   */
  setRequestTimeout(timeoutMs) {
    this.requestTimeoutMs = timeoutMs;
  }
  /**
   * Get status information
   */
  getStatus() {
    return {
      clientId: this.clientId,
      registeredTools: Array.from(this.tools.keys()),
      connectedClients: Array.from(this.clientTools.keys()),
      clientToolMapping: Object.fromEntries(Array.from(this.clientTools.entries()).map(([clientId, tools]) => [
        clientId,
        Array.from(tools)
      ])),
      pendingRequests: this.pendingRequests.size
    };
  }
  /**
   * Clean up resources
   */
  cleanup() {
    for (const [_requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new McpError(ErrorCode.InternalError, "Server shutdown"));
    }
    this.pendingRequests.clear();
  }
};
function createClientExecServer(server, clientId) {
  return new ClientExecServer(server, clientId);
}

// node_modules/@mcpc/cmcp/decorators/client_exec_client.js
import { z as z2 } from "zod";
var ExecuteToolNotificationSchema = z2.object({
  method: z2.literal("proxy/execute_tool"),
  params: z2.object({
    id: z2.string(),
    toolName: z2.string(),
    args: z2.record(z2.unknown()),
    clientId: z2.string()
  })
});
var ToolResponseResultSchema = z2.object({
  status: z2.string()
});
var ClientToolRegistrationResultSchema = z2.object({
  status: z2.string(),
  registeredTools: z2.array(z2.string()),
  conflicts: z2.array(z2.string()).optional()
});
var ClientExecClient = class {
  client;
  clientId;
  tools = /* @__PURE__ */ new Map();
  toolDefinitions = [];
  constructor(client, clientId) {
    this.client = client;
    this.clientId = clientId;
    this.client.setNotificationHandler(ExecuteToolNotificationSchema, (notification) => this.handleExecutionNotification(notification.params));
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        const serverProp = target.client[prop];
        if (typeof serverProp === "function") {
          return serverProp.bind(target.client);
        }
        return serverProp;
      }
    });
  }
  /**
   * Register tools (store locally, will be sent to server on connect)
   */
  registerTools(tools) {
    this.toolDefinitions = tools;
    for (const tool of tools) {
      this.tools.set(tool.name, tool.implementation);
    }
  }
  /**
   * Override connect method to register tools after connection
   */
  async connect(transport) {
    await this.client.connect(transport);
    if (this.toolDefinitions.length > 0) {
      await this.registerToolsToServer();
    }
  }
  /**
   * Register tools to server
   */
  async registerToolsToServer() {
    try {
      const toolSchemas = this.toolDefinitions.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
      const result = await this.client.request({
        method: "client/register_tools",
        params: {
          clientId: this.clientId,
          tools: toolSchemas
        }
      }, ClientToolRegistrationResultSchema);
      console.log(`Successfully registered ${result.registeredTools.length} tools to server:`, result.registeredTools);
      if (result.conflicts && result.conflicts.length > 0) {
        console.warn(`Tool registration conflicts for ${result.conflicts.length} tools:`, result.conflicts);
      }
    } catch (error) {
      console.error("Failed to register tools to server:", error);
      throw error;
    }
  }
  /**
   * Handle tool execution notification from server
   */
  async handleExecutionNotification(params) {
    if (params.clientId !== this.clientId) {
      console.warn(`Received execution request for different client: ${params.clientId}, expected: ${this.clientId}`);
      return;
    }
    let success = false;
    let result;
    let error;
    try {
      const implementation = this.tools.get(params.toolName);
      if (!implementation) {
        throw new Error(`Tool ${params.toolName} not found in client ${this.clientId}`);
      }
      result = await implementation(params.args);
      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    try {
      await this.client.request({
        method: "proxy/tool_response",
        params: {
          id: params.id,
          success,
          result,
          error
        }
      }, ToolResponseResultSchema);
    } catch (responseError) {
      console.error("Failed to send tool response:", responseError);
    }
  }
  /**
   * Get client status
   */
  getStatus() {
    return {
      clientId: this.clientId,
      toolCount: this.tools.size,
      tools: Array.from(this.tools.keys()),
      registeredToServer: this.toolDefinitions.length > 0
    };
  }
};
function createClientExecClient(client, clientId) {
  return new ClientExecClient(client, clientId);
}

// node_modules/@mcpc/cmcp/transports/server/sse.js
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";

// node_modules/@jsr/std__http/server_sent_event_stream.js
var NEWLINE_REGEXP = /\r\n|\r|\n/;
var encoder = new TextEncoder();
function assertHasNoNewline(value, varName, errPrefix) {
  if (value.match(NEWLINE_REGEXP) !== null) {
    throw new SyntaxError(`${errPrefix}: ${varName} cannot contain a newline`);
  }
}
function stringify(message) {
  const lines = [];
  if (message.comment) {
    assertHasNoNewline(message.comment, "`message.comment`", "Cannot serialize message");
    lines.push(`:${message.comment}`);
  }
  if (message.event) {
    assertHasNoNewline(message.event, "`message.event`", "Cannot serialize message");
    lines.push(`event:${message.event}`);
  }
  if (message.data) {
    message.data.split(NEWLINE_REGEXP).forEach((line) => lines.push(`data:${line}`));
  }
  if (message.id) {
    assertHasNoNewline(message.id.toString(), "`message.id`", "Cannot serialize message");
    lines.push(`id:${message.id}`);
  }
  if (message.retry) lines.push(`retry:${message.retry}`);
  return encoder.encode(lines.join("\n") + "\n\n");
}
var ServerSentEventStream = class extends TransformStream {
  constructor() {
    super({
      transform: (message, controller) => {
        controller.enqueue(stringify(message));
      }
    });
  }
};

// node_modules/@mcpc/cmcp/transports/server/sse.js
var transportManager = /* @__PURE__ */ new Map();
async function handleConnecting(request, createMCPServer, incomingMsgRoutePath) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  if (sessionId) {
    const transport2 = transportManager.get(sessionId);
    if (transport2) {
      return transport2.sseResponse;
    }
    return new Response("Invalid or expired sessionId", {
      status: 404
    });
  }
  const transport = new SSEServerTransport(incomingMsgRoutePath);
  transportManager.set(transport.sessionId, transport);
  await createMCPServer().then((srv) => srv.connect(transport));
  console.log(`Created new SSE transport with sessionId: ${transport.sessionId}`);
  return transport.sseResponse;
}
async function handleIncoming(request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response("Missing sessionId parameter", {
      status: 400
    });
  }
  const transport = transportManager.get(sessionId);
  if (!transport) {
    return new Response("Invalid or expired sessionId", {
      status: 404
    });
  }
  if (!transport.isConnected) {
    return new Response("SSE connection not established", {
      status: 500
    });
  }
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return new Response("Unsupported content-type: Expected application/json", {
      status: 415
    });
  }
  try {
    return await transport.handlePostMessage(request);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(errorMessage, {
      status: 400
    });
  }
}
var SSEServerTransport = class {
  #sseResponse;
  #sessionId;
  #controller;
  #stream;
  #endpoint;
  onclose;
  onerror;
  onmessage;
  /**
   * Creates a new SSE server transport, which will direct the client to POST messages to the relative or absolute URL identified by `endpoint`.
   */
  constructor(endpoint) {
    this.#endpoint = endpoint;
    this.#sessionId = crypto.randomUUID();
    this.#stream = this.#createStream();
  }
  #createStream() {
    return new ReadableStream({
      start: (controller) => {
        this.#controller = controller;
      },
      cancel: (reason) => {
        console.log(`SSE stream cancelled with sessionId: ${this.#sessionId}`, reason);
        this.#cleanup();
      }
    }).pipeThrough(new ServerSentEventStream());
  }
  #cleanup() {
    this.#controller = void 0;
    this.#sseResponse = void 0;
    transportManager.delete(this.#sessionId);
    this.onclose?.();
  }
  /**
   * Handles the initial SSE connection request.
   *
   * This should be called when a GET request is made to establish the SSE stream.
   */
  start() {
    if (this.#sseResponse) {
      throw new Error("SSEServerTransport already started! If using Server class, note that connect() calls start() automatically.");
    }
    this.#controller?.enqueue({
      event: "endpoint",
      data: `${this.#endpoint}?sessionId=${this.#sessionId}`,
      id: Date.now().toString()
    });
    this.#sseResponse = new Response(this.#stream, {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
    return Promise.resolve();
  }
  /**
   * Handles incoming POST messages.
   *
   * This should be called when a POST request is made to send a message to the server.
   */
  async handlePostMessage(request) {
    if (!this.#sseResponse) {
      return new Response("SSE connection not established", {
        status: 500
      });
    }
    try {
      const contentType = request.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Unsupported content-type: ${contentType}`);
      }
      const body = await request.json();
      await this.handleMessage(body);
      return new Response("Accepted", {
        status: 202
      });
    } catch (error) {
      console.log(error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.onerror?.(errorObj);
      return new Response(String(error), {
        status: 400
      });
    }
  }
  /**
   * Handle a client message, regardless of how it arrived. This can be used to inform the server of messages that arrive via a means different than HTTP POST.
   */
  handleMessage(message) {
    try {
      const parsedMessage = JSONRPCMessageSchema.parse(message);
      this.onmessage?.(parsedMessage);
      return Promise.resolve();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.onerror?.(errorObj);
      return Promise.reject(error);
    }
  }
  close() {
    this.#controller?.close();
    return Promise.resolve();
  }
  send(message) {
    if (!this.#controller) {
      throw new Error("Not connected");
    }
    this.#controller.enqueue({
      data: JSON.stringify(message),
      event: "message",
      id: Date.now().toString()
    });
    return Promise.resolve();
  }
  /**
   * Returns the session ID for this transport.
   *
   * This can be used to route incoming POST requests.
   */
  get sessionId() {
    return this.#sessionId;
  }
  get sseStream() {
    return this.#stream;
  }
  get sseResponse() {
    return this.#sseResponse;
  }
  get isConnected() {
    return this.#controller !== void 0;
  }
};

// node_modules/@mcpc/cmcp/transports/client/web-worker.js
var WorkerTransport = class {
  worker;
  onclose;
  onerror;
  onmessage;
  sessionId;
  constructor(worker) {
    this.worker = worker;
    this.sessionId = crypto.randomUUID();
    this.worker.onmessage = (event) => {
      this.onmessage?.(event.data);
    };
    this.worker.onerror = (event) => {
      this.onerror?.(new Error(event.message));
    };
  }
  // For workers, the connection is implicitly "started" upon instantiation.
  start() {
    return Promise.resolve();
  }
  /**
   * Sends a message from the client (main thread) to the worker.
   */
  send(message) {
    try {
      this.worker.postMessage(message);
      return Promise.resolve();
    } catch (error) {
      this.onerror?.(error);
      return Promise.reject(error);
    }
  }
  /**
   * Closes the connection by terminating the worker.
   */
  close() {
    this.worker.terminate();
    this.onclose?.();
    return Promise.resolve();
  }
};

// node_modules/@mcpc/cmcp/transports/server/web-worker.js
var WorkerServerTransport = class {
  onclose;
  onerror;
  onmessage;
  sessionId;
  constructor() {
    this.sessionId = crypto.randomUUID();
    self.onmessage = (event) => {
      this.onmessage?.(event.data);
    };
  }
  /**
   * For a worker, the connection is always considered "started".
   */
  start() {
    return Promise.resolve();
  }
  /**
   * Sends a message from the Server (inside the worker) OUT to the main thread.
   */
  send(message) {
    try {
      self.postMessage(message);
      return Promise.resolve();
    } catch (error) {
      this.onerror?.(error);
      return Promise.reject(error);
    }
  }
  /**
   * Closing a worker is typically initiated by the main thread.
   * This method just triggers the callback.
   */
  close() {
    this.onclose?.();
    return Promise.resolve();
  }
};

// node_modules/@mcpc/cmcp/workers/client_exec_server_proxy.js
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
var runClientExecServerWoker = async () => {
  const server = createClientExecServer(new Server({
    name: "cmcp-server",
    version: "0.1.0"
  }, {
    capabilities: {
      tools: {}
    }
  }), "cmcp-server");
  await server.connect(new WorkerServerTransport());
  return server;
};
export {
  ClientExecClient,
  ClientExecServer,
  SSEServerTransport,
  WorkerServerTransport,
  WorkerTransport,
  createClientExecClient,
  createClientExecServer,
  handleConnecting,
  handleIncoming,
  runClientExecServerWoker
};
