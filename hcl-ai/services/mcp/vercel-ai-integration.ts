import { tool } from "ai";
import { z } from "zod";
import { getEnabledMcpServers } from "@/services/database/mcp-repository";
import { mcpManager } from "@/services/mcp/client";

/**
 * Convert MCP tools to Vercel AI SDK tool format
 */
export async function getMcpToolsForVercelAI(): Promise<{
  tools: Record<string, any>;
  serverMap: Map<string, string>;
}> {
  try {
    const servers = await getEnabledMcpServers();

    if (servers.length === 0) {
      console.log("📋 No enabled MCP servers found");
      return {
        tools: {},
        serverMap: new Map<string, string>(),
      };
    }

    console.log(`🔧 Converting ${servers.length} MCP server(s) to Vercel AI SDK tools...`);

    const tools: Record<string, any> = {};
    const serverMap = new Map<string, string>();

    for (const server of servers) {
      try {
        const client = mcpManager.getClient(server.id) || await mcpManager.connect(server);

        // List available tools from this MCP server
        const { tools: mcpTools } = await client.listTools();
        console.log(`✓ Found ${mcpTools.length} tool(s) on ${server.name}`);

        // Convert each MCP tool to Vercel AI SDK format
        for (const mcpTool of mcpTools) {
          // Create unique tool name: ServerName__toolName
          const toolName = `${server.name}__${mcpTool.name}`;

          console.log(`🔄 Converting MCP tool: ${toolName}`);

          // Convert JSON Schema to Zod schema
          const zodSchema = jsonSchemaToZod(mcpTool.inputSchema as {
            type: string;
            properties?: Record<string, unknown>;
            required?: string[];
          });

          // Create Vercel AI SDK tool (directly, not wrapped)
          tools[toolName] = {
            description: mcpTool.description || `Tool from ${server.name}`,
            parameters: zodSchema,
            execute: async (args: Record<string, unknown>) => {
              try {
                console.log(`🔧 Executing MCP tool: ${toolName} with args:`, args);

                const result = await client.callTool({
                  name: mcpTool.name,
                  arguments: args,
                });

                // Extract text content from MCP response
                const content = result.content as Array<{ type: string; text?: string }>;
                const textContent = content
                  .map((c) => {
                    if (c.type === "text") return c.text;
                    return JSON.stringify(c, null, 2);
                  })
                  .join("\n");

                console.log(`✅ MCP tool ${toolName} returned ${textContent.length} characters`);
                return textContent;
              } catch (error) {
                console.error(`❌ Error executing MCP tool ${toolName}:`, error);
                return `Error executing tool: ${error instanceof Error ? error.message : "Unknown error"}`;
              }
            },
          };

          // Map tool name to server ID for tracking
          serverMap.set(toolName, server.id);
        }
      } catch (error) {
        console.error(`❌ Error loading tools from ${server.name}:`, error);
      }
    }

    console.log(`✅ Successfully converted ${Object.keys(tools).length} MCP tools to Vercel AI SDK format`);

    return {
      tools,
      serverMap,
    };
  } catch (error) {
    console.error("❌ Error in getMcpToolsForVercelAI:", error);
    return {
      tools: {},
      serverMap: new Map<string, string>(),
    };
  }
}

/**
 * Convert JSON Schema to Zod schema
 * Handles common JSON Schema patterns for MCP tool definitions
 */
function jsonSchemaToZod(schema: {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}): z.ZodObject<any> {
  if (schema.type !== "object") {
    // Fallback for non-object schemas
    console.log("⚠️ Non-object schema type, returning empty object schema");
    return z.object({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  const properties = schema.properties || {};
  const required = schema.required || [];

  for (const [key, value] of Object.entries(properties)) {
    const prop = value as {
      type?: string | string[];
      description?: string;
      items?: { type?: string; properties?: Record<string, unknown>; required?: string[] };
      properties?: Record<string, unknown>;
      enum?: unknown[];
      default?: unknown;
      required?: string[];
    };

    let zodType: z.ZodTypeAny;

    // Handle type as array (e.g., ["string", "null"])
    const typeArray = Array.isArray(prop.type) ? prop.type : [prop.type];
    const primaryType = typeArray[0];

    switch (primaryType) {
      case "string":
        if (prop.enum) {
          // Handle enum strings
          zodType = z.enum(prop.enum as [string, ...string[]]);
        } else {
          zodType = z.string();
        }
        break;
      case "number":
      case "integer":
        zodType = z.number();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      case "array":
        if (prop.items?.type === "string") {
          zodType = z.array(z.string());
        } else if (prop.items?.type === "number" || prop.items?.type === "integer") {
          zodType = z.array(z.number());
        } else if (prop.items?.type === "object" && prop.items.properties) {
          const nestedSchema = jsonSchemaToZod({
            type: "object",
            properties: prop.items.properties,
            required: prop.items.required,
          });
          zodType = z.array(nestedSchema);
        } else {
          zodType = z.array(z.any());
        }
        break;
      case "object":
        if (prop.properties) {
          zodType = jsonSchemaToZod({
            type: "object",
            properties: prop.properties,
            required: prop.required,
          });
        } else {
          zodType = z.record(z.string(), z.any());
        }
        break;
      default:
        zodType = z.any();
    }

    // Add description if available
    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    // Add default value if specified
    if (prop.default !== undefined) {
      zodType = zodType.default(prop.default);
    }

    // Make optional if not required
    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
}


/**
 * Build simplified system prompt for Vercel AI SDK (trusts native tool calling)
 */
export function buildVercelAIToolSystemPrompt(): string {
  return `You have access to MCP (Model Context Protocol) tools that can query databases, read files, and access external systems.

**Tool Usage Guidelines:**
- Use tools to gather data when needed
- Call multiple tools if necessary to get comprehensive information
- Tools are named with format: "ServerName__tool_name"

**Data Analysis:**
- For databases: Start with schema discovery, then run analytical queries (aggregates, group by)
- Avoid SELECT * queries - use targeted analytical queries
- Extract meaningful statistics and patterns from data

After gathering data, synthesize insights into the business canvas.`;
}
