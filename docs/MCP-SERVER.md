# Routiform MCP Server Documentation

> Model Context Protocol server with 16 intelligent tools

## Installation

Routiform MCP is built-in. Start it with:

```bash
routiform --mcp
```

Or via the open-sse transport:

```bash
# HTTP streamable transport (port 20130)
routiform --dev  # MCP auto-starts on /mcp endpoint
```

## IDE Configuration

See [IDE Configs](integrations/ide-configs.md) for Antigravity, Cursor, Copilot, and Claude Desktop setup.

---

## Essential Tools (8)

| Tool                            | Description                              |
| :------------------------------ | :--------------------------------------- |
| `routiform_get_health`          | Gateway health, circuit breakers, uptime |
| `routiform_list_combos`         | All configured combos with models        |
| `routiform_get_combo_metrics`   | Performance metrics for a specific combo |
| `routiform_switch_combo`        | Switch active combo by ID/name           |
| `routiform_check_quota`         | Quota status per provider or all         |
| `routiform_route_request`       | Send a chat completion through Routiform |
| `routiform_cost_report`         | Cost analytics for a time period         |
| `routiform_list_models_catalog` | Full model catalog with capabilities     |

## Advanced Tools (8)

| Tool                               | Description                                                 |
| :--------------------------------- | :---------------------------------------------------------- |
| `routiform_simulate_route`         | Dry-run routing simulation with fallback tree               |
| `routiform_set_budget_guard`       | Session budget with degrade/block/alert actions             |
| `routiform_set_resilience_profile` | Apply conservative/balanced/aggressive preset               |
| `routiform_test_combo`             | Live-test all models in a combo via a real upstream request |
| `routiform_get_provider_metrics`   | Detailed metrics for one provider                           |
| `routiform_best_combo_for_task`    | Task-fitness recommendation with alternatives               |
| `routiform_explain_route`          | Explain a past routing decision                             |
| `routiform_get_session_snapshot`   | Full session state: costs, tokens, errors                   |

## Authentication

MCP tools are authenticated via API key scopes. Each tool requires specific scopes:

| Scope          | Tools                                            |
| :------------- | :----------------------------------------------- |
| `read:health`  | get_health, get_provider_metrics                 |
| `read:combos`  | list_combos, get_combo_metrics                   |
| `write:combos` | switch_combo                                     |
| `read:quota`   | check_quota                                      |
| `write:route`  | route_request, simulate_route, test_combo        |
| `read:usage`   | cost_report, get_session_snapshot, explain_route |
| `write:config` | set_budget_guard, set_resilience_profile         |
| `read:models`  | list_models_catalog, best_combo_for_task         |

## Audit Logging

Every tool call is logged to `mcp_tool_audit` with:

- Tool name, arguments, result
- Duration (ms), success/failure
- API key hash, timestamp

## Files

| File                                         | Purpose                                     |
| :------------------------------------------- | :------------------------------------------ |
| `open-sse/mcp-server/server.ts`              | MCP server creation + 16 tool registrations |
| `open-sse/mcp-server/transport.ts`           | Stdio + HTTP transport                      |
| `open-sse/mcp-server/auth.ts`                | API key + scope validation                  |
| `open-sse/mcp-server/audit.ts`               | Tool call audit logging                     |
| `open-sse/mcp-server/tools/advancedTools.ts` | 8 advanced tool handlers                    |
