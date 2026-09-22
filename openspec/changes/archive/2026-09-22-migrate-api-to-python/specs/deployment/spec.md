# Spec Delta

## MODIFIED Requirements

### Requirement: Quality gate on every push
The repository SHALL run linting, type-checking, formatting checks and tests for every workspace, whatever its language, on each push and pull request, and the same checks SHALL be runnable locally with one command. The layer boundaries of the API SHALL be part of those checks.

#### Scenario: Lint failure blocks CI
- **WHEN** a commit introduces a lint error in any workspace
- **THEN** the CI workflow fails on that commit

#### Scenario: Source comments are rejected
- **WHEN** a commit adds a comment to a TypeScript or Python source file outside of configuration files, or a docstring to a Python source file
- **THEN** the lint step fails and names the offending file and line

#### Scenario: Layer boundary violation blocks CI
- **WHEN** a commit makes a module of the API's domain or application layer import from its infrastructure layer or from a web or database framework
- **THEN** the lint step fails and names the offending import

#### Scenario: One command runs every check
- **WHEN** a developer runs the repository's check command with the database container up
- **THEN** lint, type-check, tests and formatting checks run for the web app, the shared package and the API, and the command fails if any of them fails
