#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";

// GitHub API types and interfaces
interface GitHubRepository {
  owner: string;
  repo: string;
}

interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  author: string;
  state: string;
  created_at: string;
  html_url: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  author: string;
  state: string;
  created_at: string;
  html_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
}

// Initialize the MCP server
const server = new McpServer({
  name: "gitpulse-mcp-server",
  version: "1.0.0",
});

// Initialize GitHub client
let octokit: Octokit | null = null;

// Helper function to initialize GitHub client with token
function initializeGitHubClient(token?: string): Octokit {
  if (!token) {
    token = process.env.GITHUB_TOKEN;
  }

  if (!token) {
    throw new Error(
      "GitHub token is required. Set GITHUB_TOKEN environment variable or provide token."
    );
  }

  return new Octokit({
    auth: token,
    userAgent: "GitPulse-MCP-Server/1.0.0",
  });
}

// Helper function to ensure GitHub client is initialized
function getGitHubClient(): Octokit {
  if (!octokit) {
    octokit = initializeGitHubClient();
  }
  return octokit;
}

// Helper function to parse repository string (owner/repo format)
function parseRepository(repo: string): GitHubRepository {
  const parts = repo.split("/");
  if (parts.length !== 2) {
    throw new Error("Repository must be in format 'owner/repo'");
  }
  return { owner: parts[0], repo: parts[1] };
}

