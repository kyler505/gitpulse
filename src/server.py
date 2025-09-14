#!/usr/bin/env python3
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastmcp import FastMCP
from github import Github

mcp = FastMCP("GitPulse MCP Server")

# Initialize GitHub client
def get_github_client() -> Github:
    """Get authenticated GitHub client"""
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        return Github(token)
    else:
        # Use public API without authentication (rate limited)
        return Github()

def parse_repository(repo_str: str):
    """Parse repository string in format 'owner/repo'"""
    parts = repo_str.split("/")
    if len(parts) != 2:
        raise ValueError("Repository must be in format 'owner/repo'")
    return parts[0], parts[1]

@mcp.tool(description="Greet a user by name with a welcome message from the GitPulse MCP server")
def greet(name: str) -> str:
    return f"Hello, {name}! Welcome to GitPulse - your GitHub monitoring MCP server!"

@mcp.tool(description="Get information about the GitPulse MCP server including name, version, environment, and Python version")
def get_server_info() -> dict:
    return {
        "server_name": "GitPulse MCP Server",
        "version": "1.0.0",
        "description": "GitHub repository monitoring MCP server",
        "environment": os.environ.get("ENVIRONMENT", "development"),
        "python_version": os.sys.version.split()[0],
        "github_token_configured": bool(os.environ.get("GITHUB_TOKEN"))
    }

@mcp.tool(description="Fetch recent commits from a GitHub repository")
def fetchNewCommits(repository: str, per_page: int = 30, since: str = None) -> List[Dict[str, Any]]:
    """
    Fetch recent commits from a GitHub repository.

    Args:
        repository: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
        per_page: Number of commits to fetch (max 100, default 30)
        since: ISO 8601 timestamp to fetch commits since (optional)

    Returns:
        List of commit objects with sha, message, author, date, and url
    """
    try:
        github = get_github_client()
        owner, repo_name = parse_repository(repository)

        # Get repository
        repo = github.get_repo(f"{owner}/{repo_name}")

        # Prepare parameters
        per_page = min(per_page, 100)  # GitHub API limit
        kwargs = {}

        if since:
            # Parse ISO 8601 timestamp
            since_date = datetime.fromisoformat(since.replace('Z', '+00:00'))
            kwargs['since'] = since_date

        # Get commits
        commits = repo.get_commits(**kwargs)

        # Convert to list with pagination
        results = []
        count = 0
        for commit in commits:
            if count >= per_page:
                break

            results.append({
                "sha": commit.sha,
                "message": commit.commit.message,
                "author": commit.commit.author.name if commit.commit.author else "Unknown",
                "date": commit.commit.author.date.isoformat() if commit.commit.author and commit.commit.author.date else "",
                "url": commit.html_url
            })
            count += 1

        return results

    except Exception as e:
        raise Exception(f"Error fetching commits: {str(e)}")

@mcp.tool(description="Fetch pull requests from a GitHub repository")
def fetchNewPRs(repository: str, state: str = "open", per_page: int = 30) -> List[Dict[str, Any]]:
    """
    Fetch pull requests from a GitHub repository.

    Args:
        repository: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
        state: Filter PRs by state ('open', 'closed', 'all', default 'open')
        per_page: Number of PRs to fetch (max 100, default 30)

    Returns:
        List of PR objects with number, title, author, state, created_at, and html_url
    """
    try:
        github = get_github_client()
        owner, repo_name = parse_repository(repository)

        # Get repository
        repo = github.get_repo(f"{owner}/{repo_name}")

        # Prepare parameters
        per_page = min(per_page, 100)  # GitHub API limit

        # Get pull requests
        pulls = repo.get_pulls(
            state=state,
            sort="created",
            direction="desc"
        )

        # Convert to list with pagination
        results = []
        count = 0
        for pr in pulls:
            if count >= per_page:
                break

            results.append({
                "number": pr.number,
                "title": pr.title,
                "author": pr.user.login if pr.user else "Unknown",
                "state": pr.state,
                "created_at": pr.created_at.isoformat() if pr.created_at else "",
                "html_url": pr.html_url
            })
            count += 1

        return results

    except Exception as e:
        raise Exception(f"Error fetching pull requests: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0"

    print(f"Starting GitPulse FastMCP server on {host}:{port}")
    print(f"GitHub token configured: {bool(os.environ.get('GITHUB_TOKEN'))}")

    mcp.run(
        transport="http",
        host=host,
        port=port
    )
