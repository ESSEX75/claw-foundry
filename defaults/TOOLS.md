# TOOLS.md - Claw Foundry Tools

All Claw Foundry tools are registered as OpenClaw plugin tools. Use the tool schemas for parameter details.

## Config management

Claw Foundry config files (workflow.yaml, prompts) are **write-once**: created on first setup, never overwritten on restart. Your customizations are always preserved.

## Project-specific overrides

To override tool behavior for a specific project, create prompt files in:
`claw-foundry/projects/<name>/prompts/<role>.md`
