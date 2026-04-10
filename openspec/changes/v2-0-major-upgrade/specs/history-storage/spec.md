## ADDED Requirements

### Requirement: Session Storage Model
The system SHALL store sessions with the following data model:

#### Scenario: Session Record Fields
- **WHEN** a session is stored
- **THEN** it SHALL contain: `id`, `title`, `createdAt`, `updatedAt`, `queryCount`, `tokenUsage`, `tags`, `summary`, `status`

### Requirement: Query Storage Model
The system SHALL store queries with the following data model:

#### Scenario: Query Record Fields
- **WHEN** a query is stored
- **THEN** it SHALL contain: `id`, `sessionId`, `question`, `answer`, `toolCalls`, `dag`, `tokenUsage`, `duration`, `createdAt`, `status`, `errorMessage` (optional)

### Requirement: ToolCall Chain Storage
The system SHALL store tool call chains as part of each query record.

#### Scenario: ToolCall Record Fields
- **WHEN** a tool call is stored
- **THEN** it SHALL contain: `id`, `queryId`, `toolName`, `arguments`, `result`, `startTime`, `endTime`, `status`

### Requirement: Compression for Large Content
The system SHALL compress text content using LZ-String before storing.

#### Scenario: Large Content Compression
- **WHEN** text content exceeds 1KB
- **THEN** the content SHALL be compressed using LZ-String before storage

#### Scenario: Content Decompression
- **WHEN** compressed content is retrieved from storage
- **THEN** the content SHALL be decompressed before being returned

### Requirement: Session Sharding
The system SHALL automatically shard session data when it exceeds 10MB.

#### Scenario: Session Size Exceeds Limit
- **WHEN** a single session's total size exceeds 10MB
- **THEN** the session data SHALL be split into multiple shards
- **AND** each shard SHALL be stored separately with a shard index

### Requirement: Session Sharding
The system SHALL automatically shard session data when it exceeds 10MB.

#### Scenario: Session Size Exceeds Limit
- **WHEN** a single session's total size exceeds 10MB
- **THEN** the session data SHALL be split into multiple shards
- **AND** each shard SHALL be stored separately with a shard index

> **Note:** Automatic archival is deferred. Sessions are retained until manually deleted or storage is full (then FIFO eviction).
