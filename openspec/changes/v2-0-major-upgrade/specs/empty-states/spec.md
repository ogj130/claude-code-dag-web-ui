## ADDED Requirements

### Requirement: No Session Empty State
The system SHALL display a friendly empty state when there is no active session.

#### Scenario: No Active Session
- **WHEN** the user opens the application with no active session
- **THEN** the UI SHALL display:
  - An illustration or icon representing "no session"
  - Text: "暂无会话"
  - A "New Session" button to create a new session

### Requirement: No History Empty State
The system SHALL display a friendly empty state when there are no history records.

#### Scenario: No History Records
- **WHEN** the user opens the history panel with no history records
- **THEN** the UI SHALL display:
  - An illustration or icon representing "no history"
  - Text: "暂无历史记录"
  - A brief explanation: "您的会话历史将显示在这里"

### Requirement: Loading State
The system SHALL display a loading skeleton when data is being fetched.

#### Scenario: Session Loading
- **WHEN** the application is fetching session data
- **THEN** the UI SHALL display skeleton placeholders instead of the actual content
- **AND** the skeletons SHALL match the layout of the actual content

#### Scenario: DAG Loading
- **WHEN** the DAG is loading nodes
- **THEN** the UI SHALL display a centered loading spinner with text "加载中..."

### Requirement: Error State Display
The system SHALL display a friendly error state when data fetching fails.

#### Scenario: Data Fetch Error
- **WHEN** the application fails to fetch data (network error, server error)
- **THEN** the UI SHALL display:
  - An error icon
  - The error message
  - A "Retry" button to attempt the fetch again
