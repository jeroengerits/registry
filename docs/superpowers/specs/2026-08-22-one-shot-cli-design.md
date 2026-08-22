# One-Shot CLI Commands

## Goal

Make every CLI invocation perform one explicit operation without interactive command wizards or follow-up action loops.

## Command Model

`ui` prints the available namespaces. `ui components` lists installed components, and `ui hooks` reports hook status. Component operations remain explicit under `ui component`: `list`, `add`, `update`, `remove`, `info`, and `toggle`.

Interactive selectors are removed from namespace and component command selection. Commands requiring a component name return usage guidance when the name is omitted. JSON output remains stable and non-interactive.
