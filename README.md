# GitPulse MCP Server

**GitPulse** - AI-powered GitHub repository monitoring through MCP. Fetch commits, PRs, and repo activity via simple tool calls. Built with FastMCP for seamless AI assistant integration.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kyler505/gitpulse)

## Local Development

### Setup

Fork the repo, then run:

```bash
git clone https://github.com/kyler505/gitpulse.git
cd gitpulse
conda create -n mcp-server python=3.13
conda activate mcp-server
pip install -r requirements.txt
```

### Test

```bash
python src/server.py
# then in another terminal run:
npx @modelcontextprotocol/inspector
```

Open http://localhost:3000 and connect to `http://localhost:8000/mcp` using "Streamable HTTP" transport (NOTE THE `/mcp`!).

## Deployment

### Option 1: One-Click Deploy
Click the "Deploy to Render" button above.

### Option 2: Manual Deployment
1. Fork this repository
2. Connect your GitHub account to Render
3. Create a new Web Service on Render
4. Connect your forked repository
5. Render will automatically detect the `render.yaml` configuration

Your server will be available at `https://your-service-name.onrender.com/mcp` (NOTE THE `/mcp`!)

## Customization

Add more tools by decorating functions with `@mcp.tool`:

```python
@mcp.tool
def fetchNewCommits(repository: str, per_page: int = 30) -> list:
    """Fetch recent commits from a GitHub repository."""
    # Implementation here
    pass
```

## Tools

- `greet`: Welcome message from GitPulse
- `get_server_info`: Server information and configuration status

More GitHub monitoring tools coming soon!
