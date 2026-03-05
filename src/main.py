#!/usr/bin/env python3
"""
Microsoft To Do + OneNote MCP Server (Simplified MVP)

This is an all-in-one MCP server that connects Claude to Microsoft To Do and OneNote.
It enables voice-first task and note capture with ultra-low friction.

Architecture:
- OAuth 2.0 device code flow for authentication
- Microsoft Graph API for To Do and OneNote access
- MCP protocol for Claude Desktop integration
- 2 tools: create_task and create_note

Author: Learning Python while building!
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

# Third-party imports
import msal
import requests
from dateutil import parser as date_parser
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# ============================================================================
# CONFIGURATION
# ============================================================================


def load_config():
    """Load configuration from environment variables."""
    # Load .env file if it exists
    load_dotenv()

    config = {
        "client_id": os.getenv("AZURE_CLIENT_ID"),
        "tenant_id": os.getenv("AZURE_TENANT_ID", "common"),
        "authority": f"https://login.microsoftonline.com/{os.getenv('AZURE_TENANT_ID', 'common')}",
        "scopes": os.getenv("GRAPH_SCOPES", "User.Read Tasks.ReadWrite Notes.ReadWrite offline_access").split(),
        "graph_endpoint": os.getenv("GRAPH_API_ENDPOINT", "https://graph.microsoft.com/v1.0"),
        "token_cache_path": os.path.expanduser(
            os.getenv("TOKEN_CACHE_PATH", "~/.cache/mcp-ms-todo-onenote/token_cache.json")
        ),
        "default_todo_list_id": os.getenv("DEFAULT_TODO_LIST_ID"),
        "default_onenote_section_id": os.getenv("DEFAULT_ONENOTE_SECTION_ID"),
        "timezone": os.getenv("TIMEZONE", "UTC"),
    }

    # Validate required config
    if not config["client_id"]:
        raise ValueError("AZURE_CLIENT_ID not set in environment variables or .env file")

    return config


# ============================================================================
# OAUTH AUTHENTICATION
# ============================================================================


class AuthHandler:
    """Handles OAuth 2.0 authentication with Microsoft using MSAL."""

    def __init__(self, config: dict):
        self.config = config
        self.client_id = config["client_id"]
        self.authority = config["authority"]
        self.scopes = config["scopes"]
        self.token_cache_path = config["token_cache_path"]

        # Create cache directory if it doesn't exist
        os.makedirs(os.path.dirname(self.token_cache_path), exist_ok=True)

        # Initialize MSAL public client with persistent token cache
        self.app = msal.PublicClientApplication(
            client_id=self.client_id, authority=self.authority, token_cache=self._get_token_cache()
        )

    def _get_token_cache(self):
        """Load or create a persistent token cache."""
        cache = msal.SerializableTokenCache()

        # Load existing cache if available
        if os.path.exists(self.token_cache_path):
            with open(self.token_cache_path, "r") as f:
                cache.deserialize(f.read())

        return cache

    def _save_token_cache(self):
        """Save token cache to disk if it has changed."""
        cache = self.app.token_cache
        if cache.has_state_changed:
            with open(self.token_cache_path, "w") as f:
                f.write(cache.serialize())
            # Secure the token cache file (owner read/write only)
            os.chmod(self.token_cache_path, 0o600)

    def authenticate(self) -> dict:
        """
        Authenticate user and return access token.

        First tries to use cached token (silent authentication).
        If no cached token, initiates device code flow.

        Returns:
            dict: Token response with access_token, refresh_token, etc.
        """
        # Try to get token silently from cache
        accounts = self.app.get_accounts()
        if accounts:
            result = self.app.acquire_token_silent(self.scopes, account=accounts[0])
            if result and "access_token" in result:
                print("✓ Using cached authentication token", file=sys.stderr)
                self._save_token_cache()
                return result

        # No cached token - initiate device code flow
        print("\n🔐 Authentication required...", file=sys.stderr)
        flow = self.app.initiate_device_flow(scopes=self.scopes)

        if "user_code" not in flow:
            raise Exception(f"Failed to create device flow: {flow.get('error_description')}")

        # Display instructions to user
        print("\n" + "=" * 70, file=sys.stderr)
        print(flow["message"], file=sys.stderr)
        print("=" * 70 + "\n", file=sys.stderr)

        # Wait for user to complete authentication
        result = self.app.acquire_token_by_device_flow(flow)

        if "access_token" not in result:
            raise Exception(f"Authentication failed: {result.get('error_description', 'Unknown error')}")

        print("✓ Authentication successful! Token cached for future use.\n", file=sys.stderr)
        self._save_token_cache()
        return result

    def get_access_token(self) -> str:
        """Get a valid access token (handles refresh automatically)."""
        result = self.authenticate()
        return result["access_token"]


# ============================================================================
# MICROSOFT GRAPH API CLIENT
# ============================================================================


class GraphAPIClient:
    """Client for making requests to Microsoft Graph API."""

    def __init__(self, auth_handler: AuthHandler, config: dict):
        self.auth_handler = auth_handler
        self.config = config
        self.base_url = config["graph_endpoint"]

    def _get_headers(self) -> dict:
        """Get HTTP headers with fresh access token."""
        token = self.auth_handler.get_access_token()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def get(self, endpoint: str, params: Optional[dict] = None) -> dict:
        """Make GET request to Graph API."""
        url = f"{self.base_url}/{endpoint}"
        response = requests.get(url, headers=self._get_headers(), params=params)
        response.raise_for_status()
        return response.json()

    def post(self, endpoint: str, data: dict) -> dict:
        """Make POST request to Graph API."""
        url = f"{self.base_url}/{endpoint}"
        response = requests.post(url, headers=self._get_headers(), json=data)
        response.raise_for_status()
        return response.json()

    def post_html(self, endpoint: str, html_content: str) -> dict:
        """Make POST request with HTML content (for OneNote)."""
        url = f"{self.base_url}/{endpoint}"
        headers = self._get_headers()
        headers["Content-Type"] = "text/html"
        response = requests.post(url, headers=headers, data=html_content.encode("utf-8"))
        response.raise_for_status()
        return response.json()

    def patch(self, endpoint: str, data: dict) -> dict:
        """Make PATCH request to Graph API."""
        url = f"{self.base_url}/{endpoint}"
        response = requests.patch(url, headers=self._get_headers(), json=data)
        response.raise_for_status()
        return response.json()

    def delete(self, endpoint: str) -> None:
        """Make DELETE request to Graph API (returns None; API responds 204 No Content)."""
        url = f"{self.base_url}/{endpoint}"
        response = requests.delete(url, headers=self._get_headers())
        response.raise_for_status()

    # -------- Helper Methods --------

    def _resolve_list_id(self, list_id: Optional[str] = None) -> str:
        """
        Resolve list ID: user param > env default > auto-discover "Tasks" > first list.
        Raises exception if no lists exist.
        """
        if list_id:
            return list_id

        # Check environment default
        default_list_id = self.config.get("default_todo_list_id")
        if default_list_id:
            try:
                self.get(f"me/todo/lists/{default_list_id}")
                return default_list_id
            except:
                print(f"⚠️ DEFAULT_TODO_LIST_ID not found, using auto-discovery", file=sys.stderr)

        # Auto-discover
        lists = self.get_task_lists()
        default_list = next((l for l in lists if l.get("displayName") == "Tasks"),
                           lists[0] if lists else None)

        if not default_list:
            raise Exception("No task lists found. Please create a list in Microsoft To Do.")

        return default_list["id"]

    def _resolve_section_id(self, section_id: Optional[str] = None) -> str:
        """
        Resolve section ID: user param > env default > auto-discover "Quick Notes" > first section.
        """
        if section_id:
            return section_id

        default_section_id = self.config.get("default_onenote_section_id")
        if default_section_id:
            try:
                self.get(f"me/onenote/sections/{default_section_id}")
                return default_section_id
            except:
                print(f"⚠️ DEFAULT_ONENOTE_SECTION_ID not found, using auto-discovery", file=sys.stderr)

        sections = self.get_sections()
        default_section = next((s for s in sections if "Quick Notes" in s.get("displayName", "")),
                              sections[0] if sections else None)

        if not default_section:
            raise Exception("No OneNote sections found. Please create a section.")

        return default_section["id"]

    # -------- Microsoft To Do Methods --------

    def get_task_lists(self) -> list:
        """Get all Microsoft To Do task lists."""
        result = self.get("me/todo/lists")
        return result.get("value", [])

    def create_task(
        self,
        title: str,
        due_date: Optional[str] = None,
        list_id: Optional[str] = None,
        reminder_datetime: Optional[str] = None,
        note_url: Optional[str] = None
    ) -> dict:
        """
        Create a new task in Microsoft To Do with enhanced parameters.

        Args:
            title: Task title (required)
            due_date: Due date in ISO format (YYYY-MM-DD) or None
            list_id: Target list ID (if None, uses default via _resolve_list_id)
            reminder_datetime: Reminder in ISO 8601 format with Z suffix
            note_url: URL to related OneNote page

        Returns:
            dict: Created task object with _listName added
        """
        # Resolve list ID
        list_id = self._resolve_list_id(list_id)

        # Build task data
        task_data = {"title": title}

        # Add due date if provided
        if due_date:
            task_data["dueDateTime"] = {"dateTime": f"{due_date}T12:00:00", "timeZone": "UTC"}

        # Add reminder if provided
        if reminder_datetime:
            task_data["reminderDateTime"] = {"dateTime": reminder_datetime, "timeZone": "UTC"}
            task_data["isReminderOn"] = True

        # Add note URL to task body if provided
        if note_url:
            task_data["body"] = {"content": f"Related note: {note_url}", "contentType": "text"}

        # Create task
        task = self.post(f"me/todo/lists/{list_id}/tasks", task_data)

        # Add list metadata for response formatting
        list_info = self.get(f"me/todo/lists/{list_id}")
        task["_listName"] = list_info["displayName"]

        return task

    def update_task(
        self,
        task_id: str,
        list_id: str,
        title: Optional[str] = None,
        due_date: Optional[str] = None,
        reminder_datetime: Optional[str] = None,
        is_completed: Optional[bool] = None,
        note_url: Optional[str] = None
    ) -> dict:
        """
        Update an existing task in Microsoft To Do.

        Args:
            task_id: Task ID to update (required)
            list_id: List ID containing the task (required)
            title: New title (None = no change)
            due_date: New due date in ISO format (None = no change)
            reminder_datetime: New reminder datetime (None = no change)
            is_completed: Mark as completed/incomplete (None = no change)
            note_url: Add/update note URL (None = no change)

        Returns:
            dict: Updated task object with _listName added
        """
        # Build update data (only include non-None fields)
        update_data = {}

        if title is not None:
            update_data["title"] = title

        if due_date is not None:
            update_data["dueDateTime"] = {"dateTime": f"{due_date}T12:00:00", "timeZone": "UTC"}

        if reminder_datetime is not None:
            update_data["reminderDateTime"] = {"dateTime": reminder_datetime, "timeZone": "UTC"}
            update_data["isReminderOn"] = True

        if is_completed is not None:
            update_data["status"] = "completed" if is_completed else "notStarted"

        if note_url is not None:
            update_data["body"] = {"content": f"Related note: {note_url}", "contentType": "text"}

        # Update task
        task = self.patch(f"me/todo/lists/{list_id}/tasks/{task_id}", update_data)

        # Add list metadata
        list_info = self.get(f"me/todo/lists/{list_id}")
        task["_listName"] = list_info["displayName"]

        return task

    def search_tasks(self, query: str, list_id: Optional[str] = None) -> list:
        """
        Search for tasks by title (case-insensitive).

        Args:
            query: Search query (required)
            list_id: Limit search to specific list (None = search all lists)

        Returns:
            list: Matching tasks with _listName added to each
        """
        results = []

        # Escape single quotes for OData filter
        safe_query = query.replace("'", "''").lower()

        # Determine which lists to search
        lists_to_search = [{"id": list_id}] if list_id else self.get_task_lists()

        for task_list in lists_to_search:
            try:
                # Use $filter with contains for case-insensitive search
                filter_query = f"contains(tolower(title), '{safe_query}')"
                response = self.get(
                    f"me/todo/lists/{task_list['id']}/tasks",
                    params={"$filter": filter_query}
                )

                tasks = response.get("value", [])

                # Add list name to each task
                for task in tasks:
                    task["_listName"] = task_list.get("displayName", "Unknown")

                results.extend(tasks)
            except:
                # Skip lists that error (e.g., deleted)
                continue

        return results

    def get_tasks(self, list_id: str) -> list:
        """
        Get all tasks from a specific To Do list.

        Args:
            list_id: List ID to retrieve tasks from (required)

        Returns:
            list: All tasks with _listName added to each
        """
        response = self.get(f"me/todo/lists/{list_id}/tasks")
        tasks = response.get("value", [])
        list_info = self.get(f"me/todo/lists/{list_id}")
        list_name = list_info["displayName"]
        for task in tasks:
            task["_listName"] = list_name
        return tasks

    def delete_task(self, task_id: str, list_id: str) -> None:
        """
        Delete a task from a To Do list.

        Args:
            task_id: Task ID to delete (required)
            list_id: List ID containing the task (required)
        """
        self.delete(f"me/todo/lists/{list_id}/tasks/{task_id}")

    def create_list(self, name: str) -> dict:
        """
        Create a new Microsoft To Do task list.

        Args:
            name: Display name for the new list (required)

        Returns:
            dict: Created list object
        """
        return self.post("me/todo/lists", {"displayName": name})

    # -------- OneNote Methods --------

    def get_notebooks(self) -> list:
        """Get all OneNote notebooks."""
        result = self.get("me/onenote/notebooks")
        return result.get("value", [])

    def get_sections(self) -> list:
        """Get all OneNote sections."""
        result = self.get("me/onenote/sections")
        return result.get("value", [])

    def create_note(self, title: str, content: str, section_id: Optional[str] = None) -> dict:
        """
        Create a new OneNote page with enhanced response.

        Args:
            title: Note title
            content: Note content (plain text)
            section_id: Target section ID (if None, uses default via _resolve_section_id)

        Returns:
            dict: Created page object with _sectionName added
        """
        # Resolve section ID
        section_id = self._resolve_section_id(section_id)

        # Build HTML content for OneNote page
        newline = '\n'
        formatted_content = content.replace(newline, '<br>')
        html_content = f"""<!DOCTYPE html>
