# CLAUDE.md

This file provides guidance for AI assistants (Claude and others) working in this repository.

## Repository Overview

**Spruce_canvas** is an early-stage project currently in the initialization phase. At the time of this writing, the repository contains only a README and this documentation file. The project is described as "Exploring capabilities."

## Current State

- **Stage:** Newly initialized
- **Source code:** None yet
- **Dependencies:** None yet
- **Tests:** None yet
- **Build system:** None yet

As development begins and technology choices are made, update this file to reflect the actual stack, conventions, and workflows.

## Git Workflow

### Branches

- `main` / `master` — stable, production-ready code
- `claude/<description>-<session-id>` — branches used by AI assistants for feature work
- Feature branches should be short-lived and merged via pull request

### Commit Messages

Use clear, imperative-mood commit messages:

```
Add user authentication module
Fix race condition in request handler
Update README with setup instructions
```

- Keep the subject line under 72 characters
- Use the body to explain *why*, not *what*, for non-obvious changes
- Reference issue numbers where applicable: `Fixes #42`

### Push Workflow

```bash
git push -u origin <branch-name>
```

AI assistants working on `claude/` branches should push to those branches only. Never push directly to `main` or `master` without explicit permission.

## Development Conventions (to be adopted when code is added)

These are the default conventions to follow when development begins. Update this section once the technology stack is decided.

### File Organization

Prefer a `src/` directory for application source code:

```
src/
  components/   # UI components (if frontend)
  services/     # Business logic / service layer
  utils/        # Pure utility functions
  types/        # Type definitions (TypeScript)
tests/          # Test files mirroring src/ structure
docs/           # Additional documentation
```

### Code Style

- Favor readability over cleverness
- Keep functions small and single-purpose
- Avoid over-engineering — solve the problem at hand, not hypothetical future ones
- Do not add error handling for scenarios that cannot happen
- Do not add comments unless the logic is non-obvious

### Testing

- Write tests for all non-trivial logic
- Tests should live alongside or mirror source structure
- Prefer unit tests for pure functions; integration tests for I/O boundaries
- All tests must pass before merging

### Environment Variables

- Never commit secrets or credentials
- Document all required environment variables in a `.env.example` file
- Load configuration from environment at startup, not from hardcoded values

## Working With This Repository as an AI Assistant

### Before Making Changes

1. Read relevant existing files before modifying them
2. Check for existing patterns and conventions before introducing new ones
3. Understand the purpose of a file or module before editing it

### Making Changes

- Make the minimum change necessary to fulfill the request
- Do not refactor, reformat, or "improve" code outside the scope of the task
- Do not add docstrings, comments, or type annotations to code you didn't change
- Do not introduce new dependencies without explicit instruction

### After Making Changes

- Commit with a descriptive message
- Push to the correct feature branch (`claude/<description>-<session-id>`)
- Do not push to `main` or `master` without explicit user approval

### Asking for Clarification

When requirements are ambiguous:
- Ask before implementing, not after
- Prefer a focused question over multiple broad questions
- If the answer is inferable from context, make a decision and state your assumption

## Updating This File

Update `CLAUDE.md` whenever:
- A technology stack is chosen
- New tools or scripts are added to the project
- Key conventions or workflows change
- New developers (human or AI) would benefit from additional context

Keep it accurate and concise. Remove outdated sections rather than leaving them as stale documentation.
