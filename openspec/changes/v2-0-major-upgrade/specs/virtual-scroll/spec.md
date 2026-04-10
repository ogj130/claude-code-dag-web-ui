## ADDED Requirements

### Requirement: ReactFlow Virtualization Enabled
The system SHALL enable ReactFlow's built-in virtualization to only render nodes in the visible viewport.

#### Scenario: Virtualization Activation
- **WHEN** the DAG has more than 50 nodes
- **THEN** ReactFlow virtualization SHALL be automatically enabled

#### Scenario: Viewport-Only Rendering
- **WHEN** the user pans or zooms the DAG
- **THEN** only nodes within the visible viewport SHALL be rendered
- **AND** nodes outside the viewport SHALL NOT be in the DOM

### Requirement: Performance Target Achievement
The system SHALL render 100 nodes within 500ms.

#### Scenario: 100 Node Rendering Performance
- **WHEN** a DAG with 100 nodes is loaded
- **THEN** the initial render SHALL complete within 500ms

#### Scenario: 1000 Node Rendering Performance
- **WHEN** a DAG with 1000 nodes is loaded
- **THEN** the initial render SHALL complete within 2 seconds

### Requirement: Smooth Panning and Zooming
The system SHALL maintain 50+ FPS during panning and zooming with virtualized nodes.

#### Scenario: Smooth Panning
- **WHEN** the user pans the DAG
- **THEN** the frame rate SHALL remain above 50 FPS

#### Scenario: Smooth Zooming
- **WHEN** the user zooms in or out
- **THEN** the frame rate SHALL remain above 50 FPS

### Requirement: Node Culling
The system SHALL cull (remove from DOM) nodes that are far outside the viewport.

#### Scenario: Node Culling Distance
- **WHEN** a node is more than 2 viewport widths away from the visible area
- **THEN** the node SHALL be culled from the DOM
- **AND** it SHALL be re-added when it comes back into view
