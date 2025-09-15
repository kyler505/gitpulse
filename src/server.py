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

@mcp.tool(description="Fetch detailed information about a specific GitHub issue")
def fetchIssueDetails(repository: str, issue_number: int) -> Dict[str, Any]:
    """
    Fetch detailed information about a specific GitHub issue.

    Args:
        repository: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
        issue_number: The issue number to fetch details for

    Returns:
        Dictionary with detailed issue information including body, comments count, reactions, and timeline
    """
    try:
        github = get_github_client()
        owner, repo_name = parse_repository(repository)

        # Get repository
        repo = github.get_repo(f"{owner}/{repo_name}")

        # Get the specific issue
        issue = repo.get_issue(issue_number)

        # Skip if this is actually a pull request
        if issue.pull_request:
            raise ValueError(f"Issue #{issue_number} is actually a pull request. Use PR-specific tools instead.")

        # Build detailed issue information
        result = {
            "number": issue.number,
            "title": issue.title,
            "body": issue.body if issue.body else "",
            "author": issue.user.login if issue.user else "Unknown",
            "state": issue.state,
            "created_at": issue.created_at.isoformat() if issue.created_at else "",
            "updated_at": issue.updated_at.isoformat() if issue.updated_at else "",
            "closed_at": issue.closed_at.isoformat() if issue.closed_at else None,
            "labels": [{"name": label.name, "color": label.color, "description": label.description} for label in issue.labels] if issue.labels else [],
            "assignees": [{"login": assignee.login, "html_url": assignee.html_url} for assignee in issue.assignees] if issue.assignees else [],
            "milestone": {
                "title": issue.milestone.title,
                "description": issue.milestone.description,
                "state": issue.milestone.state,
                "due_on": issue.milestone.due_on.isoformat() if issue.milestone.due_on else None
            } if issue.milestone else None,
            "comments_count": issue.comments,
            "reactions": {
                "total_count": issue.reactions["total_count"],
                "+1": issue.reactions["+1"],
                "-1": issue.reactions["-1"],
                "laugh": issue.reactions["laugh"],
                "hooray": issue.reactions["hooray"],
                "confused": issue.reactions["confused"],
                "heart": issue.reactions["heart"],
                "rocket": issue.reactions["rocket"],
                "eyes": issue.reactions["eyes"]
            } if hasattr(issue, 'reactions') else {},
            "locked": issue.locked,
            "active_lock_reason": issue.active_lock_reason,
            "html_url": issue.html_url,
            "repository": {
                "name": repo.name,
                "full_name": repo.full_name,
                "html_url": repo.html_url
            }
        }

        return result

    except Exception as e:
        raise Exception(f"Error fetching issue details: {str(e)}")

@mcp.tool(description="Fetch comments from a specific GitHub issue")
def fetchIssueComments(repository: str, issue_number: int, per_page: int = 30) -> List[Dict[str, Any]]:
    """
    Fetch comments from a specific GitHub issue.

    Args:
        repository: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
        issue_number: The issue number to fetch comments for
        per_page: Number of comments to fetch (max 100, default 30)

    Returns:
        List of comment objects with id, body, author, created_at, updated_at, and reactions
    """
    try:
        github = get_github_client()
        owner, repo_name = parse_repository(repository)

        # Get repository
        repo = github.get_repo(f"{owner}/{repo_name}")

        # Get the specific issue
        issue = repo.get_issue(issue_number)

        # Skip if this is actually a pull request
        if issue.pull_request:
            raise ValueError(f"Issue #{issue_number} is actually a pull request. Use PR-specific tools instead.")

        # Prepare parameters
        per_page = min(per_page, 100)  # GitHub API limit

        # Get comments
        comments = issue.get_comments()

        # Convert to list with pagination
        results = []
        count = 0
        for comment in comments:
            if count >= per_page:
                break

            result_comment = {
                "id": comment.id,
                "body": comment.body if comment.body else "",
                "author": comment.user.login if comment.user else "Unknown",
                "author_association": comment.author_association if hasattr(comment, 'author_association') else "NONE",
                "created_at": comment.created_at.isoformat() if comment.created_at else "",
                "updated_at": comment.updated_at.isoformat() if comment.updated_at else "",
                "html_url": comment.html_url,
                "reactions": {
                    "total_count": comment.reactions["total_count"],
                    "+1": comment.reactions["+1"],
                    "-1": comment.reactions["-1"],
                    "laugh": comment.reactions["laugh"],
                    "hooray": comment.reactions["hooray"],
                    "confused": comment.reactions["confused"],
                    "heart": comment.reactions["heart"],
                    "rocket": comment.reactions["rocket"],
                    "eyes": comment.reactions["eyes"]
                } if hasattr(comment, 'reactions') else {}
            }

            results.append(result_comment)
            count += 1

        return results

    except Exception as e:
        raise Exception(f"Error fetching issue comments: {str(e)}")

