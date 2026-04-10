## ADDED Requirements

### Requirement: Maximum Node Count Limit
The system SHALL limit the maximum number of nodes per session to prevent memory issues.

#### Scenario: Node Count Limit
- **WHEN** the number of nodes in a session exceeds 500
- **THEN** the system SHALL warn the user
- **AND** new nodes SHALL still be added (user can continue working)

### Requirement: Memory Usage Monitoring
The system SHALL monitor memory usage and display a warning when it exceeds safe levels.

#### Scenario: Memory Warning
- **WHEN** the estimated memory usage exceeds 150MB
- **THEN** a warning indicator SHALL be displayed
- **AND** the user SHALL be prompted to consider archiving old sessions

### Requirement: Automatic Cleanup of Expired Data
The system SHALL automatically clean up expired session data based on the archival policy.

#### Scenario: Session Expiry Cleanup
- **WHEN** a session has been archived for more than 90 days
- **THEN** the session data SHALL be automatically deleted
- **AND** the user SHALL be notified of the cleanup

### Requirement: Large File Compression
The system SHALL compress large files and images before storing them.

#### Scenario: Image Thumbnail Generation
- **WHEN** an image larger than 100KB is stored
- **THEN** a compressed thumbnail SHALL be generated
- **AND** the original SHALL be stored separately or linked

### Requirement: Memory Cleanup on Session Switch
The system SHALL clean up DAG data when switching between sessions.

#### Scenario: Session Switch Cleanup
- **WHEN** the user switches from Session A to Session B
- **THEN** all DAG data from Session A SHALL be released from memory
- **AND** the ReactFlow instance SHALL be reset