// Tool: Fetch new commits from a repository
server.tool(
  "fetchNewCommits",
  "Fetch new commits from a GitHub repository since a given timestamp",
  {
    repository: z.string().describe("Repository in format 'owner/repo'"),
    since: z
      .string()
      .optional()
      .describe("ISO 8601 timestamp to fetch commits since"),
    per_page: z
      .number()
      .optional()
      .default(30)
      .describe("Number of commits to fetch (max 100)"),
  },
  async ({ repository, since, per_page = 30 }) => {
    try {
      const github = getGitHubClient();
      const { owner, repo } = parseRepository(repository);

      const params: any = {
        owner,
        repo,
        per_page: Math.min(per_page, 100),
      };

      if (since) {
        params.since = since;
      }

      const response = await github.rest.repos.listCommits(params);

      const commits: GitHubCommit[] = response.data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || "Unknown",
        date: commit.commit.author?.date || "",
        url: commit.html_url,
      }));

      return {
        content: [
          {
            type: "text",
            text:
              `Found ${commits.length} commits in ${repository}:\n\n` +
              commits
                .map(
                  (commit) =>
                    `• ${commit.sha.substring(0, 7)} - ${
                      commit.message.split("\n")[0]
                    }\n` +
                    `  Author: ${commit.author} | Date: ${commit.date}\n` +
                    `  URL: ${commit.url}`
                )
                .join("\n\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching commits: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Fetch new pull requests from a repository
server.tool(
  "fetchNewPRs",
  "Fetch new pull requests from a GitHub repository with optional filtering",
  {
    repository: z.string().describe("Repository in format 'owner/repo'"),
    state: z
      .enum(["open", "closed", "all"])
      .optional()
      .default("open")
      .describe("Filter PRs by state"),
    per_page: z
      .number()
      .optional()
      .default(30)
      .describe("Number of PRs to fetch (max 100)"),
  },
  async ({ repository, state = "open", per_page = 30 }) => {
    try {
      const github = getGitHubClient();
      const { owner, repo } = parseRepository(repository);

      const response = await github.rest.pulls.list({
        owner,
        repo,
        state,
        per_page: Math.min(per_page, 100),
        sort: "created",
        direction: "desc",
      });

      const pullRequests: GitHubPullRequest[] = response.data.map((pr) => ({
        number: pr.number,
        title: pr.title,
        author: pr.user?.login || "Unknown",
        state: pr.state,
        created_at: pr.created_at,
        html_url: pr.html_url,
      }));

      return {
        content: [
          {
            type: "text",
            text:
              `Found ${pullRequests.length} pull requests in ${repository} (${state}):\n\n` +
              pullRequests
                .map(
                  (pr) =>
                    `• #${pr.number} - ${pr.title}\n` +
                    `  Author: ${pr.author} | State: ${pr.state} | Created: ${pr.created_at}\n` +
                    `  URL: ${pr.html_url}`
                )
                .join("\n\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching pull requests: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Fetch new issues from a repository
server.tool(
  "fetchNewIssues",
  "Fetch new issues from a GitHub repository with optional filtering",
  {
    repository: z.string().describe("Repository in format 'owner/repo'"),
    state: z
      .enum(["open", "closed", "all"])
      .optional()
      .default("open")
      .describe("Filter issues by state"),
    per_page: z
      .number()
      .optional()
      .default(30)
      .describe("Number of issues to fetch (max 100)"),
  },
  async ({ repository, state = "open", per_page = 30 }) => {
    try {
      const github = getGitHubClient();
      const { owner, repo } = parseRepository(repository);

      const response = await github.rest.issues.listForRepo({
        owner,
        repo,
        state,
        per_page: Math.min(per_page, 100),
        sort: "created",
        direction: "desc",
      });

      // Filter out pull requests (GitHub API includes PRs in issues)
      const issues: GitHubIssue[] = response.data
        .filter((issue) => !issue.pull_request)
        .map((issue) => ({
          number: issue.number,
          title: issue.title,
          author: issue.user?.login || "Unknown",
          state: issue.state,
          created_at: issue.created_at,
          html_url: issue.html_url,
        }));

      return {
        content: [
          {
            type: "text",
            text:
              `Found ${issues.length} issues in ${repository} (${state}):\n\n` +
              issues
                .map(
                  (issue) =>
                    `• #${issue.number} - ${issue.title}\n` +
                    `  Author: ${issue.author} | State: ${issue.state} | Created: ${issue.created_at}\n` +
                    `  URL: ${issue.html_url}`
                )
                .join("\n\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching issues: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Fetch new releases from a repository
server.tool(
  "fetchNewReleases",
  "Fetch new releases from a GitHub repository",
  {
    repository: z.string().describe("Repository in format 'owner/repo'"),
    per_page: z
      .number()
      .optional()
      .default(10)
      .describe("Number of releases to fetch (max 100)"),
  },
  async ({ repository, per_page = 10 }) => {
    try {
      const github = getGitHubClient();
      const { owner, repo } = parseRepository(repository);

      const response = await github.rest.repos.listReleases({
        owner,
        repo,
        per_page: Math.min(per_page, 100),
      });

      const releases: GitHubRelease[] = response.data.map((release) => ({
        tag_name: release.tag_name,
        name: release.name || release.tag_name,
        published_at: release.published_at || "",
        html_url: release.html_url,
        body: release.body || "",
      }));

      return {
        content: [
          {
            type: "text",
            text:
              `Found ${releases.length} releases in ${repository}:\n\n` +
              releases
                .map(
                  (release) =>
                    `• ${release.name} (${release.tag_name})\n` +
                    `  Published: ${release.published_at}\n` +
                    `  URL: ${release.html_url}\n` +
                    `  ${
                      release.body
                        ? `Description: ${release.body.substring(0, 200)}${
                            release.body.length > 200 ? "..." : ""
                          }`
                        : "No description"
                    }`
                )
                .join("\n\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching releases: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get repository information
server.tool(
  "getRepositoryInfo",
  "Get general information about a GitHub repository",
  {
    repository: z.string().describe("Repository in format 'owner/repo'"),
  },
  async ({ repository }) => {
    try {
      const github = getGitHubClient();
      const { owner, repo } = parseRepository(repository);

      const response = await github.rest.repos.get({
        owner,
        repo,
      });

      const repoData = response.data;

      return {
        content: [
          {
            type: "text",
            text:
              `Repository Information for ${repository}:\n\n` +
              `• Name: ${repoData.full_name}\n` +
              `• Description: ${repoData.description || "No description"}\n` +
              `• Language: ${repoData.language || "Not specified"}\n` +
              `• Stars: ${repoData.stargazers_count}\n` +
              `• Forks: ${repoData.forks_count}\n` +
              `• Open Issues: ${repoData.open_issues_count}\n` +
              `• Default Branch: ${repoData.default_branch}\n` +
              `• Created: ${repoData.created_at}\n` +
              `• Updated: ${repoData.updated_at}\n` +
              `• URL: ${repoData.html_url}\n` +
              `• Private: ${repoData.private ? "Yes" : "No"}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching repository info: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Resource: Repository activity summary
server.resource(
  "repo-activity-summary",
  "github://activity/{owner}/{repo}",
  {
    name: "Repository Activity Summary",
    description:
      "A comprehensive summary of recent activity in a GitHub repository",
    mimeType: "text/markdown",
  },
  async (uri) => {
    try {
      const urlPath = new URL(uri).pathname;
      const pathParts = urlPath.split("/");

      if (pathParts.length !== 4 || pathParts[1] !== "activity") {
        throw new Error(
          "Invalid URI format. Expected: github://activity/{owner}/{repo}"
        );
      }

      const owner = pathParts[2];
      const repo = pathParts[3];
      const repository = `${owner}/${repo}`;

      const github = getGitHubClient();

      // Fetch recent data in parallel
      const [commitsResponse, prsResponse, issuesResponse, releasesResponse] =
        await Promise.all([
          github.rest.repos.listCommits({ owner, repo, per_page: 10 }),
          github.rest.pulls.list({ owner, repo, state: "open", per_page: 10 }),
          github.rest.issues.listForRepo({
            owner,
            repo,
            state: "open",
            per_page: 10,
          }),
          github.rest.repos.listReleases({ owner, repo, per_page: 5 }),
        ]);

      const commits = commitsResponse.data.slice(0, 10);
      const pullRequests = prsResponse.data;
      const issues = issuesResponse.data.filter((issue) => !issue.pull_request);
      const releases = releasesResponse.data;

      const markdown = `# ${repository} - Activity Summary

## Recent Commits (${commits.length})
${commits
  .map(
    (commit) =>
      `- **${commit.sha.substring(0, 7)}** ${
        commit.commit.message.split("\n")[0]
      }\n  *by ${commit.commit.author?.name} on ${commit.commit.author?.date}*`
  )
  .join("\n\n")}

## Open Pull Requests (${pullRequests.length})
${
  pullRequests.length > 0
    ? pullRequests
        .map(
          (pr) =>
            `- **#${pr.number}** ${pr.title}\n  *by ${pr.user?.login} - created ${pr.created_at}*`
        )
        .join("\n\n")
    : "*No open pull requests*"
}

## Open Issues (${issues.length})
${
  issues.length > 0
    ? issues
        .map(
          (issue) =>
            `- **#${issue.number}** ${issue.title}\n  *by ${issue.user?.login} - created ${issue.created_at}*`
        )
        .join("\n\n")
    : "*No open issues*"
}

## Recent Releases (${releases.length})
${
  releases.length > 0
    ? releases
        .map(
          (release) =>
            `- **${release.name || release.tag_name}** (${
              release.tag_name
            })\n  *published ${release.published_at}*`
        )
        .join("\n\n")
    : "*No releases*"
}

---
*Generated by GitPulse MCP Server*`;

      return {
        contents: [
          {
            uri: uri.href,
            text: markdown,
            mimeType: "text/markdown",
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error generating activity summary: ${
              error instanceof Error ? error.message : String(error)
            }`,
            mimeType: "text/plain",
          },
        ],
      };
    }
  }
);

// Prompt: Plan repository monitoring
server.prompt(
  "planRepositoryMonitoring",
  "Help plan a repository monitoring strategy",
  {
    repositories: z
      .string()
      .describe(
        "Comma-separated list of repositories to monitor (owner/repo format)"
      ),
    interests: z
      .string()
      .optional()
      .describe(
        "Specific aspects you're interested in (commits, PRs, issues, releases)"
      ),
  },
  async ({ repositories, interests }) => {
    const repoList = repositories.split(",").map((r) => r.trim());
    const interestsList = interests
      ? interests.split(",").map((i) => i.trim())
      : ["commits", "pull requests", "issues", "releases"];

    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `I'll help you set up monitoring for these repositories: ${repoList.join(
              ", "
            )}.

Based on your interests (${interestsList.join(", ")}), here's a monitoring plan:

## Repositories to Monitor
${repoList.map((repo) => `- ${repo}`).join("\n")}

## Monitoring Strategy
1. **Frequency**: Check for updates every 15-30 minutes during business hours
2. **Data Points**: ${interestsList.join(", ")}
3. **Filtering**: Focus on activity within the last 24-48 hours

## Available Tools
- \`fetchNewCommits\`: Get recent commits since a timestamp
- \`fetchNewPRs\`: Get pull requests with state filtering
- \`fetchNewIssues\`: Get issues with state filtering
- \`fetchNewReleases\`: Get recent releases
- \`getRepositoryInfo\`: Get general repository information

## Next Steps
1. Set up your GitHub token in the GITHUB_TOKEN environment variable
2. Test connectivity with \`getRepositoryInfo\` for each repository
3. Establish baseline timestamps for incremental updates
4. Configure your preferred update frequency and filtering criteria

Would you like me to test connectivity to any of these repositories or help you set up specific monitoring rules?`,
          },
        },
      ],
    };
  }
);

async function main() {
  // Check if we should run as HTTP server (for web integrations like Poke)
  const useHttp =
    process.env.MCP_TRANSPORT === "http" || process.argv.includes("--http");
  const port = parseInt(process.env.PORT || "3000");

  if (useHttp) {
    // Simple HTTP API server for web integrations
    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // Enable CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      if (
        req.method === "GET" &&
        (req.url === "/health" || req.url === "/" || req.url === "/mcp")
      ) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            status: 200,
            server: "GitPulse MCP Server",
            version: "1.0.0",
            capabilities: ["commits", "prs", "issues", "releases", "repo-info"],
            endpoints: {
              health: "/health",
              mcp: "/mcp",
              commits: "/api/commits",
              prs: "/api/prs",
              issues: "/api/issues",
              releases: "/api/releases",
              repoInfo: "/api/repo-info",
            },
          })
        );
        return;
      }

      // MCP Protocol endpoint (for Poke compatibility)
      if (req.method === "POST" && req.url === "/mcp") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const mcpRequest = JSON.parse(body || "{}");

            // Handle MCP protocol messages
            if (mcpRequest.method === "tools/list") {
              const toolsResponse = {
                tools: [
                  {
                    name: "fetchNewCommits",
                    description:
                      "Fetch new commits from a GitHub repository since a given timestamp",
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
                        },
                        per_page: {
                          type: "number",
                          description: "Number of PRs to fetch (max 100)",
                        },
                      },
                      required: ["repository"],
                    },
                  },
                  {
                    name: "fetchNewIssues",
                    description: "Fetch new issues from a GitHub repository",
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
                          description: "Filter issues by state",
                        },
                        per_page: {
                          type: "number",
                          description: "Number of issues to fetch (max 100)",
                        },
                      },
                      required: ["repository"],
                    },
                  },
                  {
                    name: "fetchNewReleases",
                    description: "Fetch new releases from a GitHub repository",
                    inputSchema: {
                      type: "object",
                      properties: {
                        repository: {
                          type: "string",
                          description: "Repository in format owner/repo",
                        },
                        per_page: {
                          type: "number",
                          description: "Number of releases to fetch (max 100)",
                        },
                      },
                      required: ["repository"],
                    },
                  },
                  {
                    name: "getRepositoryInfo",
                    description:
                      "Get general information about a GitHub repository",
                    inputSchema: {
                      type: "object",
                      properties: {
                        repository: {
                          type: "string",
                          description: "Repository in format owner/repo",
                        },
                      },
                      required: ["repository"],
                    },
                  },
                ],
              };

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(toolsResponse));
              return;
            }

            // Handle tool calls
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
                case "fetchNewIssues":
                  result = await handleIssuesRequest(toolArgs);
                  break;
                case "fetchNewReleases":
                  result = await handleReleasesRequest(toolArgs);
                  break;
                case "getRepositoryInfo":
                  result = await handleRepoInfoRequest(toolArgs);
                  break;
                default:
                  res.writeHead(400, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: "Unknown tool" }));
                  return;
              }

              const toolResponse = {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              };

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(toolResponse));
              return;
            }

            // Default MCP response
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unsupported MCP method" }));
          } catch (error) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              })
            );
          }
        });
        return;
      }

      // Basic MCP-like API endpoint
      if (req.method === "POST" && req.url?.startsWith("/api/")) {
        const url = new URL(req.url, `http://localhost:${port}`);
        const action = url.pathname.replace("/api/", "");

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const params = JSON.parse(body || "{}");
            let data;

            switch (action) {
              case "commits":
                data = await handleCommitsRequest(params);
                break;
              case "prs":
                data = await handlePRsRequest(params);
                break;
              case "issues":
                data = await handleIssuesRequest(params);
                break;
              case "releases":
                data = await handleReleasesRequest(params);
                break;
              case "repo-info":
                data = await handleRepoInfoRequest(params);
                break;
              default:
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    success: false,
                    error: "Unknown action",
                    status: 400,
                  })
                );
                return;
            }

            const result = {
              success: true,
              status: 200,
              data: data,
              timestamp: new Date().toISOString(),
              action: action,
            };

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          } catch (error) {
            const errorResult = {
              success: false,
              status: 500,
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            };
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify(errorResult));
          }
        });
        return;
      }

      // Default response
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          status: 404,
          error: "Endpoint not found",
          availableEndpoints: [
            "/health",
            "/api/commits",
            "/api/prs",
            "/api/issues",
            "/api/releases",
            "/api/repo-info",
          ],
        })
      );
    });

    httpServer.listen(port, "0.0.0.0", () => {
      console.error(`GitPulse HTTP Server running on port ${port}`);
      console.error(`Health check: /health`);
      console.error(`MCP endpoint: /mcp`);
      console.error(
        `API endpoints: /api/{commits,prs,issues,releases,repo-info}`
      );
      console.error(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } else {
    // Stdio transport for command-line clients
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GitPulse MCP Server running on stdio");
  }
}

// Helper functions for HTTP API
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

async function handleIssuesRequest(params: any) {
  const github = getGitHubClient();
  const { owner, repo } = parseRepository(params.repository);

  const response = await github.rest.issues.listForRepo({
    owner,
    repo,
    state: params.state || "open",
    per_page: Math.min(params.per_page || 30, 100),
    sort: "created",
    direction: "desc",
  });

  return response.data
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      author: issue.user?.login || "Unknown",
      state: issue.state,
      created_at: issue.created_at,
      html_url: issue.html_url,
    }));
}

