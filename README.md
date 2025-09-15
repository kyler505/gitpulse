# GitPulse MCP Server

**GitPulse** - Comprehensive AI-powered GitHub repository monitoring through MCP. Track commits, PRs, issues, releases, workflows, and repository statistics via simple tool calls. Built with FastMCP for seamless AI assistant integration.

## Status

⚠️ **Under Maintenance** - This project is currently being updated and may not function properly. Please check back later for updates.

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

## Usage Examples

### Monitor Repository Activity
```python
# Get recent commits
fetchNewCommits("microsoft/vscode", per_page=10)

# Check open pull requests
fetchNewPRs("facebook/react", state="open", per_page=5)

# Find critical issues
fetchNewIssues("nodejs/node", state="open", labels="critical,bug")

# Get repository health overview
getRepoStats("torvalds/linux")
```

### Track Releases and CI/CD
```python
# Monitor latest releases
fetchReleases("python/cpython", per_page=5)

# Check GitHub Actions status
fetchWorkflowRuns("vercel/next.js", status="completed", per_page=10)
```

## Configuration

Set your GitHub token as an environment variable for authenticated access and higher rate limits:

```bash
export GITHUB_TOKEN=your_github_personal_access_token
```

Without a token, the server uses GitHub's public API with lower rate limits.

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

### Core Tools
- `greet`: Welcome message from GitPulse
- `get_server_info`: Server information and configuration status

### GitHub Monitoring Tools
- `fetchNewCommits`: Fetch recent commits with filtering by date and pagination
- `fetchNewPRs`: Fetch pull requests with state filtering (open/closed/all)
- `fetchNewIssues`: Fetch issues with state and label filtering, excluding PRs
- `fetchReleases`: Fetch repository releases with download counts and asset info
- `getRepoStats`: Get comprehensive repository statistics and health metrics
- `fetchWorkflowRuns`: Monitor GitHub Actions workflow runs with status filtering

### Features
- 🔐 **Authentication**: Supports both GitHub token authentication and public API access
- 📊 **Rich Data**: Returns comprehensive information including stats, labels, assignees, and metadata
- 🔍 **Advanced Filtering**: Filter by state, labels, branches, status, and date ranges
- 📈 **Health Metrics**: Repository health scoring based on best practices
- ⚡ **Rate Limit Aware**: Respects GitHub API limits with intelligent pagination
- 🛡️ **Error Handling**: Robust error handling for all GitHub API interactions
