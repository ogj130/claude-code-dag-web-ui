## ADDED Requirements

### Requirement: Global Search Scope
The system SHALL support searching across multiple data types.

#### Scenario: Search Session Titles
- **WHEN** the user searches for text
- **THEN** session titles SHALL be searched

#### Scenario: Search Tool Names
- **WHEN** the user searches for text
- **THEN** tool call names SHALL be searched

#### Scenario: Search QA Content
- **WHEN** the user searches for text
- **THEN** questions and answers SHALL be searched

### Requirement: Real-Time Search Results
The system SHALL display search results as the user types.

#### Scenario: Real-Time Results Update
- **WHEN** the user types in the search input
- **THEN** results SHALL update in real-time with each keystroke
- **AND** debounce of 150ms SHALL be applied to avoid excessive queries

### Requirement: Search Result Highlighting
The system SHALL highlight matching text in search results.

#### Scenario: Highlight Matched Text
- **WHEN** results are displayed
- **THEN** text matching the search query SHALL be highlighted with a distinct background color

### Requirement: Search History Memory
The system SHALL remember recent searches.

#### Scenario: Search History Display
- **WHEN** the user opens the search modal
- **THEN** recent search queries SHALL be displayed as quick-select options

### Requirement: Advanced Search Filters
The system SHALL support advanced filtering options.

#### Scenario: Filter by Date Range
- **WHEN** the user specifies a date range
- **THEN** only results within that range SHALL be shown

#### Scenario: Filter by Tool Type
- **WHEN** the user specifies a tool type filter
- **THEN** only results with matching tool calls SHALL be shown

### Requirement: Search Result Navigation
The system SHALL allow keyboard navigation through search results.

#### Scenario: Arrow Key Navigation
- **WHEN** the search results are displayed
- **THEN** the user SHALL be able to navigate using Arrow Up/Down keys

#### Scenario: Enter to Select
- **WHEN** a result is highlighted and the user presses Enter
- **THEN** the selected result SHALL be opened
