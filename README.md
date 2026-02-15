# SMBOS (Smart Business Operating System)

SMBOS is a smart digital action interface designed for high-precision task execution through the orchestration of human-agent collaboration and modular toolsets.

## Architecture & Design Principles

### Modular Skill System
SMBOS implements a decentralized skill architecture based on the **Agent Skills open standard**. Each functionality is encapsulated as an isolated module within the `skills/` directory.

*   **Atomic Definitions**: Each skill directory is self-contained, containing logic, UI schema, and documentation.
*   **Discovery**: The system uses a filesystem-based discovery mechanism to dynamically load and register skills at runtime.
*   **Standardized Interoperability**: Skills utilize `SKILL.md` with YAML frontmatter for instruction sets, ensuring compatibility with LLM-based agent orchestrators.

### Dynamic UI Orchestration
The platform utilizes a generic `DynamicSkillUI` engine that consumes JSON schema definitions (`ui.json`) to render complex, state-driven interfaces.

*   **Schema-Driven Components**: Input forms, data tables, and filters are generated dynamically from metadata.
*   **Unified Execution Path**: Tool invocations are routed through a standardized API wrapper (`/api/skills/[id]/execute`) that resolves to local module exports.
*   **State Management**: Unified handling of pagination, filtering, and asynchronous data fetching across all skill types.

### Telemetry & Analytics
Integrated telemetry captures granular interaction data for every skill execution.
*   **Persistence**: Structured logging of parameters, results, and performance metrics.
*   **Analysis**: Data is exposed for periodic analysis by agents to optimize workflows and identify automation opportunities.

## Technical Specifications

*   **Framework**: Next.js 16 (App Router, Turbopack)
*   **Language**: TypeScript 5+ (Strict mode)
*   **Design System**: IBM Carbon Design System v11
*   **Database**: SQLite (via better-sqlite3) for configuration and telemetry persistence
*   **Isolation**: Designed for container-native execution environments (Docker/NanoClaw compatible)

## Directory Structure

```text
smbos/
├── skills/               # Decentralized skill modules
│   └── <id>/             
│       ├── SKILL.md      # Frontmatter and instructions
│       ├── ui.json       # UI Schema and API mapping
│       ├── scripts/      # Execution logic (TypeScript/Shell)
│       ├── template.md   # Output formatting templates
│       └── examples/     # Training data and samples
├── components/           # Core UI engine and shell components
├── app/api/              # RESTful API infrastructure
├── lib/                  # Shared libraries and database utilities
└── info/                 # Integration prompts and technical docs
```

## Development & Integration

### Skill Contribution
New tools should be contributed following the modular standard defined in [`smbos/info/SKILL_CONTRIBUTION_PROMPT.md`](smbos/info/SKILL_CONTRIBUTION_PROMPT.md). No modifications to the core app logic are required for skill integration.

### Setup
1.  Initialize environment variables in `.env.local`.
2.  Install dependencies: `npm install`
3.  Execute development server: `npm run dev`
