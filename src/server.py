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

@mcp.tool(description="Fetch issues from a GitHub repository")
def fetchNewIssues(repository: str, state: str = "open", per_page: int = 30, labels: str = None) -> List[Dict[str, Any]]:
    """
    Fetch issues from a GitHub repository.

    Args:
        repository: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
        state: Filter issues by state ('open', 'closed', 'all', default 'open')
        per_page: Number of issues to fetch (max 100, default 30)
        labels: Comma-separated list of labels to filter by (optional)

    Returns:
        List of issue objects with number, title, author, state, created_at, labels, and html_url
    """
    try:
        github = get_github_client()
        owner, repo_name = parse_repository(repository)

        # Get repository
        repo = github.get_repo(f"{owner}/{repo_name}")

        # Prepare parameters
        per_page = min(per_page, 100)  # GitHub API limit
        kwargs = {
            "state": state,
            "sort": "created",
            "direction": "desc"
        }

        if labels:
            kwargs["labels"] = [label.strip() for label in labels.split(",")]

        # Get issues
        issues = repo.get_issues(**kwargs)

        # Convert to list with pagination
        results = []
        count = 0
        for issue in issues:
            if count >= per_page:
                break

            # Skip pull requests (GitHub API treats PRs as issues)
            if issue.pull_request:
                continue

            results.append({
                "number": issue.number,
                "title": issue.title,
                "author": issue.user.login if issue.user else "Unknown",
                "state": issue.state,
                "created_at": issue.created_at.isoformat() if issue.created_at else "",
                "labels": [label.name for label in issue.labels] if issue.labels else [],
                "assignees": [assignee.login for assignee in issue.assignees] if issue.assignees else [],
                "html_url": issue.html_url
            })
            count += 1

        return results

    except Exception as e:
        raise Exception(f"Error fetching issues: {str(e)}")

@mcp.tool(description="Fetch releases from a GitHub repository")
def fetchReleases(repository: str, per_page: int = 30) -> List[Dict[str, Any]]:
    """
    Fetch releases from a GitHub repository.

    Args:
        repository: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
        per_page: Number of releases to fetch (max 100, default 30)

    Returns:
        List of release objects with tag_name, name, author, published_at, prerelease, draft, and html_url
    """
    try:
        github = get_github_client()
        owner, repo_name = parse_repository(repository)

        # Get repository
        repo = github.get_repo(f"{owner}/{repo_name}")

        # Prepare parameters
        per_page = min(per_page, 100)  # GitHub API limit

        # Get releases
        releases = repo.get_releases()

        # Convert to list with pagination
        results = []
        count = 0
        for release in releases:
            if count >= per_page:
                break

            results.append({
                "tag_name": release.tag_name,
                "name": release.title if release.title else release.tag_name,
                "author": release.author.login if release.author else "Unknown",
                "published_at": release.published_at.isoformat() if release.published_at else "",
                "created_at": release.created_at.isoformat() if release.created_at else "",
                "prerelease": release.prerelease,
                "draft": release.draft,
                "body": release.body[:500] + "..." if release.body and len(release.body) > 500 else release.body,
                "download_count": sum(asset.download_count for asset in release.get_assets()) if release.get_assets() else 0,
                "assets_count": release.get_assets().totalCount if release.get_assets() else 0,
                "html_url": release.html_url
            })
            count += 1

        return results

    except Exception as e:
        raise Exception(f"Error fetching releases: {str(e)}")

