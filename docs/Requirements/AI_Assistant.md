# AI Assistant & Chatbot Framework

## Objective
Provide a secure, HIPAA-compliant conversational co-pilot for hospital staff to manage clinical and operational data.

## Subscription Tier
- **Professional** (Tier 3) only.

## Key Requirements
### 1. Data Isolation & Privacy
- **Tenant Isolation**: The AI must be strictly "jailed" to the current hospital shard.
- **No Cross-Tenant Awareness**: Zero visibility into data from other hospital facilities.
- **Transient Context**: Patient data is used only for real-time inference and never stored in the AI's permanent training memory.

### 2. Operational Intelligence
- **Real-time Metrics**: Awareness of current hospital stats (Patient counts, active admissions, pending lab orders).
- **Clinical Co-pilot**: Assistance with medical queries and hospital SOPs.
- **Predictive Clinical Analytics**: Real-time forecasting of consultation times, triage priority, and case complexity based on clinical context.
- **Intelligent Summarization**: Automated generation of Medication Instructions and structured Discharge Summaries from multi-source clinical data.
- **Administrative Aid**: Help with billing status and operational bottlenecks.

### 3. Interface & UX
- **Global Widget**: Floating, persistent chat interface across all tenant pages.
- **Thinking Indicators**: Visual feedback for long-running analytical queries.
- **Context Preservation**: Maintaining conversation history within the current session.

## Technical Architecture
- **Engine**: Google Gemini 1.5 (Pro/Flash).
- **Pattern**: AI Router Pattern for task-based orchestration.
- **Security**: Tenant-ID locked Context Injection via backend middleware.
