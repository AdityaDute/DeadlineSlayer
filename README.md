# DeadlineSlayer ⚔️📅
### AI-Powered Multi-Agent Productivity Rescue Engine (Hackathon Winner)

DeadlineSlayer is a premium, high-fidelity dark-themed productivity dashboard built using **Next.js 15 App Router**, **Firebase (Auth + Firestore)**, and **Google Gemini 2.0 Flash**. It introduces a sophisticated, multi-agent AI crew designed to actively rescue you from deadline crunches.

---

## 🌟 Core Architecture: The Slayer Agent Crew

DeadlineSlayer replaces typical, static, passive reminder notifications with a team of active, autonomous, coordinated sub-agents:

1. **Master Orchestrator Agent (`/src/agents/orchestrator.js`)**
   - Parses the user's natural language inputs inside the bottom-bar conversational console.
   - Categorizes user intents (`add_goal`, `execute_task`, `check_deadlines`, `general_chat`) and coordinates workflow routing.

2. **Strategic Planner Agent (`/src/agents/planner.js`)**
   - Activated automatically whenever a new high-level Goal is created.
   - Instantly deconstructs the objective into a logical chronological list of 3-6 actionable subtasks complete with hours of effort and priority targets.

3. **Dynamic Prioritizer Agent (`/src/agents/prioritizer.js`)**
   - Automatically scores task urgency and strategic importance.
   - Maps tasks dynamically onto the **Eisenhower Rescue Matrix** quadrants with single-sentence expert justifications.

4. **Elite Executor Agent (`/src/agents/executor.js`)**
   - Triggered via the "AI Execute" button on task rows.
   - Autonomously generates ready-to-use custom drafts, codes, outlines, copy, or technical assets, cutting initial friction by 80%.

5. **Guardian Watchdog Agent (`/src/agents/guardian.js`)**
   - Continuously scans active goals, pending tasks, and workload time blocks.
   - Engages **Panic Mode Protocol** automatically if impending crunches are detected, rendering an hour-by-hour tactical survival roadmap.

---

## 🛠️ Project Structure

```bash
src/
├── app/
│   ├── api/agent/route.js        # Secure Server-Side Agent Proxy
│   ├── dashboard/                # Premium Workspace (Protected Route)
│   ├── globals.css               # Design Tokens, Glassmorphism, Resets
│   ├── layout.js                 # Font loaders and Provider wrapper
│   └── page.js                   # High-Conversion Landing page
├── components/
│   ├── AuthProvider.js           # Firebase Auth State Monitor
│   ├── Sidebar.js                # Left panel: Goals & Agent lights
│   ├── TaskCard.js               # Interactive Checklist item
│   ├── ChatInput.js              # Natural Language Conversation Bar
│   ├── AgentStatus.js            # Live-scrolling Ledger Terminal
│   ├── PriorityMatrix.js         # Eisenhower 2x2 Grid View
│   ├── ExecutorOutput.js         # AI-generated Asset Sandbox
│   ├── PanicMode.js              # Red alert emergency schedule
│   └── GoalCard.js               # Nested sidebar goal items
├── agents/                       # Prompt specifications & Gemini schemas
├── lib/                          # Firebase Admin, Client, Gemini, Firestore CRUD
└── hooks/                        # useAuth and useTasks listeners
```

---

## 🔌 Environment Variables Configuration

Copy `/.env.local.example` into `/.env.local` and populate the values:

```env
# Firebase Client Configuration (Publicly Exposed to Client)
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_PROJECT_ID.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_PROJECT_ID.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"

# Gemini API Configuration (Private Server-Side Variable)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

