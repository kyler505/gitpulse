# GitPulse MCP Server

A Model Context Protocol (MCP) server that monitors GitHub repositories and delivers summarized updates via Poke Automations. This server provides tools to fetch commits, pull requests, issues, and releases from GitHub repositories, as well as resources for activity summaries and prompts for planning monitoring strategies.

## Features

### Tools
- **fetchNewCommits**: Get recent commits from a repository since a given timestamp
- **fetchNewPRs**: Fetch pull requests with state filtering (open, closed, all)
- **fetchNewIssues**: Fetch issues with state filtering (open, closed, all)
- **fetchNewReleases**: Get recent releases from a repository
- **getRepositoryInfo**: Get general information about a repository

### Resources
- **repo-activity-summary**: Comprehensive markdown summary of recent repository activity accessible via `github://activity/{owner}/{repo}` URIs

### Prompts
- **planRepositoryMonitoring**: Interactive prompt to help plan a repository monitoring strategy

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd GitPulse
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### GitHub Token
You need a GitHub personal access token to use this server. Set it as an environment variable:

```bash
export GITHUB_TOKEN="your_github_token_here"
```

Or configure it in your MCP client configuration.

### MCP Client Configuration

For Claude Desktop, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gitpulse": {
      "command": "node",
      "args": ["/absolute/path/to/GitPulse/build/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

## Usage

### Command Line
```bash
# Run the server directly
npm start

# Run in development mode with file watching
npm run dev
```

### With MCP Clients

Once configured with an MCP client like Claude Desktop, you can:

1. **Monitor repository activity**: Ask for recent commits, PRs, or issues from any public repository
2. **Get repository summaries**: Request activity summaries using the resource URIs
3. **Plan monitoring strategies**: Use the planning prompt to set up monitoring for multiple repositories

### Example Queries

- "Show me the latest commits from microsoft/vscode"
- "Get the open pull requests for facebook/react"
- "What are the recent releases in nodejs/node?"
- "Give me an activity summary for the GitPulse repository"

## Technical Details

### Architecture
- **Protocol**: Model Context Protocol (MCP) over stdio
- **GitHub API**: Octokit REST API v4
- **Authentication**: GitHub Personal Access Token
- **Data Format**: JSON responses with markdown formatting for summaries

### Rate Limiting
The server respects GitHub's API rate limits:
- 5,000 requests per hour for authenticated requests
- Automatic retry handling for rate limit errors
- Configurable pagination limits (max 100 items per request)

### Security
- Tokens are passed via environment variables
- No token storage or logging
- Read-only GitHub API access
- Input validation using Zod schemas

## Development

### Scripts
- `npm run build`: Compile TypeScript to JavaScript
- `npm run dev`: Watch mode for development
- `npm start`: Run the compiled server
- `npm test`: Run tests (placeholder)

### Project Structure
```
src/
  └── index.ts          # Main MCP server implementation
build/                  # Compiled JavaScript output
.vscode/
  └── mcp.json          # MCP server configuration for VS Code
```

### Adding New Features

To add new GitHub API integrations:

1. Define TypeScript interfaces for the data structures
2. Add new tools using `server.tool()` with Zod schemas
3. Implement the GitHub API calls using the Octokit client
4. Add error handling and response formatting
5. Update this README with the new functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue in this repository
- Check the MCP documentation at https://modelcontextprotocol.io
- Refer to GitHub API documentation at https://docs.github.com/en/rest
