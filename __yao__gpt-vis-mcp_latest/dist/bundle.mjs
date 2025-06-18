#!/usr/bin/env node
// node_modules/@yao/gpt-vis-mcp/stdio.server.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// node_modules/@yao/gpt-vis-mcp/app.js
import { generateId as generateId3, jsonSchema as jsonSchema3 } from "ai";

// node_modules/@jsr/mcpc__core/src/compose.js
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { jsonSchema as jsonSchema2 } from "ai";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Ajv } from "ajv";
import { AggregateAjvError } from "@segment/ajv-human-errors";
import addFormats from "ajv-formats";

// node_modules/@jsr/es-toolkit__es-toolkit/src/function/partial.js
function partial(func, ...partialArgs) {
  return partialImpl(func, placeholderSymbol, ...partialArgs);
}
function partialImpl(func, placeholder, ...partialArgs) {
  const partialed = function(...providedArgs) {
    let providedArgsIndex = 0;
    const substitutedArgs = partialArgs.slice().map((arg) => arg === placeholder ? providedArgs[providedArgsIndex++] : arg);
    const remainingArgs = providedArgs.slice(providedArgsIndex);
    return func.apply(this, substitutedArgs.concat(remainingArgs));
  };
  if (func.prototype) {
    partialed.prototype = Object.create(func.prototype);
  }
  return partialed;
}
var placeholderSymbol = Symbol("partial.placeholder");
partial.placeholder = placeholderSymbol;

// node_modules/@jsr/es-toolkit__es-toolkit/src/function/partialRight.js
function partialRight(func, ...partialArgs) {
  return partialRightImpl(func, placeholderSymbol2, ...partialArgs);
}
function partialRightImpl(func, placeholder, ...partialArgs) {
  const partialedRight = function(...providedArgs) {
    const placeholderLength = partialArgs.filter((arg) => arg === placeholder).length;
    const rangeLength = Math.max(providedArgs.length - placeholderLength, 0);
    const remainingArgs = providedArgs.slice(0, rangeLength);
    let providedArgsIndex = rangeLength;
    const substitutedArgs = partialArgs.slice().map((arg) => arg === placeholder ? providedArgs[providedArgsIndex++] : arg);
    return func.apply(this, remainingArgs.concat(substitutedArgs));
  };
  if (func.prototype) {
    partialedRight.prototype = Object.create(func.prototype);
  }
  return partialedRight;
}
var placeholderSymbol2 = Symbol("partialRight.placeholder");
partialRight.placeholder = placeholderSymbol2;

// node_modules/@jsr/es-toolkit__es-toolkit/src/function/retry.js
var DEFAULT_RETRIES = Number.POSITIVE_INFINITY;

