## ADDED Requirements

### Requirement: Node Type Grouping
The system SHALL group nodes of the same type together for aggregated display.

#### Scenario: Group Nodes by Type
- **WHEN** multiple nodes of the same type are present
- **THEN** they SHALL be grouped under a single group node
- **AND** the group node SHALL show the count of contained nodes

#### Scenario: Expand Group Node
- **WHEN** the user clicks on a group node
- **THEN** the group SHALL expand to show all individual nodes
- **AND** the group node SHALL collapse back when clicked again

### Requirement: Node Aggregation
The system SHALL display an aggregated summary when nodes are grouped.

#### Scenario: Aggregated Node Summary
- **WHEN** nodes are grouped
- **THEN** the group node SHALL display:
  - The node type name
  - The count of contained nodes
  - A summary of the contained operations

### Requirement: Grouping Toggle
The system SHALL provide a toggle to enable/disable node grouping.

#### Scenario: Toggle Grouping On
- **WHEN** the user enables node grouping
- **THEN** nodes SHALL be grouped by type immediately

#### Scenario: Toggle Grouping Off
- **WHEN** the user disables node grouping
- **THEN** all nodes SHALL be displayed individually

### Requirement: Rendering Reduction Target
Node grouping SHALL reduce the number of rendered nodes by at least 50%.

#### Scenario: Grouping Efficiency
- **WHEN** a DAG with 100 similar nodes is grouped
- **THEN** the visible node count SHALL be reduced by at least 50%
