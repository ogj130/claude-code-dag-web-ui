## ADDED Requirements

### Requirement: Global Search Shortcut
The system SHALL open the global search modal when the user presses Cmd/Ctrl + K.

#### Scenario: Open Global Search
- **WHEN** the user presses Cmd/Ctrl + K
- **THEN** the global search modal SHALL open
- **AND** the search input SHALL be focused

#### Scenario: Close Global Search
- **WHEN** the user presses Escape while in the global search modal
- **THEN** the modal SHALL close

### Requirement: DAG Collapse All Shortcut
The system SHALL collapse all nodes when the user presses Cmd/Ctrl + Shift + C.

#### Scenario: Collapse All Nodes
- **WHEN** the user presses Cmd/Ctrl + Shift + C while in the DAG view
- **THEN** all expandable nodes SHALL be collapsed

### Requirement: DAG Expand All Shortcut
The system SHALL expand all nodes when the user presses Cmd/Ctrl + Shift + E.

#### Scenario: Expand All Nodes
- **WHEN** the user presses Cmd/Ctrl + Shift + E while in the DAG view
- **THEN** all collapsed nodes SHALL be expanded

### Requirement: Theme Toggle Shortcut
The system SHALL toggle the theme when the user presses Cmd/Ctrl + T.

#### Scenario: Toggle Theme
- **WHEN** the user presses Cmd/Ctrl + T
- **THEN** the theme SHALL cycle through: Light → Dark → System

### Requirement: History Panel Toggle Shortcut
The system SHALL toggle the history panel when the user presses Cmd/Ctrl + H.

#### Scenario: Toggle History Panel
- **WHEN** the user presses Cmd/Ctrl + H
- **THEN** the history sidebar SHALL toggle visibility

### Requirement: Escape Key Handling
The system SHALL handle the Escape key for closing modals and canceling selections.

#### Scenario: Escape to Close Modal
- **WHEN** the user presses Escape
- **THEN** any open modal SHALL be closed

#### Scenario: Escape to Deselect
- **WHEN** the user presses Escape with no modal open
- **THEN** the current node selection SHALL be cleared

### Requirement: Keyboard Shortcut Conflict Warning
The system SHALL display a warning when a keyboard shortcut conflicts with browser shortcuts.

#### Scenario: Shortcut Conflict Warning
- **WHEN** the application detects a shortcut conflict (e.g., Cmd/Ctrl+K with browser address bar)
- **THEN** the user SHALL be notified with a warning message
- **AND** the shortcut SHALL still function (not automatically adjusted)
- **AND** the user can choose to remap the shortcut manually if desired