// node_modules/@jsr/es-toolkit__es-toolkit/src/object/pick.js
function pick(obj, keys) {
  const result = {};
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (Object.hasOwn(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

// node_modules/@jsr/es-toolkit__es-toolkit/src/string/deburr.js
var deburrMap = new Map(
  // eslint-disable-next-line no-restricted-syntax
  Object.entries({
    \u00C6: "Ae",
    \u00D0: "D",
    \u00D8: "O",
    \u00DE: "Th",
    \u00DF: "ss",
    \u00E6: "ae",
    \u00F0: "d",
    \u00F8: "o",
    \u00FE: "th",
    \u0110: "D",
    \u0111: "d",
    \u0126: "H",
    \u0127: "h",
    \u0131: "i",
    \u0132: "IJ",
    \u0133: "ij",
    \u0138: "k",
    \u013F: "L",
    \u0140: "l",
    \u0141: "L",
    \u0142: "l",
    \u0149: "'n",
    \u014A: "N",
    \u014B: "n",
    \u0152: "Oe",
    \u0153: "oe",
    \u0166: "T",
    \u0167: "t",
    \u017F: "s"
  })
);

// node_modules/@jsr/mcpc__core/src/utils/state.js
var WorkflowState = class {
  currentStepIndex = -1;
  steps = [];
  isInitialized = false;
  isStarted = false;
  constructor(steps) {
    if (steps) {
      this.initialize(steps);
    }
  }
  getCurrentStepIndex() {
    return this.currentStepIndex;
  }
  getSteps() {
    return this.steps;
  }
  isWorkflowInitialized() {
    return this.isInitialized;
  }
  getCurrentStep() {
    if (!this.isInitialized || this.currentStepIndex < 0) {
      return null;
    }
    return this.steps[this.currentStepIndex] || null;
  }
  getNextStep() {
    if (!this.isInitialized) return null;
    const nextIndex = this.currentStepIndex + 1;
    return this.steps[nextIndex] || null;
  }
  // Get the previous step in the workflow
  getPreviousStep() {
    if (!this.isInitialized) return null;
    const prevIndex = this.currentStepIndex - 1;
    return this.steps[prevIndex] || null;
  }
  hasNextStep() {
    return this.getNextStep() !== null;
  }
  // Check if there is a previous step available
  hasPreviousStep() {
    return this.getPreviousStep() !== null;
  }
  // Check if currently at the first step
  isAtFirstStep() {
    return this.isInitialized && this.currentStepIndex === 0;
  }
  isWorkflowStarted() {
    return this.isStarted;
  }
  isCompleted() {
    return this.isInitialized && this.currentStepIndex >= this.steps.length - 1;
  }
  initialize(steps) {
    this.steps = steps;
    this.currentStepIndex = 0;
    this.isInitialized = true;
  }
  start() {
    this.isStarted = true;
  }
  moveToNextStep() {
    if (!this.hasNextStep()) {
      return false;
    }
    this.currentStepIndex++;
    return true;
  }
  // Move to the previous step in the workflow
  moveToPreviousStep() {
    if (!this.hasPreviousStep()) {
      return false;
    }
    this.currentStepIndex--;
    return true;
  }
  // Move to a specific step by index (optional feature)
  moveToStep(stepIndex) {
    if (!this.isInitialized || stepIndex < 0 || stepIndex >= this.steps.length) {
      return false;
    }
    this.currentStepIndex = stepIndex;
    return true;
  }
  reset() {
    this.currentStepIndex = -1;
    this.steps = [];
    this.isInitialized = false;
  }
  getDebugInfo() {
    return {
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.steps.length,
      isInitialized: this.isInitialized,
      currentStep: this.getCurrentStep()?.description,
      nextStep: this.getNextStep()?.description,
      previousStep: this.getPreviousStep()?.description,
      isAtFirstStep: this.isAtFirstStep(),
      hasPreviousStep: this.hasPreviousStep()
    };
  }
};

// node_modules/@jsr/mcpc__core/src/utils/common/config.js
var GEMINI_PREFERRED_FORMAT = process.env.GEMINI_PREFERRED_FORMAT === "0" ? false : true;
var ENFORE_REASONING = process.env.ENFORE_REASONING === "1" ? true : false;

// node_modules/@jsr/mcpc__core/src/utils/common/json.js
import { jsonrepair } from "jsonrepair";
import { inspect } from "node:util";

// node_modules/@jsr/mcpc__core/src/utils/common/provider.js
var ToolNameRegex = /^[a-zA-Z0-9_-]{1,64}$/;
var createGoogleCompatibleJSONSchema = (schema) => {
  if (!GEMINI_PREFERRED_FORMAT) {
    return schema;
  }
  const { oneOf, allOf, anyOf, ...cleanSchema } = schema;
  const removeAdditionalProperties = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(removeAdditionalProperties);
    }
    if (obj && typeof obj === "object") {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key !== "additionalProperties") {
          result[key] = removeAdditionalProperties(value);
        }
      }
      return result;
    }
    return obj;
  };
  return removeAdditionalProperties(cleanSchema);
};

// node_modules/@jsr/mcpc__core/src/utils/actions.js
import { jsonSchema } from "ai";
var toolNameToSchema = (actions) => {
  return Object.fromEntries(Object.entries(actions).map(([key, tool]) => [
    key,
    tool.parameters.jsonSchema
  ]));
};
var internalActions = {
  reasoning: {
    parameters: jsonSchema({
      type: "object",
      properties: {
        context: {
          type: "string",
          description: "First, clearly identify what the problem is asking and what information you have available"
        },
        analysis: {
          type: "string",
          description: "Break down the problem step by step. Show your logical reasoning process, calculations, or decision-making steps"
        },
        conclusion: {
          type: "string",
          description: "State your final answer clearly and explain why this conclusion follows from your analysis"
        }
      },
      required: [
        "context",
        "analysis",
        "conclusion"
      ]
    }),
    description: `Use this tool to think through complex problems systematically. You MUST:
    1. First understand the context and what's being asked
    2. Show detailed step-by-step analysis 
    3. Reach a clear conclusion based on your reasoning`,
    execute: async ({ context, analysis, conclusion }) => {
      return {
        content: [
          {
            type: "text",
            text: "Reasoning process documented"
          }
        ]
      };
    }
  }
};

