# deployment Specification

## Purpose

Defines how the platform is started, configured and health-checked as a set of containers, so that any environment can bring up a working stack with one command and verify it is ready.

## Requirements

### Requirement: Single-command startup
The platform SHALL start the database, the API and the web application from a clean checkout with a single `docker compose up` command, with no manual steps in between.

#### Scenario: Fresh clone
- **WHEN** a user runs `docker compose up` in a fresh clone with Docker installed and nothing else configured
- **THEN** the database, API and web application containers start and the web application is reachable on http://localhost:3000

#### Scenario: Restart with existing data
- **WHEN** the stack is stopped and started again with `docker compose up`
- **THEN** data written before the stop is still present, because the database uses a named volume

### Requirement: Migrations applied before serving
The API SHALL apply all pending database migrations before it starts accepting HTTP requests, and SHALL exit with a non-zero status if a migration fails.

#### Scenario: Pending migrations on startup
- **WHEN** the API container starts against a database that is missing one or more migrations
- **THEN** the missing migrations are applied and only then does the API begin listening

#### Scenario: Failed migration
- **WHEN** a migration fails to apply
- **THEN** the API process exits with a non-zero status and does not listen for requests

### Requirement: API health endpoint
The API SHALL expose `GET /health` that reports whether the service and its database connection are ready.

#### Scenario: Healthy service
- **WHEN** the API is running and can query the database
- **THEN** `GET /health` responds `200` with a JSON body containing `{"status":"ok"}`

#### Scenario: Database unreachable
- **WHEN** the API is running but cannot query the database
- **THEN** `GET /health` responds `503` with a JSON body whose `status` is `"error"`

### Requirement: Configuration through environment variables
All environment-specific settings (database URL, ports, the API URL used by the web application) SHALL be read from environment variables, with a committed `.env.example` documenting every variable and a working default for local use.

#### Scenario: Missing required variable
- **WHEN** the API starts without `DATABASE_URL` set
- **THEN** it exits with a non-zero status and a message naming the missing variable

#### Scenario: Web application locates the API
- **WHEN** the web application is built with `NEXT_PUBLIC_API_URL` set
- **THEN** every request from the browser targets that URL

### Requirement: Quality gate on every push
The repository SHALL run linting, type-checking, formatting checks and unit tests for every workspace on each push and pull request, and the same checks SHALL be runnable locally with one command.

#### Scenario: Lint failure blocks CI
- **WHEN** a commit introduces a lint error in any workspace
- **THEN** the CI workflow fails on that commit

#### Scenario: Source comments are rejected
- **WHEN** a commit adds a line or block comment to a TypeScript source file outside of configuration files
- **THEN** the lint step fails and names the offending file and line
