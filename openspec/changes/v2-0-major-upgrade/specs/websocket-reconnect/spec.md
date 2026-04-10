## ADDED Requirements

### Requirement: WebSocket Connection State Machine
The WebSocket connection layer SHALL implement a state machine with the following states: `disconnected`, `connecting`, `connected`, `reconnecting`, `failed`.

#### Scenario: Initial Connection
- **WHEN** the application loads and WebSocket is not connected
- **THEN** the state machine transitions to `connecting` state and attempts connection to the server

#### Scenario: Successful Connection
- **WHEN** the WebSocket successfully connects to the server
- **THEN** the state machine transitions to `connected` state and emits a `connected` event

#### Scenario: Unexpected Disconnection
- **WHEN** the WebSocket connection is lost unexpectedly (not manually closed)
- **THEN** the state machine transitions to `reconnecting` state and begins automatic reconnection attempts

### Requirement: Automatic Reconnection with Exponential Backoff
The system SHALL implement automatic reconnection with exponential backoff when the connection is lost.

#### Scenario: Reconnection Attempt Sequence
- **WHEN** the connection is lost
- **THEN** the system SHALL attempt reconnection with delays of 5s, 10s, 30s (exponential backoff)

#### Scenario: Max Reconnection Attempts
- **WHEN** the system has attempted 3 reconnection attempts without success
- **THEN** the state machine transitions to `failed` state and stops automatic reconnection

#### Scenario: Connection Restored After Reconnection
- **WHEN** the reconnection attempt succeeds before reaching max attempts
- **THEN** the state machine transitions to `connected` state and emits a `reconnected` event

### Requirement: Manual Reconnection
The system SHALL provide a manual "Reconnect" button when in `failed` state.

#### Scenario: Manual Reconnect Button
- **WHEN** the connection state is `failed`
- **THEN** the UI SHALL display a "Reconnect" button

#### Scenario: Manual Reconnect Triggered
- **WHEN** the user clicks the "Reconnect" button
- **THEN** the state machine transitions to `connecting` state and attempts connection

### Requirement: Connection Status Indicator
The system SHALL display the current connection status to the user.

#### Scenario: Disconnected Status Display
- **WHEN** the connection state is `disconnected` or `failed`
- **THEN** the UI SHALL display a red connection indicator with text "Disconnected"

#### Scenario: Reconnecting Status Display
- **WHEN** the connection state is `reconnecting`
- **THEN** the UI SHALL display a yellow connection indicator with text "Reconnecting..." and the retry count

#### Scenario: Connected Status Display
- **WHEN** the connection state is `connected`
- **THEN** the UI SHALL display a green connection indicator with text "Connected"

### Requirement: Message Queue During Reconnection
The system SHALL queue outgoing messages during reconnection and flush them upon reconnection.

#### Scenario: Message Queuing
- **WHEN** the user sends a message while the connection state is `reconnecting`
- **THEN** the message SHALL be queued locally

#### Scenario: Message Flushing
- **WHEN** the connection state transitions to `connected` and the queue is not empty
- **THEN** the system SHALL flush all queued messages in order
