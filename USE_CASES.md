The platform you are building is a Regulatory and Licensing System used by government
licensing officers and operators (businesses seeking licences) to manage the end-to-end
application lifecycle.

## Use Cases
The following three use cases define the full product scope. 

### 1. Use Case 1 — Operator Application Submission & Resubmission
#### Background
Applications are often submitted with incomplete or incorrect information, causing repeated
back-and-forth cycles. This use case covers the guided submission and resubmission
workflow from the operator's perspective.
#### User Story
As an Operator, I want to submit my application with clear guidance and receive specific
feedback when information is incomplete, so that I can quickly address issues and resubmit
without confusion or repeated rejections.
#### Acceptance Criteria
##### Initial Submission
- Complete form data entry
- Document uploads with drag-and-drop functionality
- Real-time AI verification status visible per uploaded document
- Progress indicator showing overall completion status

##### Resubmission Workflow
- Operator sees case status as "Pending Pre-Site Resubmission"
- Officer comments displayed prominently at top of application
- Feedback is linked to the specific form section or document it relates to
- Operator updates only the flagged sections — no need to re-enter entire application
##### Multi-Round Support
- Multiple rounds of feedback and resubmission are supported seamlessly
- Revision history and previous Officer comments are visible
- Application data is never lost between submission rounds

### 2. Use Case 2 — Officer Application Review & Feedback
#### Background
Officers need an efficient way to review applications and provide actionable feedback
without getting caught in repeated revision cycles.
#### User Story
As a Licensing Officer, I want to efficiently review applications and provide clear, actionable
feedback to operators, so that I can guide them toward complete submissions without
repetitive review cycles.
#### Acceptance Criteria
##### Application Review
- Officer accesses full submission: all form data and documents in an organised structure
- AI verification results and flagged document issues are visible
##### Feedback Workflow
- Officer can request more information with specific, contextual comments
- Predefined comment templates available for common issues
- Setting application status triggers automatic operator notification
##### Resubmission Management
- Officer receives notification when case moves to "Pre-Site Resubmitted"
- Updated sections are highlighted; only changes are surfaced
- Officer can compare current submission against previous versions
- Resolution of previously flagged issues is tracked
##### Quality Assurance
- No applications are lost due to status transitions or filtering errors
- Complete audit trail of all feedback and resubmission rounds is maintained
- Workflow supports unlimited resubmission cycles

#### Status Mapping
All status transitions must follow the mapping below. Officer and Operator views show
different labels for the same internal state.

| Internal System Status | Officer View | Operator View |
| :--- | :--- | :--- |
| Application Received | Application Received | Submitted |
| Under Review | Under Review | Under Review |
| Pending Pre-Site Resubmission | Pending Pre-Site Resubmission | Pending Pre-Site Resubmission |
| Pre-Site Resubmitted | Pre-Site Resubmitted | Pre-Site Resubmitted |
| Site Visit Scheduled | Site Visit Scheduled | Pending Site Visit |
| Site Visit Done | Site Visit Done | Pending Post-Site Clarification |
| Awaiting Post-Site Clarification | Awaiting Post-Site Clarification | Pending Post-Site Clarification |
| Pending Post-Site Resubmission | Awaiting Post-Site Resubmission | Pending Post-Site Resubmission |
| Post-Site Clarification Resubmitted | Post-Site Clarification Resubmitted | Post-Site Resubmitted |
| Pending Approval | Route to Approval | Pending Approval |
| Approved | Approved | Approved |
| Rejected | Rejected | Rejected |

### 3. Use Case 3 — On-Site Assessment & Post-Site Clarification
#### Background
Site inspections need structured documentation, but inconsistent capture leads to unclear
follow-ups. This use case covers the structured inspection workflow and targeted post-site
clarification.
#### User Story
As an Officer, I want to capture site visit findings and request clarification only on specific
items, so that Operators can respond efficiently without being overwhelmed by the full
inspection checklist.
#### Acceptance Criteria
##### Officer — On-Site Data Capture
- Officer accesses the full checklist after site visit is scheduled
- Officer inputs comments per checklist item
- Officer can save as draft (e.g. while working on an iPad on-site)
- Officer can mark individual items as "Need Further Clarification"
##### Status Transition
- On checklist submission, case automatically moves to "Pending Post-Site Clarification"
##### Operator — Targeted Response
- Operator does NOT see the full checklist
- Operator sees ONLY the items flagged for clarification
- Operator sees the Officer’s comment per flagged item
- Operator can respond to each item and upload supporting documents
##### Multi-Round Clarification
- Multiple clarification rounds are supported per checklist item
- Each item maintains a full audit trail: comments, responses, timestamps
#### Constraints
- Operators cannot see the internal approval stage at any point
- Operators see only the final outcome: Approved or Rejected