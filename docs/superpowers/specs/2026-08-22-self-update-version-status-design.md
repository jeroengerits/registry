# Self-Update Version Status

## Goal

Make `ui self-update` clearly show the installed version, the discovered latest version, and whether replacement is necessary.

## Design

The installer remains responsible for discovering versions and deciding whether to replace the cache. It emits concise stage messages. The CLI captures that output and renders a compact `self-update` frame with a two-row version comparison followed by the update status and installer stages.

Interactive terminals retain the existing delayed Ora spinner during the installer operation. Non-interactive output remains plain text and contains no styling or prompt control sequences.

Already-current installations show both equal versions and an explicit `Already up to date` result. Updated installations show the version transition and the existing success result.

## Error Handling

Installer failures continue through the existing normalized error path. Missing launcher metadata or installer files remain early command errors.

## Verification

Add tests for current and updated installer output formatting without requiring network access. Run typecheck, lint, build, and the complete Vitest suite.
