# Relaxed CLI Output

## Goal

Make human-readable command output simpler, calmer, and easier to scan without changing JSON or error contracts.

## Design

Replace the decorative framed header with a quiet `UI Registry  /  command` title. Add whitespace between title, summary, content, outcome, and next action. Keep tables dense within their content block and retain one useful footer only.

Command-specific copy should avoid repeated words and redundant implementation details. JSON output and error output remain unchanged for scripts and automation.
