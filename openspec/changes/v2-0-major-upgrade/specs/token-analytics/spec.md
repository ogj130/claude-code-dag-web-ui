## ADDED Requirements

### Requirement: Per-Query Token Display
The system SHALL display token usage for each query in the UI.

#### Scenario: Token Usage Display
- **WHEN** a query completes
- **THEN** the token usage SHALL be displayed in the query card
- **AND** SHALL show both input and output tokens separately

### Requirement: Session Total Token Display
The system SHALL display total token usage for each session.

#### Scenario: Session Token Summary
- **WHEN** the user views a session
- **THEN** the total token usage SHALL be displayed
- **AND** SHALL be calculated as the sum of all query token usages

### Requirement: Daily Token Usage Trend
The system SHALL display a line chart showing token usage trends over the past 7 and 30 days.

#### Scenario: 7-Day Trend Chart
- **WHEN** the user views the token statistics
- **THEN** a line chart SHALL show daily token usage for the past 7 days

#### Scenario: 30-Day Trend Chart
- **WHEN** the user selects 30-day view
- **THEN** the chart SHALL show daily token usage for the past 30 days

### Requirement: Cost Estimation
The system SHALL provide token count display only, without USD conversion.

#### Scenario: Token Count Display
- **WHEN** token usage data is available
- **THEN** the system SHALL display only the token count
- **AND** SHALL NOT convert to USD (as model pricing varies and USD conversion can be misleading)

> **Note:** USD cost estimation is deferred. Users can manually calculate costs using their model's pricing if needed.

### Requirement: Token Statistics Settings
The system SHALL allow users to configure model pricing for cost estimation.

#### Scenario: Configure Model Pricing
- **WHEN** the user opens settings
- **THEN** they SHALL be able to input price per 1M tokens for their model
- **AND** the setting SHALL be persisted
