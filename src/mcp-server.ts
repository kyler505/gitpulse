#!/usr/bin/env node

import { createServer, IncomingMessage, ServerResponse } from "http";
import { Octokit } from "@octokit/rest";

// Initialize GitHub client
let octokit: Octokit | null = null;

function getGitHubClient(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    octokit = new Octokit({
      auth: token,
      userAgent: "GitPulse-MCP-Server/1.0.0",
    });
  }
  return octokit;
}

// Helper function to parse repository string (owner/repo format)
function parseRepository(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  if (parts.length !== 2) {
    throw new Error("Repository must be in format 'owner/repo'");
  }
  return { owner: parts[0], repo: parts[1] };
}

// Helper functions for GitHub API calls
async function handleCommitsRequest(params: any) {
  const github = getGitHubClient();
  const { owner, repo } = parseRepository(params.repository);

  const apiParams: any = {
    owner,
    repo,
    per_page: Math.min(params.per_page || 30, 100),
  };

  if (params.since) {
    apiParams.since = params.since;
  }

  const response = await github.rest.repos.listCommits(apiParams);
  return response.data.map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author?.name || "Unknown",
    date: commit.commit.author?.date || "",
    url: commit.html_url,
  }));
}

async function handlePRsRequest(params: any) {
  const github = getGitHubClient();
  const { owner, repo } = parseRepository(params.repository);

  const response = await github.rest.pulls.list({
    owner,
    repo,
    state: params.state || "open",
    per_page: Math.min(params.per_page || 30, 100),
    sort: "created",
    direction: "desc",
  });

  return response.data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: pr.user?.login || "Unknown",
    state: pr.state,
    created_at: pr.created_at,
    html_url: pr.html_url,
  }));
}

const port = parseInt(process.env.PORT || "3000");

