# Contributing to CAW

First off, thanks for taking the time to contribute!

## Getting Started
1. Fork the repository
2. Follow the instructions in `DEVELOPMENT.md` to set up your environment
3. Create a new branch for your feature or bug fix

## Code Style
- Use standard JavaScript style.
- Use ES Modules (`import`/`export`).
- Ensure all PostgreSQL queries use parameterized inputs (e.g., `$1`, `$2`) to prevent SQL injection. No string concatenation in SQL queries.

## Pull Request Process
1. Update the documentation in `docs/` if you add new features (like new blocks or schema changes).
2. Ensure the application starts successfully and `GET /health` returns `{ ok: true }`.
3. Provide a clear description of the changes in your PR, referencing any related issues.

## Reporting Bugs
Use the GitHub Issues tracker and select the Bug Report template.

## Feature Requests
Use the GitHub Issues tracker and select the Feature Request template.
