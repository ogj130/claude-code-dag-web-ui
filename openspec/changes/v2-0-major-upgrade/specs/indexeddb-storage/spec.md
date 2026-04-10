## ADDED Requirements

### Requirement: IndexedDB Database Schema
The system SHALL use Dexie.js to manage an IndexedDB database with the following schema:

#### Scenario: Database Version
- **WHEN** the application initializes
- **THEN** the database version SHALL be set to 1
- **AND** the database name SHALL be `cc_dag_web_ui`

#### Scenario: Sessions Table
- **WHEN** the database is created
- **THEN** a `sessions` table SHALL exist with the following indexes:
  - `id` (primary key)
  - `updatedAt` (indexed, for sorting)
  - `status` (indexed, for filtering)

#### Scenario: Queries Table
- **WHEN** the database is created
- **THEN** a `queries` table SHALL exist with the following indexes:
  - `id` (primary key)
  - `sessionId` (indexed, for foreign key lookup)
  - `createdAt` (indexed, for sorting)

### Requirement: Session CRUD Operations
The system SHALL provide Create, Read, Update, Delete operations for session records.

#### Scenario: Create Session
- **WHEN** a new session is created
- **THEN** the session record SHALL be immediately written to IndexedDB
- **AND** the session ID SHALL be returned

#### Scenario: Read Session
- **WHEN** the application requests a session by ID
- **THEN** the session record SHALL be retrieved from IndexedDB
- **AND** the result SHALL be returned as a SessionRecord object

#### Scenario: Update Session
- **WHEN** a session is updated
- **THEN** the session record in IndexedDB SHALL be updated with the new values
- **AND** the `updatedAt` timestamp SHALL be automatically set

#### Scenario: Delete Session
- **WHEN** a session is deleted
- **THEN** the session record SHALL be removed from IndexedDB
- **AND** all associated query records SHALL also be removed

### Requirement: Session List Pagination
The system SHALL support paginated retrieval of session lists.

#### Scenario: Retrieve Session List
- **WHEN** the user requests the session list
- **THEN** the system SHALL return the 20 most recently updated sessions by default
- **AND** sessions SHALL be sorted by `updatedAt` in descending order

#### Scenario: Session List Maximum
- **WHEN** the stored session count exceeds 100
- **THEN** the oldest sessions SHALL be automatically archived or deleted (FIFO)

### Requirement: Storage Space Management
The system SHALL monitor and manage IndexedDB storage space.

#### Scenario: Storage Quota Check
- **WHEN** the application starts
- **THEN** the available storage quota SHALL be checked
- **AND** a warning SHALL be displayed if storage is nearly full

#### Scenario: Storage Space Insufficient
- **WHEN** IndexedDB write fails due to quota exceeded
- **THEN** the system SHALL display a warning to the user
- **AND** old sessions SHALL be automatically cleaned up
