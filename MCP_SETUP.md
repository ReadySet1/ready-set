# MCP Server Configuration for Claude Code

This project uses [Model Context Protocol (MCP)](https://docs.claude.com/en/docs/claude-code/mcp) servers to enhance Claude Code with additional capabilities.

## Prerequisites

- [Claude Code](https://docs.claude.com/en/docs/claude-code) installed
- pnpm (this project uses pnpm, not npm)
- Node.js 18+

## Available MCP Servers

1. **Supabase** - Database operations and queries
2. **GitHub** - Repository management and operations
3. **Linear** - Project management (requires OAuth)
4. **Context7** - Documentation search
5. **Desktop Commander** - Enhanced file system operations
6. **Filesystem** - Basic file operations

## Setup Instructions

### 1. Environment Variables

Add these to your `.env.local` file (already configured):

```bash
# MCP Server Configuration
SUPABASE_ACCESS_TOKEN="your_supabase_access_token"
GITHUB_PERSONAL_ACCESS_TOKEN="your_github_personal_access_token"
```

### 2. Configure MCP Servers

The `.mcp.json` file is already configured with the correct settings. If you need to modify it:

```bash
cp .mcp.json.example .mcp.json
# Edit paths and settings as needed
```

### 3. Start Claude Code

Navigate to the project directory and start Claude Code:

```bash
cd /Users/fersanz/Documents/ready-set
claude
```

### 4. Verify MCP Servers

Once Claude Code starts, check the MCP server status:

```bash
/mcp list
```

All servers should show as ✅ connected.

## Important Notes

### Why pnpm instead of npx?

This project uses pnpm as its package manager. Using `npx` with pnpm projects causes configuration conflicts. That's why all MCP servers are configured to use `pnpm dlx` instead.

### OAuth for Linear

The Linear MCP server requires OAuth authentication. When you first start Claude Code:

1. You'll see an OAuth prompt in your terminal
2. Follow the link to authenticate in your browser
3. The token will be cached for future sessions

### File Paths

The filesystem MCP server is configured for your user directories. Update the paths in `.mcp.json` to match your system:

```json
"filesystem": {
  "command": "pnpm",
  "args": [
    "dlx",
    "@modelcontextprotocol/server-filesystem",
    "/Users/YOUR_USERNAME/Desktop",
    "/Users/YOUR_USERNAME/Downloads"
  ]
}
```

## Troubleshooting

### Servers showing as "failed"

1. Check logs in: `/Users/fersanz/Library/Caches/claude-cli-nodejs/-Users-fersanz-Documents-ready-set/mcp-logs-*`
2. Ensure environment variables are set in `.env.local`
3. Verify pnpm is installed: `pnpm --version`

### npm configuration errors

If you see errors about `.npmrc` configuration:
- This is why we use `pnpm dlx` instead of `npx`
- Don't modify the MCP configs to use npm

### Permission issues

For filesystem operations, you may need to grant additional permissions through macOS System Preferences.

## MCP Commands in Claude Code

```bash
/mcp list              # List all MCP servers and status
/mcp view <server>     # View tools from a specific server
/mcp enable <server>   # Enable a server
/mcp disable <server>  # Disable a server
```

## Security Notes

- Never commit `.env.local` or `.mcp.json` with real tokens
- Use environment variables for sensitive data
- The `.mcp.json.example` file is safe to commit as a template

## Resources

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [MCP Protocol](https://docs.claude.com/en/docs/claude-code/mcp)
- [MCP Server List](https://github.com/modelcontextprotocol/servers)
