# CLI Command Dashboard

## Goal

Make the CLI easier to scan and operate by reducing the visible component command surface and using one dashboard-oriented TUI.

## Command Model

The primary component commands are `list`, `add`, `update`, and `remove`. `info` becomes a detail view selected from the dashboard, and `toggle` becomes an enable/disable action in that view. Existing handlers remain available to avoid breaking scripts, but the hidden actions are not offered in the primary picker or help output.

Running `ui` or `ui component` in a TTY opens the component dashboard. Non-interactive invocations retain deterministic text or JSON output.

## TUI

The dashboard begins with an installed-component summary and a compact table containing name, version, and state. Selecting a component opens a detail view with contextual actions: enable/disable, update, remove, and back. Add is a top-level dashboard action. Cancel returns to the dashboard instead of producing duplicate frames.

## Output

Every human-readable command uses one frame with a title, summary, primary content, outcome, and one contextual next step. Self-update suppresses installer welcome/path chatter and renders current version, latest version, update decision, and concise stages in the same frame.

## Compatibility and Verification

JSON output and existing explicit command handlers remain stable. Tests cover dashboard help, reduced picker options, detail actions, clean self-update output, and existing component operations. Run typecheck, lint, build, shell syntax validation, and the full Vitest suite.
