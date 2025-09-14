# GitPulse MCP Server

A Model Context Protocol (MCP) server that monitors GitHub repositories and delivers summarized updates via Poke Automations. Built with FastMCP for maximum compatibility.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kyler505/gitpulse)

## Features

- **GitHub API Integration**: Monitor commits, pull requests, issues, and releases
- **FastMCP Framework**: Built using the verified FastMCP library for Poke compatibility
- **MCP Protocol**: Compatible with Poke Automations and other MCP clients
- **Secure Authentication**: Uses GitHub Personal Access Tokens
- **Cloud Deployment**: Ready for Render.com deployment

## Available Tools

### fetchNewCommits
Fetch recent commits from a GitHub repository.
- **repository**: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
- **per_page**: Number of commits to fetch (max 100, default 30)
- **since**: ISO 8601 timestamp to fetch commits since (optional)

### fetchNewPRs
Fetch pull requests from a GitHub repository.
- **repository**: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
- **state**: Filter PRs by state ('open', 'closed', 'all', default 'open')
- **per_page**: Number of PRs to fetch (max 100, default 30)

### get_server_info
Get information about the GitPulse MCP server including version and configuration status.

## Quick Start

### 1. Environment Setup
```bash
# Clone the repository
git clone https://github.com/kyler505/gitpulse.git
cd gitpulse

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
export GITHUB_TOKEN="your_github_personal_access_token"
```

### 2. Local Development
```bash
# Start the server
python src/server.py
```

The server will be available at `http://localhost:8000/mcp`

### 3. Testing with MCP Inspector
```bash
# In another terminal
npx @modelcontextprotocol/inspector
```
Open http://localhost:3000 and connect to `http://localhost:8000/mcp` using "Streamable HTTP" transport.

## Deployment

### Render.com (Recommended)
1. Click the "Deploy to Render" button above, or
2. Fork this repository
3. Connect your GitHub account to Render
4. Create a new Web Service on Render
5. Connect your forked repository
6. Render will automatically detect the `render.yaml` configuration
7. Set your `GITHUB_TOKEN` environment variable in the Render dashboard

Your server will be available at `https://your-service-name.onrender.com/mcp`

## Integration with Poke

1. Go to [https://poke.com/settings/connections/integrations/new](https://poke.com/settings/connections/integrations/new)
2. Add your deployed MCP server URL: `https://your-service-name.onrender.com/mcp`
3. Your GitPulse tools will be available in Poke Automations!

## Example Usage

Once integrated with Poke, you can use natural language commands like:
- "Get recent commits from microsoft/vscode"
- "Show me open pull requests for octocat/Hello-World"
- "What's the latest activity in the react repository?"

## Configuration

### GitHub Token
You need a GitHub personal access token to use this server:

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with `repo` scope (for private repos) or public repo access
3. Set it as the `GITHUB_TOKEN` environment variable

### Environment Variables
- `GITHUB_TOKEN`: Your GitHub personal access token (required for authenticated requests)
- `PORT`: Server port (default: 8000)
- `ENVIRONMENT`: Environment name (default: production)

## Development

### Requirements
- Python 3.8+
- FastMCP 0.2.0+
- PyGithub 2.1.1+

### Project Structure
```
GitPulse/
├── src/
│   └── server.py          # Main FastMCP server
├── requirements.txt       # Python dependencies
├── render.yaml           # Render deployment config
└── README.md
```

## License

MIT License - see the LICENSE file for details.

## Support

For issues or questions:
- Create an issue on GitHub
- Contact: [your-email@example.com]

Built with ❤️ using [FastMCP](https://github.com/jlowin/fastmcp)