@mcp.tool(description="Get repository statistics and health metrics")
def getRepoStats(repository: str) -> Dict[str, Any]:
    """
    Get comprehensive repository statistics and health metrics.

    Args:
        repository: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')

    Returns:
        Dictionary with repository statistics including stars, forks, issues, size, and health metrics
    """
    try:
        github = get_github_client()
        owner, repo_name = parse_repository(repository)

        # Get repository
        repo = github.get_repo(f"{owner}/{repo_name}")

        # Get basic stats
        stats = {
            "name": repo.name,
            "full_name": repo.full_name,
            "description": repo.description,
            "stars": repo.stargazers_count,
            "forks": repo.forks_count,
            "watchers": repo.watchers_count,
            "open_issues": repo.open_issues_count,
            "size_kb": repo.size,
            "language": repo.language,
            "languages": {},
            "created_at": repo.created_at.isoformat() if repo.created_at else "",
            "updated_at": repo.updated_at.isoformat() if repo.updated_at else "",
            "pushed_at": repo.pushed_at.isoformat() if repo.pushed_at else "",
            "default_branch": repo.default_branch,
            "archived": repo.archived,
            "disabled": repo.disabled,
            "private": repo.private,
            "fork": repo.fork,
            "has_issues": repo.has_issues,
            "has_projects": repo.has_projects,
            "has_wiki": repo.has_wiki,
            "has_pages": repo.has_pages,
            "license": repo.license.name if repo.license else None,
            "html_url": repo.html_url
        }

        # Get language breakdown (this might fail for private repos without token)
        try:
            languages = repo.get_languages()
            stats["languages"] = dict(languages)
        except Exception:
            stats["languages"] = {}

        # Get contributor count (approximate)
        try:
            contributors = repo.get_contributors()
            stats["contributors_count"] = contributors.totalCount
        except Exception:
            stats["contributors_count"] = 0

        # Calculate health score (simple metric)
        health_score = 0
        if repo.description:
            health_score += 10
        if repo.license:
            health_score += 15
        if repo.has_wiki:
            health_score += 10
        if repo.has_issues:
            health_score += 10
        if stats["contributors_count"] > 1:
            health_score += 15
        if repo.stargazers_count > 10:
            health_score += 20
        if repo.stargazers_count > 100:
            health_score += 20

        stats["health_score"] = min(health_score, 100)

        return stats

    except Exception as e:
        raise Exception(f"Error fetching repository stats: {str(e)}")

@mcp.tool(description="Fetch GitHub Actions workflow runs")
def fetchWorkflowRuns(repository: str, per_page: int = 30, status: str = None, branch: str = None) -> List[Dict[str, Any]]:
    """
    Fetch GitHub Actions workflow runs from a repository.

    Args:
        repository: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
        per_page: Number of workflow runs to fetch (max 100, default 30)
        status: Filter by status ('completed', 'action_required', 'cancelled', 'failure', 'neutral', 'skipped', 'stale', 'success', 'timed_out', 'in_progress', 'queued', 'requested', 'waiting', 'pending')
        branch: Filter by branch name (optional)

    Returns:
        List of workflow run objects with id, name, status, conclusion, created_at, and html_url
    """
    try:
        github = get_github_client()
        owner, repo_name = parse_repository(repository)

        # Get repository
        repo = github.get_repo(f"{owner}/{repo_name}")

        # Prepare parameters
        per_page = min(per_page, 100)  # GitHub API limit
        kwargs = {}

        if status:
            kwargs["status"] = status
        if branch:
            kwargs["branch"] = branch

        # Get workflow runs
        runs = repo.get_workflow_runs(**kwargs)

        # Convert to list with pagination
        results = []
        count = 0
        for run in runs:
            if count >= per_page:
                break

            # Get workflow name (might require additional API call)
            workflow_name = "Unknown"
            try:
                if run.workflow_id:
                    workflow = repo.get_workflow(run.workflow_id)
                    workflow_name = workflow.name
            except Exception:
                pass

            results.append({
                "id": run.id,
                "name": run.name if hasattr(run, 'name') and run.name else workflow_name,
                "workflow_name": workflow_name,
                "status": run.status,
                "conclusion": run.conclusion,
                "event": run.event,
                "branch": run.head_branch,
                "commit_sha": run.head_sha[:8] if run.head_sha else "",
                "created_at": run.created_at.isoformat() if run.created_at else "",
                "updated_at": run.updated_at.isoformat() if run.updated_at else "",
                "run_number": run.run_number,
                "actor": run.actor.login if run.actor else "Unknown",
                "html_url": run.html_url
            })
            count += 1

        return results

    except Exception as e:
        raise Exception(f"Error fetching workflow runs: {str(e)}")

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
