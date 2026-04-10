## ADDED Requirements

### Requirement: Keyword-Based Full-Text Search
The system SHALL provide full-text keyword search using FlexSearch.

#### Scenario: Search by Keyword
- **WHEN** the user enters a search query
- **THEN** the system SHALL search across session titles, query questions, and answers
- **AND** return results matching the keywords

#### Scenario: Real-Time Search
- **WHEN** the user types in the search input
- **THEN** the search results SHALL update in real-time as the user types
- **AND** there SHALL be no explicit "Search" button required

### Requirement: History Recall Ranking Algorithm
The system SHALL implement a weighted ranking algorithm for history recall.

#### Scenario: Recall Ranking
- **WHEN** history recall is triggered
- **THEN** results SHALL be ranked using:
  - Keyword match score (weight: 0.4)
  - Time decay score (weight: 0.3)
  - Usage frequency score (weight: 0.3)

> **Note:** Semantic search (Transformers.js) is deferred to v2.1 as an optional enhancement.

### Requirement: Context-Aware Recommendation
The system SHALL proactively recommend related historical records based on context.

#### Scenario: Similar Question Detection
- **WHEN** the user asks a new question with >0.8 similarity to a historical question
- **THEN** the system SHALL display: "你之前问过类似问题"

#### Scenario: Error Solution Recommendation
- **WHEN** a tool call fails with a specific error
- **THEN** the system SHALL search for similar errors in history
- **AND** display any found solutions

### Requirement: Time Range Filter
The system SHALL support filtering search results by time range.

#### Scenario: Filter by Date Range
- **WHEN** the user specifies a date range filter
- **THEN** only results within that range SHALL be displayed

### Requirement: Tag-Based Filtering
The system SHALL support filtering search results by tags.

#### Scenario: Filter by Tag
- **WHEN** the user selects one or more tags
- **THEN** only results with matching tags SHALL be displayed