<html>
  <head>
    <title>{title}</title>
  </head>
  <body>
    <p>{formatted_content}</p>
  </body>
</html>"""

        # Create page
        page = self.post_html(f"me/onenote/sections/{section_id}/pages", html_content)

        # Add section metadata for response formatting
        section_info = self.get(f"me/onenote/sections/{section_id}")
        page["_sectionName"] = section_info["displayName"]

        return page

    def update_note_append(self, page_id: str, content: str) -> dict:
        """
        Append content to existing OneNote page.

        Args:
            page_id: Page ID to update (required)
            content: Content to append (plain text)

        Returns:
            dict: Updated page object
        """
        # PATCH requires JSON array of operations
        patch_operations = [
            {
                "target": "body",
                "action": "append",
                "content": f"<p>{content.replace(chr(10), '<br>')}</p>"
            }
        ]

        # Note: Graph API returns 204 No Content for successful PATCH
        url = f"{self.base_url}/me/onenote/pages/{page_id}/content"
        headers = self._get_headers()
        response = requests.patch(url, headers=headers, json=patch_operations)
        response.raise_for_status()

        # Fetch updated page to return
        return self.get(f"me/onenote/pages/{page_id}")

    def search_notes(self, query: str, section_id: Optional[str] = None) -> list:
        """
        Search for OneNote pages by title (case-insensitive).

        Args:
            query: Search query (required)
            section_id: Limit search to specific section (None = search all sections)

        Returns:
            list: Matching pages with _sectionName added to each
        """
        results = []

        # Escape single quotes for OData filter
        safe_query = query.replace("'", "''").lower()

        # Determine search scope
        sections_to_search = [{"id": section_id}] if section_id else self.get_sections()

        for section in sections_to_search:
            try:
                filter_query = f"contains(tolower(title), '{safe_query}')"
                response = self.get(
                    f"me/onenote/sections/{section['id']}/pages",
                    params={"$filter": filter_query}
                )

                pages = response.get("value", [])

                # Add section name to each page
                for page in pages:
                    page["_sectionName"] = section.get("displayName", "Unknown")

                results.extend(pages)
            except:
                # Skip sections that error
                continue

        return results

    def get_notes(self, section_id: str) -> list:
        """
        Get all pages from a specific OneNote section.

        Args:
            section_id: Section ID to retrieve pages from (required)

        Returns:
            list: All pages with _sectionName added to each
        """
        response = self.get(f"me/onenote/sections/{section_id}/pages")
        pages = response.get("value", [])
        section_info = self.get(f"me/onenote/sections/{section_id}")
        section_name = section_info["displayName"]
        for page in pages:
            page["_sectionName"] = section_name
        return pages

    def delete_note(self, page_id: str) -> None:
        """
        Delete a OneNote page.

        Args:
            page_id: Page ID to delete (required)
        """
        self.delete(f"me/onenote/pages/{page_id}")


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================


def parse_natural_date(date_string: str) -> Optional[str]:
    """
    Parse natural language date to ISO format (YYYY-MM-DD).

    Examples:
        "tomorrow" -> "2026-02-12"
        "next monday" -> "2026-02-17"
        "2026-02-15" -> "2026-02-15"

    Returns:
        str: ISO date string or None if parsing fails
    """
    if not date_string:
        return None

    date_string_lower = date_string.lower().strip()

    # Handle common phrases
    today = datetime.now().date()

    if date_string_lower in ["today", "now"]:
        return today.isoformat()
    elif date_string_lower == "tomorrow":
        return (today + timedelta(days=1)).isoformat()
    elif date_string_lower == "next week":
        return (today + timedelta(weeks=1)).isoformat()

    # Try parsing with dateutil
    try:
        parsed = date_parser.parse(date_string, fuzzy=True)
        return parsed.date().isoformat()
    except:
        # If parsing fails, return None
        return None


def parse_natural_datetime(datetime_string: str) -> Optional[str]:
    """
    Parse natural language datetime to ISO 8601 with UTC timezone.

    Examples:
        "tomorrow at 5pm" -> "2026-02-16T17:00:00Z"
        "next Monday 9am" -> "2026-02-17T09:00:00Z"
        "7 PM today" -> "2026-02-15T19:00:00Z"
        "2026-02-20T14:00:00Z" -> "2026-02-20T14:00:00Z"

    Returns:
        str: ISO 8601 datetime string with Z suffix or None if parsing fails
    """
    if not datetime_string:
        return None

    # If already ISO format with Z, return as-is
    if 'T' in datetime_string and 'Z' in datetime_string:
        return datetime_string

    # Try parsing with dateutil
    try:
        # Handle "today" explicitly to ensure correct date
        datetime_string_lower = datetime_string.lower()
        if "today" in datetime_string_lower:
            # Replace "today" with actual date to avoid parsing issues
            today = datetime.now().date().isoformat()
            datetime_string_normalized = datetime_string_lower.replace("today", today)
            parsed = date_parser.parse(datetime_string_normalized, fuzzy=True)
        else:
            parsed = date_parser.parse(datetime_string, fuzzy=True)

        return parsed.strftime("%Y-%m-%dT%H:%M:%SZ")
    except:
        return None


def format_task_response(task: dict, action: str = "Created") -> str:
    """Format task with list, due date, reminder, and link."""
    parts = [f"✓ {action} task: {task['title']}"]

    if "_listName" in task:
        parts.append(f'in list "{task["_listName"]}"')

    if task.get("dueDateTime"):
        due_date = task["dueDateTime"]["dateTime"].split("T")[0]
        parts.append(f"Due: {due_date}")

    if task.get("isReminderOn") and task.get("reminderDateTime"):
        reminder = task["reminderDateTime"]["dateTime"]
        parts.append(f"Reminder: {reminder}")

    task_url = f"https://to-do.microsoft.com/tasks/id/{task['id']}"
    parts.append(f"Link: {task_url}")

    return " | ".join(parts)


def format_note_response(page: dict, action: str = "Created") -> str:
    """Format note with section, URL, and timestamp."""
    parts = [f"✓ {action} note: {page['title']}"]

    if "_sectionName" in page:
        parts.append(f'in section "{page["_sectionName"]}"')

    # Prefer desktop app URL (opens in OneNote app), fallback to web URL
    links = page.get("links", {})
    app_url = links.get("oneNoteClientUrl", {}).get("href")
    web_url = links.get("oneNoteWebUrl", {}).get("href")

    if app_url:
        parts.append(f"App Link: {app_url}")
        if web_url:
            parts.append(f"Web Link: {web_url}")
    elif web_url:
        parts.append(f"Link: {web_url}")

    if page.get("createdDateTime"):
        created = page["createdDateTime"].split("T")[0]
        parts.append(f"Created: {created}")

    return " | ".join(parts)


def format_search_results(items: list, item_type: str) -> str:
    """Format search results for tasks or notes."""
    if not items:
        return f"No {item_type}s found matching your query."

    lines = [f"Found {len(items)} {item_type}(s):"]

    for item in items:
        if item_type == "task":
            list_name = item.get("_listName", "Unknown")
            due_info = ""
            if item.get("dueDateTime"):
                due_date = item["dueDateTime"]["dateTime"].split("T")[0]
                due_info = f" (Due: {due_date})"

            lines.append(f"  - {item['title']}{due_info} | List: {list_name} | ID: {item['id']}")
        else:  # note
            section_name = item.get("_sectionName", "Unknown")
            # Prefer app URL over web URL
            links = item.get("links", {})
            url = links.get("oneNoteClientUrl", {}).get("href") or links.get("oneNoteWebUrl", {}).get("href", "N/A")
            lines.append(f"  - {item['title']} | Section: {section_name} | ID: {item['id']} | URL: {url}")

    return "\n".join(lines)


# ============================================================================
# MCP SERVER
# ============================================================================


class MCPTodoOneNoteServer:
    """MCP Server for Microsoft To Do and OneNote integration."""

    def __init__(self):
        # Load configuration
        self.config = load_config()

        # Initialize authentication
        self.auth_handler = AuthHandler(self.config)

        # Initialize Graph API client
        self.graph_client = GraphAPIClient(self.auth_handler, self.config)

        # Create MCP server
        self.server = FastMCP("microsoft-todo-onenote")

        # Register MCP tools
        self._register_tools()

    def _register_tools(self):
        """Register MCP tools with the server."""

        # ========== CREATE TASK TOOL ==========
        @self.server.tool()
        async def create_task(
            title: str,
            due_date: str = None,
            list_id: str = None,
            reminder_datetime: str = None,
            note_url: str = None
        ) -> str:
            """
            Create a new task in Microsoft To Do.

            Args:
                title: Task title/description (required)
                due_date: Due date (optional) - can be 'tomorrow', 'next Monday', '2026-02-15', etc.
                list_id: Target list ID (optional, uses default if not provided)
                reminder_datetime: Reminder time (optional) - 'tomorrow at 5pm', '2026-02-20T14:00:00Z', etc.
                note_url: URL to related OneNote page (optional)

            Returns:
                Enhanced success message with task details, list, due date, reminder, and link
            """
            try:
                # Parse due date if provided
                parsed_date = None
                if due_date:
                    parsed_date = parse_natural_date(due_date)
                    if not parsed_date:
                        return f"❌ Could not parse date: {due_date}"

                # Parse reminder datetime if provided
                parsed_reminder = None
                if reminder_datetime:
                    parsed_reminder = parse_natural_datetime(reminder_datetime)
                    if not parsed_reminder:
                        return f"❌ Could not parse reminder datetime: {reminder_datetime}"

                # Create task
                result = self.graph_client.create_task(
                    title=title,
                    due_date=parsed_date,
                    list_id=list_id,
                    reminder_datetime=parsed_reminder,
                    note_url=note_url
                )

                # Format response using formatter
                return format_task_response(result, "Created")

            except Exception as e:
                return f"❌ Error creating task: {str(e)}"

        # ========== CREATE NOTE TOOL ==========
        @self.server.tool()
        async def create_note(title: str, content: str, section_id: str = None) -> str:
            """
            Create a new note in OneNote.

            Args:
                title: Note title (required)
                content: Note content/body (required)
                section_id: Target section ID (optional, uses default if not provided)

            Returns:
                Enhanced success message with note details, section, web URL, and timestamp
            """
            try:
                # Create note
                result = self.graph_client.create_note(
                    title=title,
                    content=content,
                    section_id=section_id
                )

                # Format response using formatter
                return format_note_response(result, "Created")

            except Exception as e:
                return f"❌ Error creating note: {str(e)}"

        # ========== GET TODO LISTS TOOL ==========
        @self.server.tool()
        async def get_todo_lists() -> str:
            """
            Get all Microsoft To Do lists.

            Returns:
                Formatted list of all To Do lists with IDs and names
            """
            try:
                lists = self.graph_client.get_task_lists()

                if not lists:
                    return "No task lists found."

                lines = [f"Found {len(lists)} list(s):"]
                for lst in lists:
                    lines.append(f"  - {lst['displayName']} | ID: {lst['id']}")

                return "\n".join(lines)

            except Exception as e:
                return f"❌ Error fetching lists: {str(e)}"

        # ========== GET ONENOTE SECTIONS TOOL ==========
        @self.server.tool()
        async def get_onenote_sections() -> str:
            """
            Get all OneNote sections.

            Returns:
                Formatted list of all OneNote sections with IDs and names
            """
            try:
                sections = self.graph_client.get_sections()

                if not sections:
                    return "No OneNote sections found."

                lines = [f"Found {len(sections)} section(s):"]
                for section in sections:
                    lines.append(f"  - {section['displayName']} | ID: {section['id']}")

                return "\n".join(lines)

            except Exception as e:
                return f"❌ Error fetching sections: {str(e)}"

        # ========== UPDATE TASK TOOL ==========
        @self.server.tool()
        async def update_task(
            task_id: str,
            list_id: str,
            title: str = None,
            due_date: str = None,
            reminder_datetime: str = None,
            is_completed: bool = None,
            note_url: str = None
        ) -> str:
            """
            Update an existing task in Microsoft To Do.

            Args:
                task_id: Task ID to update (required)
                list_id: List ID containing the task (required)
                title: New title (optional)
                due_date: New due date (optional)
                reminder_datetime: New reminder time (optional)
                is_completed: Mark as completed (True) or incomplete (False) (optional)
                note_url: Add/update related OneNote URL (optional)

            Returns:
                Enhanced success message with updated task details
            """
            try:
                # Parse due date if provided
                parsed_date = None
                if due_date:
                    parsed_date = parse_natural_date(due_date)
                    if not parsed_date:
                        return f"❌ Could not parse date: {due_date}"

                # Parse reminder datetime if provided
                parsed_reminder = None
                if reminder_datetime:
                    parsed_reminder = parse_natural_datetime(reminder_datetime)
                    if not parsed_reminder:
                        return f"❌ Could not parse reminder datetime: {reminder_datetime}"

                # Update task
                result = self.graph_client.update_task(
                    task_id=task_id,
                    list_id=list_id,
                    title=title,
                    due_date=parsed_date,
                    reminder_datetime=parsed_reminder,
                    is_completed=is_completed,
                    note_url=note_url
                )

                # Format response using formatter
                return format_task_response(result, "Updated")

            except Exception as e:
                return f"❌ Error updating task: {str(e)}"

        # ========== UPDATE NOTE TOOL ==========
        @self.server.tool()
        async def update_note(page_id: str, content: str) -> str:
            """
            Append content to an existing OneNote page.

            Args:
                page_id: Page ID to update (required)
                content: Content to append (required)

            Returns:
                Success message
            """
            try:
                result = self.graph_client.update_note_append(
                    page_id=page_id,
                    content=content
                )

                return f"✓ Appended content to note: {result['title']}"

            except Exception as e:
                return f"❌ Error updating note: {str(e)}"

        # ========== SEARCH TASKS TOOL ==========
        @self.server.tool()
        async def search_tasks(query: str, list_id: str = None) -> str:
            """
            Search for tasks by title (case-insensitive).

            Args:
                query: Search query (required)
                list_id: Limit search to specific list (optional, searches all if not provided)

            Returns:
                Formatted list of matching tasks with IDs, titles, lists, and due dates
            """
            try:
                results = self.graph_client.search_tasks(query, list_id)
                return format_search_results(results, "task")

            except Exception as e:
                return f"❌ Error searching tasks: {str(e)}"

        # ========== SEARCH NOTES TOOL ==========
        @self.server.tool()
        async def search_notes(query: str, section_id: str = None) -> str:
            """
            Search for OneNote pages by title (case-insensitive).

            Args:
                query: Search query (required)
                section_id: Limit search to specific section (optional, searches all if not provided)

            Returns:
                Formatted list of matching notes with IDs, titles, sections, and URLs
            """
            try:
                results = self.graph_client.search_notes(query, section_id)
                return format_search_results(results, "note")

            except Exception as e:
                return f"❌ Error searching notes: {str(e)}"

        # ========== GET TODO LISTS TOOL ==========
        @self.server.tool()
        async def get_todo_lists() -> str:
            """
            Get all Microsoft To Do task lists with their IDs and names.

            Returns:
                Formatted list of all task lists showing display name and ID for each
            """
            try:
                lists = self.graph_client.get_task_lists()
                if not lists:
                    return "No task lists found."
                lines = [f"Found {len(lists)} task list(s):"]
                for lst in lists:
                    lines.append(f"  - {lst['displayName']} | ID: {lst['id']}")
                return "\n".join(lines)
            except Exception as e:
                return f"❌ Error getting task lists: {str(e)}"

        # ========== GET TASKS TOOL ==========
        @self.server.tool()
        async def get_tasks(list_id: str) -> str:
            """
            Get all tasks from a specific Microsoft To Do list.

            Args:
                list_id: List ID to retrieve tasks from (required) - use get_todo_lists to find IDs

            Returns:
                Formatted list of tasks with title, status, due date, reminder, and task ID
            """
            try:
                tasks = self.graph_client.get_tasks(list_id)
                if not tasks:
                    return "No tasks found in this list."
                lines = [f"Found {len(tasks)} task(s):"]
                for task in tasks:
                    status = task.get("status", "notStarted")
                    due_info = ""
                    if task.get("dueDateTime"):
                        due_date = task["dueDateTime"]["dateTime"].split("T")[0]
                        due_info = f" | Due: {due_date}"
                    reminder_info = ""
                    if task.get("isReminderOn") and task.get("reminderDateTime"):
                        reminder = task["reminderDateTime"]["dateTime"]
                        reminder_info = f" | Reminder: {reminder}"
                    lines.append(
                        f"  - {task['title']} | Status: {status}{due_info}{reminder_info} | ID: {task['id']}"
                    )
                return "\n".join(lines)
            except Exception as e:
                return f"❌ Error getting tasks: {str(e)}"

        # ========== DELETE TASK TOOL ==========
        @self.server.tool()
        async def delete_task(task_id: str, list_id: str) -> str:
            """
            Delete a task from Microsoft To Do.

            Args:
                task_id: Task ID to delete (required) - use search_tasks or get_tasks to find IDs
                list_id: List ID containing the task (required) - use get_todo_lists to find IDs

            Returns:
                Success or error message
            """
            try:
                self.graph_client.delete_task(task_id=task_id, list_id=list_id)
                return f"✓ Deleted task {task_id} from list {list_id}"
            except Exception as e:
                return f"❌ Error deleting task: {str(e)}"

        # ========== CREATE LIST TOOL ==========
        @self.server.tool()
        async def create_list(name: str) -> str:
            """
            Create a new Microsoft To Do task list.

            Args:
                name: Display name for the new list (required)

            Returns:
                Success message with the new list name and ID
            """
            try:
                result = self.graph_client.create_list(name)
                return f"✓ Created list: {result['displayName']} | ID: {result['id']}"
            except Exception as e:
                return f"❌ Error creating list: {str(e)}"

        # ========== GET NOTES TOOL ==========
        @self.server.tool()
        async def get_notes(section_id: str) -> str:
            """
            Get all notes (pages) from a specific OneNote section.

            Args:
                section_id: Section ID to retrieve pages from (required) - use get_onenote_sections to find IDs

            Returns:
                Formatted list of notes with title, created date, and page ID
            """
            try:
                pages = self.graph_client.get_notes(section_id)
                if not pages:
                    return "No notes found in this section."
                lines = [f"Found {len(pages)} note(s):"]
                for page in pages:
                    created = page.get("createdDateTime", "")
                    created_date = created.split("T")[0] if created else "unknown"
                    links = page.get("links", {})
                    url = (
                        links.get("oneNoteClientUrl", {}).get("href")
                        or links.get("oneNoteWebUrl", {}).get("href", "N/A")
                    )
                    lines.append(
                        f"  - {page['title']} | Created: {created_date} | ID: {page['id']} | URL: {url}"
                    )
                return "\n".join(lines)
            except Exception as e:
                return f"❌ Error getting notes: {str(e)}"

        # ========== DELETE NOTE TOOL ==========
        @self.server.tool()
        async def delete_note(page_id: str) -> str:
            """
            Delete a OneNote page.

            Args:
                page_id: Page ID to delete (required) - use search_notes or get_notes to find IDs

            Returns:
                Success or error message
            """
            try:
                self.graph_client.delete_note(page_id=page_id)
                return f"✓ Deleted note {page_id}"
            except Exception as e:
                return f"❌ Error deleting note: {str(e)}"

    def run(self):
        """Run the MCP server over stdio."""
        print("🚀 Starting Microsoft To Do + OneNote MCP Server...", file=sys.stderr)

        # Authenticate on startup
        try:
            self.auth_handler.authenticate()
        except Exception as e:
            print(f"❌ Authentication failed: {e}", file=sys.stderr)
            raise

        print("✓ Server ready! Waiting for Claude Desktop connection...\n", file=sys.stderr)

        # Run FastMCP server (handles stdio automatically)
        self.server.run()


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================


def main():
    """Main entry point for MCP server."""
    try:
        server = MCPTodoOneNoteServer()
        server.run()  # FastMCP handles async internally
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user", file=sys.stderr)
    except Exception as e:
        print(f"\n❌ Server error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
