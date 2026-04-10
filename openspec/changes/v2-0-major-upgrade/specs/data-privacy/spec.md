## ADDED Requirements

### Requirement: Local-First Data Storage
The system SHALL store all data locally by default without sending to any external server.

#### Scenario: Data Privacy Default
- **WHEN** the application stores data
- **THEN** the data SHALL be stored in the browser's IndexedDB
- **AND** no data SHALL be transmitted to external servers

### Requirement: Sensitive Field Encryption
The system SHALL encrypt sensitive fields (tokens, API keys) using AES-256 before storage.

#### Scenario: Sensitive Data Encryption
- **WHEN** sensitive fields are stored
- **THEN** they SHALL be encrypted using AES-256 before being written to IndexedDB

#### Scenario: Sensitive Data Decryption
- **WHEN** encrypted sensitive data is retrieved
- **THEN** it SHALL be decrypted before being returned

### Requirement: One-Click Data Clear
The system SHALL provide a one-click option to clear all stored data.

#### Scenario: Clear All Data
- **WHEN** the user clicks "清除所有历史" button
- **THEN** all sessions, queries, and cached data SHALL be permanently deleted
- **AND** the user SHALL be asked to confirm before deletion

### Requirement: Data Export
The system SHALL support exporting history records in JSON and Markdown formats.

#### Scenario: Export as JSON
- **WHEN** the user selects "Export as JSON"
- **THEN** a JSON file SHALL be downloaded containing all history records

#### Scenario: Export as Markdown
- **WHEN** the user selects "Export as Markdown"
- **THEN** a Markdown file SHALL be downloaded with history formatted as readable text

### Requirement: Privacy Mode Toggle
The system SHALL provide a privacy mode toggle to disable history recording.

#### Scenario: Privacy Mode Enabled
- **WHEN** the user enables privacy mode
- **THEN** no new history records SHALL be created
- **AND** existing records SHALL remain unchanged

#### Scenario: Privacy Mode Disabled
- **WHEN** the user disables privacy mode
- **THEN** history recording SHALL resume normally