// node_modules/@jsr/mcpc__core/src/compose.js
var TOOLS_PLACEHOLDER = "__ALL__";
var NEXT_ACTION_KEY = "nextAction";
var ACTION_KEY = "action";
var ajv = new Ajv({
  allErrors: true,
  verbose: true
});
addFormats(ajv);
var ComposableMCPServer = class extends Server {
  tools = [];
  nameToCb = /* @__PURE__ */ new Map();
  constructor(_serverInfo, options) {
    super(_serverInfo, options);
  }
  tool(name, description, paramsSchema, cb) {
    const tools2 = [
      ...this.tools,
      {
        name,
        description,
        inputSchema: paramsSchema.jsonSchema
      }
    ];
    this.tools = tools2;
    this.nameToCb.set(name, cb);
    this.setRequestHandler(ListToolsRequestSchema, () => {
      return {
        tools: this.tools
      };
    });
    this.setRequestHandler(CallToolRequestSchema, (request, extra) => {
      const { name: n, arguments: args } = request.params;
      return this.nameToCb.get(n)?.(args, extra);
    });
  }
  async compose(name, description, depsConfig, options = {
    mode: "agentic"
  }) {
    const { tagToResults, $ } = parseTags(description, [
      "tool",
      "fn"
    ]);
    const tools2 = await composeMcpDepTools(depsConfig, ({ mcpName, toolNameWithScope, toolId }) => {
      const matchingStep = options.steps?.find((step) => step.actions.includes(toolNameWithScope));
      if (matchingStep) {
        const actionIndex = matchingStep.actions.indexOf(toolNameWithScope);
        if (actionIndex !== -1) {
          matchingStep.actions[actionIndex] = toolId;
        }
        return true;
      }
      return tagToResults.tool.find((tool) => {
        const selectAll = tool.attribs.name === `${mcpName}.${TOOLS_PLACEHOLDER}`;
        description = description.replace($(tool).prop("outerHTML"), `<action ${ACTION_KEY}="${toolId}"/>`);
        if (selectAll) {
          return true;
        }
        return tool.attribs.name === toolNameWithScope;
      });
    });
    const toolNameToDetailList = Object.entries(tools2);
    const allToolNames = toolNameToDetailList.map(([name2]) => name2);
    console.log(`[${name}][composed tools] ${Object.keys(tools2)}`);
    const depGroups = toolNameToDetailList.flatMap(([toolName, tool]) => {
      if (!tool) {
        throw new Error(`Action ${toolName} not found, available action list: ${allToolNames.join(", ")}`);
      }
      const baseSchema = tool.inputSchema || {
        type: "object",
        properties: {},
        required: []
      };
      const baseProperties = baseSchema.type === "object" && baseSchema.properties ? baseSchema.properties : {};
      const baseRequired = baseSchema.type === "object" && baseSchema.required ? baseSchema.required : [];
      return {
        [toolName]: {
          type: "object",
          description: tool.description,
          properties: {
            ...baseProperties
          },
          required: [
            ...baseRequired
          ],
          additionalProperties: false
        }
      };
    }).reduce((acc, cur) => ({
      ...acc,
      ...cur
    }), {});
    switch (options.mode) {
      case "agentic":
        await this.registerTool({
          description,
          name,
          allToolNames,
          depGroups,
          toolNameToDetailList
        });
        return;
      case "agentic_workflow":
        await this.registerAgenticWorkflowTool({
          description,
          name,
          allToolNames,
          depGroups,
          toolNameToDetailList,
          predefinedSteps: options.steps
        });
        return;
    }
  }
  async registerAgenticWorkflowTool({ description, name, allToolNames, depGroups, toolNameToDetailList, predefinedSteps }) {
    const createArgsDef = {
      common: (extra) => ({
        type: "object",
        description: `**Tool arguments structured according to the step's JSON Schema definition; it's DYNAMIC and will update for each step**`,
        properties: {
          ...extra
        },
        required: Object.keys(extra)
      }),
      steps: () => ({
        type: "array",
        description: `
An array of step objects that defines the complete sequence of actions for a workflow. This array should be provided only on the initial call, unless a workflow restart is required.

CRITICAL:
-   **Workflow as a Sequence of States**: Steps MUST be organized to reflect the workflow's logical sequence. Each step represents a distinct phase.
-   **Sequential Dependency Rule**: If Action B depends on the outcome of Action A, they MUST be in separate, sequential steps (A in Step N, B in Step N+1).
-   **Concurrent Action Rule**: All actions within a single step are considered independent and MUST be executable concurrently.
-   **Action Fidelity Rule**: The set of generated actions MUST be a complete and faithful one-to-one mapping of the operations requested in the user's description. Do NOT omit requested ones.
-   **Predefined steps**: MUST remain unspecified if predefined steps are present

BEST PRACTICES:
-   **Atomicity**: A step should be as atomic as possible.
-   **Idempotency**: Actions should be designed to be idempotent for safe retries.
-   **Clarity over Brevity**: Prefer more, smaller, focused steps over fewer, complex ones.`,
        items: {
          type: "object",
          description: `A single step containing actions that execute concurrently. All actions in this step run simultaneously with no guaranteed order.
        `,
          properties: {
            description: {
              type: "string",
              description: `**Describes what a step does, what it needs from previous steps or context, and what it outputs.**`
            },
            actions: {
              type: "array",
              description: `Array of action names that execute concurrently in this step.`,
              items: {
                type: "string",
                enum: allToolNames?.concat(Object.keys(internalActions)),
                // TODO: Does the model need to know tool arguments to fully understand the purpose?
                description: `Individual action name from available actions
Available actions:
${Object.entries(internalActions).map(([name2, { description: description2 }]) => `- \`${name2}\`: ${description2}
`)}
${toolNameToDetailList.map(([name2, { description: description2 }]) => `- \`${name2}\`: ${description2}
`)}`
              },
              uniqueItems: true,
              minItems: 1,
              // TODO: remove this restriction when workflow planning is good enough
              maxItems: 1,
              examples: [
                [
                  "reasoning"
                ]
              ]
            }
          },
          required: [
            "description",
            "actions"
          ],
          additionalProperties: false
        },
        default: predefinedSteps ? predefinedSteps : void 0,
        minItems: 1
      }),
      init: () => ({
        type: "boolean",
        description: `Init a new workflow`,
        enum: [
          true
        ]
      }),
      proceed: () => ({
        type: "boolean",
        description: "**Controls step execution flow. MUST be set to `true` to advance to the next step. If omitted or false, this step will be re-executed with the provided arguments**"
      }),
      forTool: () => {
        return createArgsDef.common({});
      },
      forCurrentState: (state) => {
        if (!state.isWorkflowInitialized()) {
          if (predefinedSteps) {
            return createArgsDef.common({
              init: createArgsDef.init()
            });
          }
          return createArgsDef.common({
            steps: createArgsDef.steps(),
            init: createArgsDef.init()
          });
        }
        const currentStep = state.getCurrentStep();
        if (!currentStep) {
          throw new Error(`Invalid workflow state: no current step, ${JSON.stringify(state.getDebugInfo())}`);
        }
        const stepDependencies = {
          ...pick(toolNameToSchema(internalActions), currentStep.actions),
          ...pick(depGroups, currentStep.actions)
        };
        stepDependencies["proceed"] = createArgsDef.proceed();
        return createArgsDef.common(stepDependencies);
      },
      forNextState: (state) => {
        if (!state.isWorkflowInitialized() || !state.hasNextStep()) {
          throw new Error(`Cannot get next state schema: no next step available`);
        }
        const currentStepIndex = state.getCurrentStepIndex();
        const allSteps = state.getSteps();
        const nextStep = allSteps[currentStepIndex + 1];
        if (!nextStep) {
          throw new Error(`Next step not found`);
        }
        const stepDependencies = {
          ...pick(toolNameToSchema(internalActions), nextStep.actions),
          ...pick(depGroups, nextStep.actions)
        };
        stepDependencies["proceed"] = createArgsDef.proceed();
        return createArgsDef.common(stepDependencies);
      },
      forToolDescription: (description2, state) => {
        const enforceToolArgs = createArgsDef.forCurrentState(state);
        const title = predefinedSteps ? `**YOU MUST execute this tool with following tool arguments to init the workflow**
NOTE: The \`steps\` has been predefined` : `**You MUST execute this tool with following tool arguments to plan and init the workflow**`;
        return `${description2}
${title}
${JSON.stringify(enforceToolArgs, null, 2)}`;
      },
      forInitialStepDescription: (steps, state) => `Workflow initialized with ${steps.length} steps. You MUST start the workflow with the first step to \`${state.getCurrentStep()?.description}\`. 
              
## EXECUTE tool \`${name}\` with following new tool arguments

${JSON.stringify(createArgsDef.forCurrentState(state))}

## Important Instructions
- **Do NOT include 'steps' parameter in any subsequent tool calls**
- **MUST Use the provided JSON schema definition above for parameter generation and validation**
` + (predefinedSteps ?? ENFORE_REASONING ? `## Workflow Steps
${JSON.stringify(steps, null, 2)}` : "")
    };
    const executor = {
      async execute(args, state) {
        if (args.init) {
          state.reset();
        } else {
          if (!state.isWorkflowInitialized() && !args.init) {
            return {
              content: [
                {
                  type: "text",
                  text: predefinedSteps ? "Error: Workflow not initialized. Please provide 'init' parameter to start a new workflow." : `"Error: Workflow not initialized. Please provide 'init' and 'steps' parameter to start a new workflow."`
                }
              ],
              isError: true
            };
          }
          if (args.proceed === true) {
            if (!state.hasNextStep()) {
              return {
                content: [
                  {
                    type: "text",
                    text: "Error: Cannot proceed, you are already at the final step."
                  }
                ],
                isError: true
              };
            }
            if (state.isWorkflowStarted()) {
              state.moveToNextStep();
            } else {
              state.start();
            }
          }
        }
        const validationSchema = createArgsDef.forCurrentState(state);
        const validate = ajv.compile(validationSchema);
        if (!validate(args)) {
          const errors = new AggregateAjvError(validate.errors);
          return {
            content: [
              {
                type: "text",
                text: `Tool call arguments validation failed: ${errors.message}`
              }
            ],
            isError: true
          };
        }
        if (args.init) {
          return await this.initialize(args, state);
        }
        return await this.executeStep(args, state);
      },
      async initialize(args, state) {
        const steps = predefinedSteps ?? args.steps;
        if (!steps || steps.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No steps provided"
              }
            ],
            isError: true
          };
        }
        if (ENFORE_REASONING) {
          steps.unshift({
            description: "Initial reasoning - analyze input and plan approach using available context",
            actions: [
              "reasoning"
            ]
          });
          steps.push({
            description: "Final reasoning - synthesize results and validate against original objectives",
            actions: [
              "reasoning"
            ]
          });
        }
        state.initialize(steps);
        return {
          content: [
            {
              type: "text",
              text: createArgsDef.forInitialStepDescription(predefinedSteps ?? args.steps, state)
            }
          ],
          isError: false
        };
      },
      async executeStep(args, state) {
        const currentStep = state.getCurrentStep();
        if (!currentStep) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No current step to execute"
              }
            ],
            isError: true
          };
        }
        const results = {
          content: [],
          isError: false
        };
        for (const action of currentStep.actions) {
          try {
            const currentTool = toolNameToDetailList.find(([toolName]) => toolName === action)?.[1] ?? internalActions[action];
            if (!currentTool) {
              throw new Error(`Tool ${action} not found`);
            }
            const actionArgs = args[action] || {};
            const actionResult = await currentTool.execute(actionArgs);
            if (!results.isError) {
              results.isError = actionResult.isError;
            }
            results.content.push({
              type: "text",
              text: `Action \`${action}\` excuted with result: `
            });
            results.content.push({
              type: "text",
              text: `${JSON.stringify(actionResult, null, 2)}`
            });
          } catch (error) {
            results.content.push({
              type: "text",
              text: `Action \`${action}\` failed with error: `
            });
            results.content.push({
              type: "text",
              text: `${error.message}`
            });
            results.isError = true;
          }
        }
        if (state.hasNextStep()) {
          const nextStepArgsDef = createArgsDef.forNextState(state);
          results.content.push({
            type: "text",
            text: `You **MUST** decide whether to proceed to the next step to \`${state.getNextStep()?.description}\`.
To retry, **You MUST EXECUTE tool \`${name}\` with current step's arguments
To proceed, You MUST EXECUTE tool \`${name}\` with the following tool arguments, ensuring the proceed parameter is set to true:

${JSON.stringify(nextStepArgsDef, null, 2)}

**Instructions:**
- Analyze the previous action's result carefully
- Determine if the next step is necessary and appropriate
- **Exclude the \`steps\` key from your generated parameters**`
          });
        } else {
          results.content.push({
            type: "text",
            text: `Workflow completed. All steps have been executed.

The result of the final step is shown above. Based on this result, please choose your next action from the options below:

1.  **\u2705 Conclude and Finish:** If the result meets all expectations, provide the final answer or summary to the user directly. **Do not call this tool again.**

2.  **\u{1F504} Retry the Final Step:** If the result of the final step is unsatisfactory or incorrect, you **CAN retry it** by calling this tool again with the required arguments for this last step.

3.  **\u{1F195} Start a New Workflow:** If you need to start a brand new task from scratch, you **MUST** call this tool to initialize a new workflow`
          });
        }
        return results;
      }
    };
    const workflowState = new WorkflowState();
    const toolDescription = `This is an autonomous agent tool named \`${name}\` that fulfills user requests through a structured multi-step workflow.

**Instructions:**
\`\`\`txt
${description}
\`\`\`

**WORKFLOW PHASES:**

**Phase 1 - PLANNING (First Call Only):**
- **If predefined steps exist, do NOT specify \`steps\`**
- Analyze user request and instructions
- Generate complete workflow with ALL steps
- Set \`init\` to true

**Phase 2 - EXECUTION (All Subsequent Calls):**
- **CRITICAL: NEVER include 'steps' field in response**
- **ONLY provide current step execution parameters**
- Use "reasoning" action when thinking/planning is needed

**STRICT RULE: After first call, 'steps' field is FORBIDDEN, keep executing steps sequentially until the final step is completed**`;
    this.tool(name, createArgsDef.forToolDescription(toolDescription, workflowState), jsonSchema2(createGoogleCompatibleJSONSchema(createArgsDef.forTool())), async (args) => {
      try {
        return await executor.execute(args, workflowState);
      } catch (error) {
        workflowState.reset();
        return {
          content: [
            {
              type: "text",
              text: `Workflow execution error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }
  async registerTool({ description, name, allToolNames, depGroups, toolNameToDetailList }) {
    description = `Context: This is the autonomous MCP tool \`${name}\`. It fulfills user instructions by orchestrating actions via **iterative self-invocation(\`${name}\`)**.

# User Instructions: ${description}

# Action Execution Protocol

The MCP tool executes actions in a multi-step process. Follow these steps for each iteration:

* Do not treat actions merely as simple tool calls.
* Always execute actions via this protocol. Do NOT attempt direct, unstructured calls.

1.  **Determine Current Action:** Based on user instructions, overall task goal, and prior results, identify the *single most appropriate action* for this step.
2.  **Anticipate Next Action (if any):** Plan and anticipate the likely *next action* needed to complete the task after the current step.

# Available Actions

**WARNING:** ONLY call or execute actions from this list. DO NOT attempt to call or execute actions not explicitly listed here.
${allToolNames.join(", ")}
`;
    const allOf = toolNameToDetailList.map(([toolName]) => {
      return {
        if: {
          properties: {
            [ACTION_KEY]: {
              const: toolName
            }
          },
          required: [
            ACTION_KEY
          ]
        },
        then: {
          required: [
            toolName
          ]
        }
      };
    });
    const argsDef = {
      additionalProperties: false,
      allOf,
      type: "object",
      properties: {
        [ACTION_KEY]: {
          type: "string",
          enum: allToolNames,
          description: "Specifies the action to be performed from the enum. Based on the value chosen for 'action', the corresponding sibling property (which shares the same name as the action value and contains its specific parameters) **MUST** also be provided in this object. For example, if 'action' is 'get_weather', then the 'get_weather' parameter object is mandatory."
        },
        [NEXT_ACTION_KEY]: {
          type: "string",
          enum: allToolNames,
          description: "Specify the next action to execute only when the user\u2019s request requires additional steps. If no next action is needed, this property **MUST BE OMITTED** from the object."
        },
        ...depGroups
      },
      required: [
        ACTION_KEY
      ]
    };
    const validate = ajv.compile(argsDef);
    this.tool(name, description, jsonSchema2(createGoogleCompatibleJSONSchema(argsDef)), async (args) => {
      if (!validate(args)) {
        const errors = new AggregateAjvError(validate.errors);
        return {
          content: [
            {
              type: "text",
              text: `Tool/Function argument validation failed: ${errors.message}`
            }
          ],
          isError: true
        };
      }
      const currentTool = toolNameToDetailList.find(([name2]) => name2 === args[ACTION_KEY])?.[1];
      const action = args[ACTION_KEY];
      const nextAction = args[NEXT_ACTION_KEY];
      const currentResult = await currentTool.execute({
        ...args[action]
      });
      if (args[nextAction]) {
        currentResult?.content?.unshift({
          type: "text",
          text: `# You WILL call this tool(\`${name}\`) AGAIN using the \`${nextAction}\` action, after evaluating the result from previous action(${action}):`
        });
      } else {
        currentResult?.content?.unshift({
          type: "text",
          text: `# You WILL plan next action if the user request needs additional actions to be fulfilled, after evaluating the result from previous action(${action}):`
        });
      }
      return currentResult;
    });
  }
};

// node_modules/@jsr/mcpc__core/src/utils/common/env.js
import process2 from "node:process";
var isSCF = () => Boolean(process2.env.SCF_RUNTIME || process2.env.PROD_SCF);
if (isSCF()) {
  console.log({
    isSCF: isSCF(),
    SCF_RUNTIME: process2.env.SCF_RUNTIME
  });
}

// node_modules/@jsr/mcpc__core/src/utils/common/ai.js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { generateId } from "ai";
import { load } from "cheerio";

// node_modules/@jsr/mcpc__core/src/utils/common/registory.js
function smitheryToolNameCompatibale(name, scope) {
  if (!name.startsWith("toolbox_")) {
    return {
      toolNameWithScope: `${scope}.${name}`,
      toolName: name
    };
  }
  const [, ...toolNames] = name.split("_");
  const toolName = toolNames.join("_");
  const toolNameWithScope = `${scope}.${toolName}`;
  return {
    toolNameWithScope,
    toolName
  };
}

// node_modules/@jsr/mcpc__core/src/utils/common/ai.js
import { cwd } from "node:process";
function parseTags(htmlString, tags) {
  const $ = load(htmlString, {
    xml: {
      decodeEntities: false
    }
  });
  const tagToResults = {};
  for (const tag of tags) {
    const elements = $(tag);
    tagToResults[tag] = elements.toArray();
  }
  return {
    tagToResults,
    $
  };
}
async function composeMcpDepTools(mcpConfig, filterIn) {
  const allTools = {};
  for (const [name, defination] of Object.entries(mcpConfig.mcpServers)) {
    const def = defination;
    if (def.disabled) {
      continue;
    }
    let transport2;
    if (def.transportType === "sse") {
      transport2 = new SSEClientTransport(new URL(def.url));
    } else if ("url" in def) {
      transport2 = new StreamableHTTPClientTransport(new URL(def.url));
    } else if (def.transportType === "stdio" || "command" in def) {
      transport2 = new StdioClientTransport({
        command: def.command,
        args: def.args,
        env: {
          ...process.env,
          ...def.env
        },
        cwd: cwd()
      });
    } else {
      throw new Error(`Unsupported transport type: ${JSON.stringify(def)}`);
    }
    const client = new Client({
      name,
      version: "1.0.0"
    });
    const serverId = ToolNameRegex.test(name) ? name : generateId(7);
    try {
      await client.connect(transport2);
      const { tools: tools2 } = await client.listTools();
      tools2.forEach((tool) => {
        const { toolNameWithScope, toolName: internalToolName } = smitheryToolNameCompatibale(tool.name, name);
        const toolId = `${serverId}_${internalToolName}`;
        if (filterIn && !filterIn({
          action: internalToolName,
          tool,
          mcpName: name,
          toolNameWithScope,
          internalToolName,
          toolId
        })) {
          return;
        }
        const execute = (args) => client.callTool({
          name: internalToolName,
          arguments: args
        });
        tool.execute = execute;
        allTools[toolId] = tool;
      });
    } catch (error) {
      console.error(`Error creating MCP client for ${name}:`, error);
    }
  }
  return allTools;
}

// node_modules/@jsr/mcpc__core/src/utils/common/time.js
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);

// node_modules/@jsr/mcpc__core/src/schemas/error.js
import { z } from "@hono/zod-openapi";
var ErrorSchema = z.object({
  code: z.number().openapi({
    example: 400
  }),
  message: z.string().openapi({
    example: "Bad Request"
  })
});

// node_modules/@jsr/mcpc__core/src/schemas/wecom.js
import { z as z2 } from "@hono/zod-openapi";
var WecomIncomingParamsSchema = z2.object({
  user: z2.string().openapi({
    description: ""
  }),
  msg_type: z2.string().openapi({
    example: "text",
    description: "\u6D88\u606F\u7C7B\u578B\uFF0C\u76EE\u524D\u4EC5\u652F\u6301\u6587\u672C\u7C7B\u578B"
  }),
  content: z2.string().openapi({
    example: "\u4F60\u597D",
    description: "\u7528\u6237\u6D88\u606F\u6587\u672C\u5185\u5BB9"
  }),
  image_base64: z2.string().nullish().openapi({
    description: "\u56FE\u7247 base64 \u7F16\u7801, \u76EE\u524D\u4EC5\u652F\u6301\u7EAF\u56FE, \u65E0\u6CD5\u89E3\u6790 text+image"
  }),
  msg_id: z2.string().openapi({
    example: "",
    description: "\u7528\u6237\u6D88\u606FID\uFF0C\u5728\u5F02\u6B65\u6A21\u5F0F\u4E0B\u5411OpenAPI\u53D1\u9001\u6D88\u606F\u65F6\u9700\u8981"
  }),
  is_fuzzy: z2.number().nullish().openapi({
    example: 1,
    description: "TODO"
  }),
  fuzzy_question: z2.string().nullish().openapi({
    description: "TODO"
  }),
  raw_msg: z2.string().openapi({
    example: "{}",
    description: "\u6765\u81EA\u4F01\u4E1A\u5FAE\u4FE1\u7684\u89E3\u5BC6\u6D88\u606F\u56DE\u8C03"
  }),
  business_keys: z2.array(z2.string()).openapi({
    example: [
      "biz_key1"
    ],
    description: "\u670D\u52A1\u6807\u8BC6\u7B26"
  }),
  chat_history: z2.array(z2.string()).nullish().openapi({
    description: "\u804A\u5929\u5386\u53F2\u8BB0\u5F55"
  }),
  stream_id: z2.string().nullish().openapi({
    example: "1907777970212222222223",
    description: "\u6D41ID"
  }),
  platform_robot_info: z2.string().nullish().openapi({
    description: "\u5E73\u53F0\u673A\u5668\u4EBA\u4FE1\u606F"
  }),
  space_ids: z2.array(z2.string()).nullish().openapi({
    description: "\u7A7A\u95F4ID\u5217\u8868"
  }),
  doc_ids: z2.array(z2.string()).nullish().openapi({
    example: [
      "401340923333"
    ],
    description: "\u6587\u6863ID\u5217\u8868"
  }),
  source: z2.string().nullish().openapi({
    example: "ai_robot",
    description: "\u6765\u6E90"
  }),
  model_source: z2.string().nullish().openapi({
    example: "ai",
    description: "\u6A21\u578B\u6765\u6E90"
  }),
  mapping_type: z2.string().nullish().openapi({
    example: "business",
    description: "\u6620\u5C04\u7C7B\u578B"
  })
});
var WecomOutgoingSchema = z2.string().openapi({
  description: "\u8FD4\u56DE\u7ED9\u4F01\u4E1A\u5FAE\u4FE1\u7684\u6D41\u5F0F\u6D88\u606F",
  example: `event:delta
data:{"response": "\u4F60\u597D", "finished": false, "global_output":{}}

`
});
var WecomMessageRichText = z2.array(z2.object({
  type: z2.enum([
    "text",
    "link"
  ]).openapi({
    description: "\u5BCC\u6587\u672C\u7C7B\u578B\uFF0C\u53EF\u4EE5\u662Ftext\u6216link"
  }),
  text: z2.object({
    content: z2.string().openapi({
      description: "\u6587\u672C\u5185\u5BB9"
    })
  }).optional(),
  link: z2.object({
    type: z2.enum([
      "click",
      "view"
    ]).openapi({
      description: "\u94FE\u63A5\u7C7B\u578B\uFF0Cclick\u65F6\u7528\u6237\u70B9\u51FB\u540E\u4F1A\u56DE\u8C03key\uFF0Cview\u65F6\u7528\u6237\u70B9\u51FB\u540E\u7528\u6D4F\u89C8\u5668\u6253\u5F00url"
    }),
    text: z2.string().openapi({
      description: "\u94FE\u63A5\u663E\u793A\u7684\u6587\u672C"
    }),
    key: z2.string().openapi({
      description: "\u94FE\u63A5URL"
    }),
    browser: z2.number().optional().openapi({
      description: "\u6D4F\u89C8\u5668\u6253\u5F00\u65B9\u5F0F\uFF0C\u53EF\u9009\u53C2\u6570"
    })
  }).optional()
})).openapi({
  description: "\u4F01\u4E1A\u5FAE\u4FE1\u6D88\u606F\u7684\u5BCC\u6587\u672C\u5185\u5BB9",
  example: [
    {
      type: "text",
      text: {
        content: "Holiday Request For Pony(http://xxxxx)"
      }
    },
    {
      type: "link",
      link: {
        type: "view",
        text: "KM",
        key: "http://example.com",
        browser: 1
      }
    }
  ]
});

// node_modules/@jsr/mcpc__core/src/transport/sse.js
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

// node_modules/@jsr/mcpc__core/src/service/llms/ollama.js
import { createOpenAI } from "@ai-sdk/openai";
import { wrapLanguageModel } from "ai";

// node_modules/@jsr/mcpc__core/src/middleware/imitate-tool-use.middleware.js
import { generateId as generateId2 } from "ai";
var ImitateToolCallTagForQwen = /* @__PURE__ */ function(ImitateToolCallTagForQwen2) {
  ImitateToolCallTagForQwen2["StartTag"] = "```tool";
  ImitateToolCallTagForQwen2["EndTag"] = "```";
  return ImitateToolCallTagForQwen2;
}({});
var toolCallPattern = new RegExp(`${ImitateToolCallTagForQwen.StartTag}([\\s\\S]*?)${ImitateToolCallTagForQwen.EndTag}`, "g");

// node_modules/@jsr/mcpc__core/src/middleware/thinking.middleware.js
import { z as z3 } from "zod";
var ReasoningFormatConfig = z3.object({
  prefix: z3.string().default("> "),
  prefixRethink: z3.string().default("\n> "),
  linePrefix: z3.string().default("\n\n> "),
  endSuffix: z3.string().default("\n\n")
});
var DEFAULT_REASONING_FORMAT = ReasoningFormatConfig.parse({});

// node_modules/@jsr/mcpc__core/src/service/llms/ollama.js
import process3 from "node:process";
var _ollama = createOpenAI({
  apiKey: "ollama",
  baseURL: process3.env.OLLAMA_BASE_URL,
  fetch: async (req, options) => {
    console.log("[ollama] request", req);
    try {
      const res = await fetch(req, options);
      console.log(`[ollama] responsed`);
      return res;
    } catch (e) {
      console.error("[ollama] error", e);
      throw e;
    }
  }
});

// node_modules/@jsr/mcpc__core/src/service/llms/qwen.js
import { createOpenAI as createOpenAI2 } from "@ai-sdk/openai";
import process4 from "node:process";
var qwen = createOpenAI2({
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  apiKey: process4.env.ALIBABA_TOKEN
});

// node_modules/@jsr/mcpc__core/src/set-up-mcp-compose.js
import minimist from "minimist";

// node_modules/@yao/gpt-vis-mcp/constant.js
var CHART_TYPE_MAP = {
  generate_area_chart: "area",
  generate_bar_chart: "bar",
  generate_boxplot_chart: "boxplot",
  generate_column_chart: "column",
  generate_district_map: "district-map",
  generate_dual_axes_chart: "dual-axes",
  generate_fishbone_diagram: "fishbone-diagram",
  generate_flow_diagram: "flow-diagram",
  generate_funnel_chart: "funnel",
  generate_histogram_chart: "histogram",
  generate_line_chart: "line",
  generate_liquid_chart: "liquid",
  generate_mind_map: "mind-map",
  generate_network_graph: "network-graph",
  generate_organization_chart: "organization-chart",
  generate_path_map: "path-map",
  generate_pie_chart: "pie",
  generate_pin_map: "pin-map",
  generate_radar_chart: "radar",
  generate_sankey_chart: "sankey",
  generate_scatter_chart: "scatter",
  generate_treemap_chart: "treemap",
  generate_venn_chart: "venn",
  generate_violin_chart: "violin",
  generate_word_cloud_chart: "word-cloud"
};
var CHART_TYPE_UNSUPPORTED = [
  "geographic_district_map",
  "geographic_path_map",
  "geographic_pin_map"
];

// node_modules/@yao/gpt-vis-mcp/app.js
import { render } from "@antv/gpt-vis-ssr";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir } from "node:fs/promises";
var RENDERED_IMAGE_PATH = process.env.RENDERED_IMAGE_PATH ?? join("/tmp", tmpdir());
var RENDERED_IMAGE_HOST_PATH = process.env.RENDERED_IMAGE_HOST_PATH;
try {
  await mkdir(RENDERED_IMAGE_PATH, {
    recursive: true
  });
} catch (error) {
  console.error(`Failed to create directory ${RENDERED_IMAGE_PATH}:`, error);
  process.exit(1);
}
var tools = await composeMcpDepTools({
  mcpServers: {
    "mcp-server-chart": {
      command: "npx",
      args: [
        "-y",
        "@antv/mcp-server-chart"
      ]
    }
  }
});
var server = new ComposableMCPServer({
  name: "gpt-vis-mcp",
  version: "0.1.0"
}, {
  capabilities: {
    tools: {}
  }
});
var registerToolWithNewExcuter = (tool) => {
  const { name, description, inputSchema } = tool;
  server.tool(name, description, jsonSchema3(inputSchema), async ({ data }) => {
    try {
      const type = CHART_TYPE_MAP[name];
      const options = {
        type,
        data
      };
      const vis = await render(options);
      const id = generateId3(8);
      const path = join(RENDERED_IMAGE_PATH, `${id}.png`);
      vis.exportToFile(path, {});
      return {
        isError: false,
        content: [
          {
            type: "text",
            text: RENDERED_IMAGE_HOST_PATH ? `Image generated successfully: ${RENDERED_IMAGE_HOST_PATH}/${id}.png` : `Image generated and saved to ${path}`
          }
        ]
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
};
Object.values(tools).filter((tool) => !CHART_TYPE_UNSUPPORTED.includes(tool)).forEach(registerToolWithNewExcuter);

// node_modules/@yao/gpt-vis-mcp/stdio.server.ts
var transport = new StdioServerTransport();
await server.connect(transport);