@mcp.tool(description="Add a comment to a GitHub issue")
def addIssueComment(repository: str, issue_number: int, comment_body: str) -> Dict[str, Any]:
    """
    Add a comment to a specific GitHub issue.

    Args:
        repository: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
        issue_number: The issue number to add a comment to
        comment_body: The content of the comment to add

    Returns:
        Dictionary with the created comment information including id, body, author, and creation time
    """
    try:
        github = get_github_client()

        # Check if we have authentication
        if not os.environ.get("GITHUB_TOKEN"):
            raise Exception("GitHub token is required to add comments. Please set the GITHUB_TOKEN environment variable.")

        owner, repo_name = parse_repository(repository)

        # Get repository
        repo = github.get_repo(f"{owner}/{repo_name}")

        # Get the specific issue
        issue = repo.get_issue(issue_number)

        # Skip if this is actually a pull request
        if issue.pull_request:
            raise ValueError(f"Issue #{issue_number} is actually a pull request. Use PR-specific tools instead.")

        # Check if the issue is locked
        if issue.locked:
            raise Exception(f"Issue #{issue_number} is locked and cannot accept new comments.")

        # Validate comment body
        if not comment_body or not comment_body.strip():
            raise ValueError("Comment body cannot be empty.")

        # Add the comment
        comment = issue.create_comment(comment_body.strip())

        # Return the created comment information
        result = {
            "id": comment.id,
            "body": comment.body,
            "author": comment.user.login if comment.user else "Unknown",
            "author_association": comment.author_association if hasattr(comment, 'author_association') else "NONE",
            "created_at": comment.created_at.isoformat() if comment.created_at else "",
            "updated_at": comment.updated_at.isoformat() if comment.updated_at else "",
            "html_url": comment.html_url,
            "issue_number": issue_number,
            "repository": f"{owner}/{repo_name}",
            "success": True
        }

        return result

    except Exception as e:
        raise Exception(f"Error adding comment to issue: {str(e)}")

@mcp.tool(description="Update an existing comment on a GitHub issue")
def updateIssueComment(repository: str, comment_id: int, comment_body: str) -> Dict[str, Any]:
    """
    Update an existing comment on a GitHub issue.

    Args:
        repository: Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
        comment_id: The ID of the comment to update
        comment_body: The new content for the comment

    Returns:
        Dictionary with the updated comment information
    """
    try:
        github = get_github_client()

        # Check if we have authentication
        if not os.environ.get("GITHUB_TOKEN"):
            raise Exception("GitHub token is required to update comments. Please set the GITHUB_TOKEN environment variable.")

        owner, repo_name = parse_repository(repository)

        # Get repository
        repo = github.get_repo(f"{owner}/{repo_name}")

        # Get the specific comment
        comment = repo.get_issue_comment(comment_id)

        # Validate comment body
        if not comment_body or not comment_body.strip():
            raise ValueError("Comment body cannot be empty.")

        # Update the comment
        comment.edit(comment_body.strip())

        # Return the updated comment information
        result = {
            "id": comment.id,
            "body": comment.body,
            "author": comment.user.login if comment.user else "Unknown",
            "author_association": comment.author_association if hasattr(comment, 'author_association') else "NONE",
            "created_at": comment.created_at.isoformat() if comment.created_at else "",
            "updated_at": comment.updated_at.isoformat() if comment.updated_at else "",
            "html_url": comment.html_url,
            "repository": f"{owner}/{repo_name}",
            "success": True,
            "action": "updated"
        }

        return result

    except Exception as e:
        raise Exception(f"Error updating comment: {str(e)}")

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
