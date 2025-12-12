import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServerConfig } from "@/lib/validators/canvas-schema";
import { getEnabledMcpServers } from "@/services/database/mcp-repository";

/**
 * MCP client instance manager
 */
class McpClientManager {
  private clients: Map<string, Client> = new Map();

  /**
   * Connects to an MCP server
   */
  async connect(server: McpServerConfig): Promise<Client> {
    if (this.clients.has(server.id)) {
      return this.clients.get(server.id)!;
    }

    let transport: StdioClientTransport;

    // Support different server types
    switch (server.type) {
      case "stdio": {
        const { command, args = [], env = {} } = server.config;

        // SECURITY: Validate command is in whitelist (defense in depth)
        const allowedCommands = [
          '/usr/local/bin/mcp-server-filesystem',
          '/usr/local/bin/mcp-server-postgres',
          '/usr/local/bin/mcp-server-sqlite',
          'npx',
          'node',
        ];

        if (!allowedCommands.includes(command as string)) {
          throw new Error(
            `Security: Command "${command}" not in whitelist. Allowed: ${allowedCommands.join(', ')}`
          );
        }

        // SECURITY: Validate args don't contain shell metacharacters
        const argsArray = (args as string[]) || [];
        const dangerousChars = /[;&|`$()<>]/;
        if (argsArray.some(arg => dangerousChars.test(arg))) {
          throw new Error(
            'Security: Arguments contain potentially dangerous shell metacharacters'
          );
        }

        // SECURITY: Validate all env values are strings
        const envObj = env as Record<string, unknown>;
        const invalidEnvVars = Object.entries(envObj).filter(
          ([, value]) => typeof value !== 'string'
        );
        if (invalidEnvVars.length > 0) {
          throw new Error(
            `Security: Environment variables must be strings. Invalid: ${invalidEnvVars.map(([k]) => k).join(', ')}`
          );
        }

        // Build the full environment, merging process.env with custom env
        const fullEnv: Record<string, string> = {};
        for (const [key, value] of Object.entries(process.env)) {
          if (value !== undefined) {
            fullEnv[key] = value;
          }
        }
        for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
          if (typeof value === 'string') {
            fullEnv[key] = value;
          }
        }

        console.log(`[MCP Security] Validated command: ${command} with ${argsArray.length} args`);

        transport = new StdioClientTransport({
          command: command as string,
          args: args as string[],
          env: fullEnv,
        });
        break;
      }
      default:
        throw new Error(`Unsupported MCP server type: ${server.type}`);
    }

    const client = new Client(
      {
        name: "hcl-ai-canvas",
        version: "0.1.0",
      },
      {
        capabilities: {
          roots: {
            listChanged: true,
          },
          sampling: {},
        },
      }
    );

    await client.connect(transport);
    this.clients.set(server.id, client);

    return client;
  }

  /**
   * Disconnects from an MCP server
   */
  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.close();
      this.clients.delete(serverId);
    }
  }

  /**
   * Disconnects from all MCP servers
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(
      Array.from(this.clients.keys()).map((id) => this.disconnect(id))
    );
  }

  /**
   * Gets a connected client by server ID
   */
  getClient(serverId: string): Client | undefined {
    return this.clients.get(serverId);
  }
}

// Singleton instance
const mcpManager = new McpClientManager();

/**
 * Query MCP servers for relevant data based on problem context
 */
export async function queryMcpServers(
  problemStatement: string,
  context?: string
): Promise<string> {
  const servers = await getEnabledMcpServers();

  if (servers.length === 0) {
    console.log("No enabled MCP servers found");
    return "";
  }

  console.log(`🔌 Querying ${servers.length} enabled MCP server(s)...`);
  const results: string[] = [];

  for (const server of servers) {
    try {
      console.log(`📡 Connecting to MCP server: ${server.name}`);
      const client = await mcpManager.connect(server);

      // List available tools
      const { tools } = await client.listTools();
      console.log(`✓ Found ${tools.length} tool(s) on ${server.name}`);

      // For PostgreSQL servers, do a two-step query: discover tables, then sample data
      // Only run Postgres-specific logic if this is actually a Postgres server
      // Check server name, command, and args (since command might be "npx" with postgres in args)
      const serverNameLower = server.name.toLowerCase();
      const commandStr = server.config.command?.toString().toLowerCase() || '';
      const argsStr = Array.isArray(server.config.args)
        ? server.config.args.join(' ').toLowerCase()
        : '';

      const isPostgresServer = serverNameLower.includes('postgres') ||
                               commandStr.includes('postgres') ||
                               argsStr.includes('postgres') ||
                               argsStr.includes('@modelcontextprotocol/server-postgres');
      const hasQueryTool = tools.some(t => t.name === "query");

      console.log(`🔍 Server detection: name="${server.name}", command="${commandStr}", args="${argsStr.substring(0, 50)}...", isPostgres=${isPostgresServer}`);

      if (isPostgresServer && hasQueryTool) {
        const resultsBeforePostgres = results.length; // Track results before Postgres logic

        try {
          console.log(`🔍 Step 1: Discovering database tables...`);

          // Step 1: Get table names
          const tablesResult = await client.callTool({
            name: "query",
            arguments: {
              sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LIMIT 10"
            },
          });

          const tablesContent = tablesResult.content as Array<{ type: string; text?: string }>;
          const tablesText = tablesContent
            .map((c) => {
              if (c.type === "text") return c.text;
              return JSON.stringify(c, null, 2);
            })
            .join("\n");

          console.log(`✅ Found tables:`, tablesText);

          // SECURITY: Avoid sampling live data to prevent accidental leakage of sensitive rows.
          if (tablesText.trim()) {
            results.push(`[MCP Source: ${server.name} - Table List]\n${tablesText}`);
          }
        } catch (queryError) {
          console.error(`❌ Error during Postgres exploration:`, queryError);
          console.log(`⚠️  Falling back to generic tool iteration for ${server.name}`);
          // Don't continue - let it fall through to generic tool loop below
        }

        // If Postgres-specific logic added results for THIS server, skip generic loop
        if (results.length > resultsBeforePostgres) {
          console.log(`✅ Postgres exploration added ${results.length - resultsBeforePostgres} result(s), skipping generic loop`);
          continue;
        } else {
          console.log(`⚠️  Postgres exploration added no results, proceeding to generic tool loop`);
        }
      }

      // For non-PostgreSQL servers, query relevant tools
      for (const tool of tools) {
        try {
          // Query all available tools - let the LLM decide what's relevant
          console.log(`🔍 Calling tool: ${tool.name} on ${server.name}`);

          // Build arguments dynamically based on tool's input schema
          const toolArguments = buildDynamicToolArguments(
            tool,
            problemStatement,
            context
          );

          // If buildDynamicToolArguments returned empty args for SQL tools, skip this tool
          if (Object.keys(toolArguments).length === 0) {
            console.log(`⚠️  Skipping tool ${tool.name} - cannot auto-generate required arguments`);
            continue;
          }

          const result = await client.callTool({
            name: tool.name,
            arguments: toolArguments,
          });

          if (result.content) {
            const content = result.content as Array<{ type: string; text?: string }>;
            const textContent = content
              .map((c) => {
                if (c.type === "text") return c.text;
                return JSON.stringify(c, null, 2);
              })
              .join("\n");

            if (textContent.trim()) {
              console.log(`✅ Retrieved ${textContent.length} characters from ${server.name} - ${tool.name}`);
              results.push(
                `[MCP Source: ${server.name} - ${tool.name}]\n${textContent}`
              );
            }
          }
        } catch (toolError) {
          console.error(
            `❌ Error calling tool ${tool.name} on ${server.name}:`,
            toolError
          );
        }
      }
    } catch (error) {
      console.error(`❌ Error querying MCP server ${server.name}:`, error);
    }
  }

  if (results.length > 0) {
    console.log(`🎉 Successfully retrieved data from ${results.length} MCP source(s)`);
  } else {
    console.log(`⚠️  No data retrieved from MCP servers`);
  }

  return results.join("\n\n");
}

/**
 * Query specific MCP resources
 */
export async function queryMcpResources(
  serverIds?: string[]
): Promise<string> {
  const allServers = await getEnabledMcpServers();
  const servers = serverIds
    ? allServers.filter((s) => serverIds.includes(s.id))
    : allServers;

  if (servers.length === 0) {
    return "";
  }

  const results: string[] = [];

  for (const server of servers) {
    try {
      const client = await mcpManager.connect(server);

      // List available resources
      const { resources } = await client.listResources();

      // Read relevant resources
      for (const resource of resources) {
        try {
          const result = await client.readResource({ uri: resource.uri });

          if (result.contents) {
            const contents = result.contents as unknown as Array<{ type: string; text?: string }>;
            const textContent = contents
              .map((c) => {
                if (c.type === "text") return c.text;
                return JSON.stringify(c, null, 2);
              })
              .join("\n");

            if (textContent.trim()) {
              results.push(
                `[MCP Resource: ${server.name} - ${resource.name}]\n${textContent}`
              );
            }
          }
        } catch (resourceError) {
          console.error(
            `Error reading resource ${resource.uri} on ${server.name}:`,
            resourceError
          );
        }
      }
    } catch (error) {
      console.error(`Error querying MCP server ${server.name}:`, error);
    }
  }

  return results.join("\n\n");
}

/**
 * Test connection to an MCP server
 */
export async function testMcpConnection(
  server: McpServerConfig
): Promise<{ success: boolean; error?: string; tools?: string[]; resources?: string[] }> {
  try {
    console.log(`Testing MCP connection for: ${server.name}`);
    console.log(`Command: ${server.config.command}`);
    console.log(`Args:`, server.config.args);
    console.log(`Env keys:`, Object.keys(server.config.env || {}));

    const client = await mcpManager.connect(server);

    // List tools and resources with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Connection timeout after 10 seconds")), 10000)
    );

    // Check server capabilities before calling methods
    const toolsResult = await Promise.race([
      client.listTools(),
      timeoutPromise
    ]) as Awaited<ReturnType<typeof client.listTools>>;

    // Only list resources if server supports it
    let resourcesResult: Awaited<ReturnType<typeof client.listResources>> | null = null;
    try {
      // Some servers (like Postgres MCP) are tools-only and don't support resources
      resourcesResult = await Promise.race([
        client.listResources(),
        timeoutPromise
      ]) as Awaited<ReturnType<typeof client.listResources>>;
    } catch (error) {
      console.log(`Server doesn't support resources (tools-only server)`);
    }

    // Disconnect after test
    await mcpManager.disconnect(server.id);

    const resourceCount = resourcesResult?.resources.length || 0;
    console.log(`Connection successful! Found ${toolsResult.tools.length} tools and ${resourceCount} resources`);

    return {
      success: true,
      tools: toolsResult.tools.map((t) => t.name),
      resources: resourcesResult?.resources.map((r) => r.name) || [],
    };
  } catch (error) {
    console.error("MCP connection test failed:", error);

    // Ensure client is disconnected on error
    try {
      await mcpManager.disconnect(server.id);
    } catch (disconnectError) {
      console.error("Error disconnecting after failed test:", disconnectError);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Determines if a tool should be queried based on context
 */
function shouldQueryTool(
  toolName: string,
  problemStatement: string,
  context?: string
): boolean {
  const combinedContext = `${problemStatement} ${context || ""}`.toLowerCase();

  // Filesystem tools
  if (
    toolName.includes("read") ||
    toolName.includes("file") ||
    toolName.includes("search")
  ) {
    return (
      combinedContext.includes("document") ||
      combinedContext.includes("file") ||
      combinedContext.includes("code")
    );
  }

  // Database/analytics tools
  if (
    toolName.includes("query") ||
    toolName.includes("data") ||
    toolName.includes("analytics")
  ) {
    return (
      combinedContext.includes("metric") ||
      combinedContext.includes("kpi") ||
      combinedContext.includes("data") ||
      combinedContext.includes("analytics")
    );
  }

  // GitHub tools
  if (
    toolName.includes("github") ||
    toolName.includes("issue") ||
    toolName.includes("pr")
  ) {
    return (
      combinedContext.includes("github") ||
      combinedContext.includes("repository") ||
      combinedContext.includes("issue") ||
      combinedContext.includes("feature")
    );
  }

  // Default: query all tools if unsure
  return true;
}

/**
 * Builds arguments dynamically based on the tool's input schema
 */
function buildDynamicToolArguments(
  tool: { name: string; inputSchema: { type: string; properties?: Record<string, unknown>; required?: string[] } },
  problemStatement: string,
  context?: string
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const combinedContext = `${problemStatement} ${context || ""}`;

  // If no schema properties, return empty object (some tools don't need args)
  if (!tool.inputSchema.properties) {
    console.log(`ℹ️  Tool "${tool.name}" has no input properties`);
    return {};
  }

  const properties = tool.inputSchema.properties;
  const required = tool.inputSchema.required || [];

  console.log(`🔧 Building arguments for tool "${tool.name}" with properties:`, Object.keys(properties));

  // Iterate through each property in the schema
  for (const [propName, propSchema] of Object.entries(properties)) {
    const schema = propSchema as { type?: string; description?: string };

    // Handle SQL query parameters
    // NOTE: We no longer inject SQL here - this function is deprecated in favor of tool calling
    // where the LLM generates appropriate SQL queries itself
    if (propName === "sql" || propName === "query" || propName === "statement") {
      console.log(`⚠️  Skipping SQL parameter "${propName}" - tool calling will handle it`);
      continue; // Don't set this property
    }
    // Handle table name parameters
    else if (propName === "table" || propName === "table_name" || propName === "tableName") {
      // Leave empty to let the tool auto-discover tables
      args[propName] = "";
      console.log(`📊 Left "${propName}" empty for auto-discovery`);
    }
    // Handle search/grep patterns
    else if (propName === "pattern" || propName === "search" || propName === "term") {
      args[propName] = problemStatement.split(" ").slice(0, 5).join(" ");
    }
    // Handle path parameters
    else if (propName === "path" || propName === "directory" || propName === "folder") {
      args[propName] = ".";
    }
    // Handle generic text/string inputs
    // Skip SQL-related fields - we already handled those above
    else if (schema.type === "string" &&
             propName !== "sql" &&
             propName !== "query" &&
             propName !== "statement") {
      if (required.includes(propName)) {
        args[propName] = combinedContext;
        console.log(`📝 Set required string property "${propName}" to context`);
      }
    }
    // Handle number inputs
    else if (schema.type === "number" || schema.type === "integer") {
      if (propName === "limit" || propName === "max" || propName === "count") {
        args[propName] = 100;
      }
    }
    // Handle boolean inputs
    else if (schema.type === "boolean") {
      // Default booleans to true if not specified
      args[propName] = true;
    }
  }

  // If no arguments were set and there are required fields, check if any are SQL-related
  if (Object.keys(args).length === 0 && required.length > 0) {
    // Check if the first required field is SQL-related
    const firstRequired = required[0];
    if (firstRequired === "sql" || firstRequired === "query" || firstRequired === "statement") {
      console.log(`⚠️  Required SQL field "${firstRequired}" cannot be auto-filled, skipping this tool`);
      // Return empty args - this will cause tool calling to skip this tool
      return {};
    }

    console.log(`⚠️  No args built but required fields exist, using first required field`);
    args[firstRequired] = combinedContext;
  }

  return args;
}

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanupMcpConnections(): Promise<void> {
  await mcpManager.disconnectAll();
}

export { mcpManager };
