## ADDED Requirements

### Requirement: Immediate Write for New Sessions
The system SHALL immediately write new sessions to IndexedDB upon creation.

#### Scenario: New Session Creation
- **WHEN** a new session is created
- **THEN** the session SHALL be written to IndexedDB immediately (not batched)

### Requirement: Debounced Write for Updates
The system SHALL debounce session updates with a 500ms delay before writing to IndexedDB.

#### Scenario: Session Update Debounce
- **WHEN** a session is updated multiple times within 500ms
- **THEN** only the final state SHALL be written to IndexedDB
- **AND** intermediate states SHALL be ignored

### Requirement: Page Refresh Cache-First Strategy
The system SHALL prioritize reading from cache when the page refreshes.

#### Scenario: Page Refresh
- **WHEN** the page is refreshed
- **THEN** the system SHALL first read session data from IndexedDB cache
- **AND** then asynchronously sync with the server

#### Scenario: Cache Miss After Refresh
- **WHEN** the cache does not contain the requested session after refresh
- **THEN** the system SHALL fetch from the server
- **AND** populate the cache with the server data

### Requirement: Server Data Priority
The system SHALL prioritize server data when syncing.

#### Scenario: Server Data Priority
- **WHEN** both cache and server have data for a session
- **THEN** the server data SHALL take priority
- **AND** the cache SHALL be updated with the server data

### Requirement: FIFO Cache Eviction
The system SHALL implement FIFO (First In, First Out) eviction when storage is nearly full.

#### Scenario: Storage Near Full
- **WHEN** the storage usage exceeds 80% of the quota
- **THEN** the system SHALL start evicting the oldest archived sessions

#### Scenario: Automatic Eviction
- **WHEN** a new session needs to be written but storage is full
- **THEN** the oldest archived session SHALL be deleted to make space