async function handleReleasesRequest(params: any) {
  const github = getGitHubClient();
  const { owner, repo } = parseRepository(params.repository);

  const response = await github.rest.repos.listReleases({
    owner,
    repo,
    per_page: Math.min(params.per_page || 10, 100),
  });

  return response.data.map((release) => ({
    tag_name: release.tag_name,
    name: release.name || release.tag_name,
    published_at: release.published_at || "",
    html_url: release.html_url,
    body: release.body || "",
  }));
}

async function handleRepoInfoRequest(params: any) {
  const github = getGitHubClient();
  const { owner, repo } = parseRepository(params.repository);

  const response = await github.rest.repos.get({ owner, repo });
  const repoData = response.data;

  return {
    full_name: repoData.full_name,
    description: repoData.description || "No description",
    language: repoData.language || "Not specified",
    stargazers_count: repoData.stargazers_count,
    forks_count: repoData.forks_count,
    open_issues_count: repoData.open_issues_count,
    default_branch: repoData.default_branch,
    created_at: repoData.created_at,
    updated_at: repoData.updated_at,
    html_url: repoData.html_url,
    private: repoData.private,
  };
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.error("Shutting down GitPulse MCP Server...");
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.error("Shutting down GitPulse MCP Server...");
  await server.close();
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error in GitPulse MCP Server:", error);
  process.exit(1);
});
