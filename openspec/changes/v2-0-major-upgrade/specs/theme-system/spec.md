## ADDED Requirements

### Requirement: Light and Dark Theme Support
The system SHALL support both light and dark color themes.

#### Scenario: Light Theme
- **WHEN** the user selects light theme
- **THEN** all UI elements SHALL use light color palette

#### Scenario: Dark Theme
- **WHEN** the user selects dark theme
- **THEN** all UI elements SHALL use dark color palette

### Requirement: System Theme Following
The system SHALL follow the OS-level theme preference when set to "Auto" (default).

#### Scenario: Auto Theme Selection (Default)
- **WHEN** the theme is set to "Auto" (default for new users)
- **THEN** the application SHALL automatically match the system's theme setting via `prefers-color-scheme`
- **AND** SHALL update in real-time when the system theme changes

### Requirement: Theme Color Presets
The system SHALL provide 6 preset theme colors.

#### Scenario: Theme Color Selection
- **WHEN** the user selects a theme color
- **THEN** the primary accent color SHALL change accordingly
- **AND** the available presets SHALL be: Blue, Purple, Green, Orange, Red, Pink

### Requirement: Node Density Options
The system SHALL provide 3 node density options: Compact, Standard, Loose.

#### Scenario: Compact Density
- **WHEN** the user selects compact density
- **THEN** DAG nodes SHALL be rendered with minimal padding and spacing

#### Scenario: Standard Density
- **WHEN** the user selects standard density
- **THEN** DAG nodes SHALL be rendered with default padding and spacing

#### Scenario: Loose Density
- **WHEN** the user selects loose density
- **THEN** DAG nodes SHALL be rendered with extra padding and spacing

### Requirement: Font Size Adjustment
The system SHALL support font sizes from 12px to 18px.

#### Scenario: Font Size Slider
- **WHEN** the user adjusts the font size slider
- **THEN** the font size SHALL update in real-time
- **AND** SHALL persist across sessions

### Requirement: Theme Persistence
The system SHALL persist theme preferences in localStorage.

#### Scenario: Theme Preference Persistence
- **WHEN** the user changes theme settings
- **THEN** the settings SHALL be saved to localStorage
- **AND** SHALL be restored on page load