const server = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    // Enable CORS with comprehensive headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    res.setHeader(
      "Access-Control-Allow-Headers", 
      "Content-Type, Authorization, Accept, Origin, X-Requested-With"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
    res.setHeader("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === "HEAD") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end();
      return;
    }

    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log(`Headers:`, JSON.stringify(req.headers, null, 2));

    // Health check endpoint
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          name: "GitPulse MCP Server",
          version: "1.0.0",
          description: "GitHub repository monitoring MCP server",
          protocol_version: "2024-11-05",
          capabilities: {
            tools: {},
            logging: {},
            prompts: {},
            resources: {},
          },
          server_info: {
            name: "gitpulse-mcp-server",
            version: "1.0.0",
          },
        })
      );
      return;
    }

    // MCP SSE endpoint (for some clients that expect streaming)
    if (req.method === "GET" && req.url === "/mcp") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });

      // Send connection established
      res.write(
        "data: " +
          JSON.stringify({
            jsonrpc: "2.0",
            method: "server/ready",
            params: {
              serverInfo: {
                name: "gitpulse-mcp-server",
                version: "1.0.0",
              },
            },
          }) +
          "\n\n"
      );

      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write("data: ping\n\n");
      }, 30000);

      req.on("close", () => {
        clearInterval(keepAlive);
      });

      return;
    }

    // MCP endpoint (POST)
    if (req.method === "POST" && req.url === "/mcp") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          if (!body || body.trim() === "") {
            console.log("Empty request body received");
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32600,
                message: "Invalid Request - empty body"
              }
            }));
            return;
          }
          
          const mcpRequest = JSON.parse(body);
          console.log("MCP Request:", JSON.stringify(mcpRequest, null, 2));

          // Handle initialize request
          if (mcpRequest.method === "initialize") {
            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                protocolVersion: "2024-11-05",
                capabilities: {
                  tools: {
                    listChanged: true
                  },
                  logging: {},
                  prompts: {
                    listChanged: true
                  },
                  resources: {
                    subscribe: true,
                    listChanged: true
                  }
                },
                serverInfo: {
                  name: "gitpulse-mcp-server",
                  version: "1.0.0",
                },
              },
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Handle tools/list request
          if (mcpRequest.method === "tools/list") {
            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                tools: [
                  {
                    name: "fetchNewCommits",
                    description: "Fetch new commits from a GitHub repository",
                    inputSchema: {
                      type: "object",
                      properties: {
                        repository: {
                          type: "string",
                          description: "Repository in format owner/repo",
                        },
                        since: {
                          type: "string",
                          description:
                            "ISO 8601 timestamp to fetch commits since",
                        },
                        per_page: {
                          type: "number",
                          description: "Number of commits to fetch (max 100)",
                          default: 30,
                        },
                      },
                      required: ["repository"],
                    },
                  },
                  {
                    name: "fetchNewPRs",
                    description:
                      "Fetch new pull requests from a GitHub repository",
                    inputSchema: {
                      type: "object",
                      properties: {
                        repository: {
                          type: "string",
                          description: "Repository in format owner/repo",
                        },
                        state: {
                          type: "string",
                          enum: ["open", "closed", "all"],
                          description: "Filter PRs by state",
                          default: "open",
                        },
                        per_page: {
                          type: "number",
                          description: "Number of PRs to fetch (max 100)",
                          default: 30,
                        },
                      },
                      required: ["repository"],
                    },
                  },
                ],
              },
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Handle tools/call request
          if (mcpRequest.method === "tools/call") {
            const toolName = mcpRequest.params?.name;
            const toolArgs = mcpRequest.params?.arguments || {};

            let result;
            switch (toolName) {
              case "fetchNewCommits":
                result = await handleCommitsRequest(toolArgs);
                break;
              case "fetchNewPRs":
                result = await handlePRsRequest(toolArgs);
                break;
              default:
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id: mcpRequest.id,
                    error: {
                      code: -32601,
                      message: "Method not found",
                      data: { method: toolName },
                    },
                  })
                );
                return;
            }

            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              },
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Handle notification/initialized
          if (mcpRequest.method === "notifications/initialized") {
            res.writeHead(204);
            res.end();
            return;
          }

          // Handle ping requests (some clients send these)
          if (mcpRequest.method === "ping") {
            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {}
            };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Handle resources/list (even if empty)
          if (mcpRequest.method === "resources/list") {
            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                resources: []
              }
            };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Handle prompts/list (even if empty)
          if (mcpRequest.method === "prompts/list") {
            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                prompts: []
              }
            };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Unknown method
          console.log(`Unknown MCP method: ${mcpRequest.method}`);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: mcpRequest.id || null,
              error: {
                code: -32601,
                message: "Method not found",
                data: { method: mcpRequest.method },
              },
            })
          );
        } catch (error) {
          console.error("MCP Error:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32603,
                message: "Internal error",
                data: {
                  error: error instanceof Error ? error.message : String(error),
                },
              },
            })
          );
        }
      });
      return;
    }

    // Root endpoint that also handles MCP
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          name: "GitPulse MCP Server",
          version: "1.0.0",
          description: "GitHub repository monitoring MCP server",
          protocol_version: "2024-11-05",
          endpoints: {
            health: "/health",
            mcp: "/mcp",
            root: "/",
          },
          capabilities: {
            tools: {},
            logging: {},
            prompts: {},
            resources: {},
          },
          server_info: {
            name: "gitpulse-mcp-server",
            version: "1.0.0",
          },
        })
      );
      return;
    }

    // MCP endpoint at root (for some clients)
    if (req.method === "POST" && req.url === "/") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const mcpRequest = JSON.parse(body || "{}");
          console.log(
            "MCP Request at root:",
            JSON.stringify(mcpRequest, null, 2)
          );

          // Handle initialize request
          if (mcpRequest.method === "initialize") {
            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                protocolVersion: "2024-11-05",
                capabilities: {
                  tools: {
                    listChanged: true
                  },
                  logging: {},
                  prompts: {
                    listChanged: true
                  },
                  resources: {
                    subscribe: true,
                    listChanged: true
                  }
                },
                serverInfo: {
                  name: "gitpulse-mcp-server",
                  version: "1.0.0",
                },
              },
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Handle tools/list request
          if (mcpRequest.method === "tools/list") {
            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                tools: [
                  {
                    name: "fetchNewCommits",
                    description: "Fetch new commits from a GitHub repository",
                    inputSchema: {
                      type: "object",
                      properties: {
                        repository: {
                          type: "string",
                          description: "Repository in format owner/repo",
                        },
                        since: {
                          type: "string",
                          description:
                            "ISO 8601 timestamp to fetch commits since",
                        },
                        per_page: {
                          type: "number",
                          description: "Number of commits to fetch (max 100)",
                          default: 30,
                        },
                      },
                      required: ["repository"],
                    },
                  },
                  {
                    name: "fetchNewPRs",
                    description:
                      "Fetch new pull requests from a GitHub repository",
                    inputSchema: {
                      type: "object",
                      properties: {
                        repository: {
                          type: "string",
                          description: "Repository in format owner/repo",
                        },
                        state: {
                          type: "string",
                          enum: ["open", "closed", "all"],
                          description: "Filter PRs by state",
                          default: "open",
                        },
                        per_page: {
                          type: "number",
                          description: "Number of PRs to fetch (max 100)",
                          default: 30,
                        },
                      },
                      required: ["repository"],
                    },
                  },
                ],
              },
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Handle tools/call request
          if (mcpRequest.method === "tools/call") {
            const toolName = mcpRequest.params?.name;
            const toolArgs = mcpRequest.params?.arguments || {};

            let result;
            switch (toolName) {
              case "fetchNewCommits":
                result = await handleCommitsRequest(toolArgs);
                break;
              case "fetchNewPRs":
                result = await handlePRsRequest(toolArgs);
                break;
              default:
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id: mcpRequest.id,
                    error: {
                      code: -32601,
                      message: "Method not found",
                      data: { method: toolName },
                    },
                  })
                );
                return;
            }

            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              },
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Handle notification/initialized
          if (mcpRequest.method === "notifications/initialized") {
            res.writeHead(204);
            res.end();
            return;
          }

          // Handle ping requests (some clients send these)
          if (mcpRequest.method === "ping") {
            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {}
            };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Handle resources/list (even if empty)
          if (mcpRequest.method === "resources/list") {
            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                resources: []
              }
            };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Handle prompts/list (even if empty)
          if (mcpRequest.method === "prompts/list") {
            const response = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              result: {
                prompts: []
              }
            };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
            return;
          }

          // Unknown method
          console.log(`Unknown MCP method at root: ${mcpRequest.method}`);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: mcpRequest.id || null,
              error: {
                code: -32601,
                message: "Method not found",
                data: { method: mcpRequest.method },
              },
            })
          );
        } catch (error) {
          console.error("MCP Error at root:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32603,
                message: "Internal error",
                data: {
                  error: error instanceof Error ? error.message : String(error),
                },
              },
            })
          );
        }
      });
      return;
    }

    // 404 for other endpoints
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Not found",
        available_endpoints: ["/", "/health", "/mcp"],
        request: {
          method: req.method,
          url: req.url,
        },
      })
    );
  }
);

server.listen(port, "0.0.0.0", () => {
  console.log(`GitPulse MCP Server running on port ${port}`);
  console.log(`Health check: /health`);
  console.log(`MCP endpoint: /mcp`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `GitHub token configured: ${process.env.GITHUB_TOKEN ? "Yes" : "No"}`
  );
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down GitPulse MCP Server...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("Shutting down GitPulse MCP Server...");
  server.close(() => {
    process.exit(0);
  });
});
