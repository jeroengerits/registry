import type { CommandResult } from '../../types.js';

export function help(): CommandResult {
  return {
    output: `UI Registry\n\nInstall and manage components from GitHub repositories.\n\nCommands:\n  ui help\n    Show this help.\n\n  ui components list [--json]\n    List components installed in the current directory.\n\n  ui components info <name> [--json]\n    Show details for an installed component.\n\n  ui components add <github-url> --yes\n    Validate root components.json and install the component locally.\n    Use --dry-run to preview changes and --json for machine-readable output.\n\nRequirements:\n  - components.json must be in the repository root.\n  - The repository must contain a stable semver Git tag.\n  - Component files must use safe relative source and target paths.\n\nExamples:\n  ui components add https://github.com/example/button.git --yes\n  ui components add https://github.com/example/button.git --dry-run --json\n  ui components list\n`,
    exitCode: 0,
  };
}
