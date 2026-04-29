# SCOPE

Given that the ask is to implement a Regulatory and Licensing System, this solution models the workflow for a Childcare Centre.

Based on the given [requirements](USE_CASES.md) and time available, I've decided to implement the following use cases:

1. Use Case 1 — Operator Application Submission & Resubmission
2. Use Case 2 — Officer Application Review & Feedback

## Deferred Scope
The following features will be targeted as a stretch goal.

- Use Case 3: Checklist projection
- End-to-end integration test covering full operator → officer → resubmission loop

## Mocks & Stubs
1. Auth will be stubbed with JWT and role claim without a database.
2. File uploads will be locally stored.
3. AI assessment will be stubbed with fixed responses based on file names.

## Assumptions & Choices
1. This is a simplified version of an actual real-world system. As such, the amount of information required and collected will be less.
2. There is no draft state for the application while being created.

## Intended Tech Stack
1. React with TypeScript for the frontend.
    - Given the time constraints, I'm choosing to use this given my familiarity with this framework.
2. FastAPI for the backend.
   - Easy to use, fast generation of RESTful APIs and swagger documentation.
3. PostgreSQL for the database.
   - Simple and easy to use. Support for JSONB which might be useful for auditing.
4. Docker and Docker Compose for deployment.
   - Helps with local development and CI. Also helpful for evaluation.
5. GitHub Actions for CI.
   - Helps with integration testing and deployment.
6. AI Use
   - Claude Code for development and code reviews.

## System Form Details

### Basic Details

- Centre Name
- Operator / Company Name
- UEN (or Registration Number)
- Contact Person Name
- Contact Email & Phone

### Operations

- Centre Address
- Type of Service (Student Care / Childcare)
- Proposed Capacity (number of children)

### Document Uploads (3–4 files max)

- Staff Qualification Certificate(s)
- Fire Safety Certificate
- Floor Plan of Premises
- (Optional) Insurance Certificate

### Declarations

Compliance Declaration (checkbox: “I confirm all information is accurate”)