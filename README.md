# BackstageChat.me

**BackstageChat.me** is a private, 1-on-1 creator chat platform built with Next.js (App Router), Clerk Authentication, Supabase (PostgreSQL & Realtime WebSockets), and Stripe Checkout.

---

## 🏗️ System Architecture

```text
Frontend (Next.js on Cloudflare / Vercel)
         ↓
Cloudflare Tunnel (https://api.backstagechat.me)
         ↓
Local Mac Backend Infrastructure
         ├── Supabase (Docker / PostgreSQL & Realtime WebSockets)
         ├── External AI Agent Backend (OpenAI / Python Orchestrator)
         └── Stripe Checkout (Credit Refills)
```

- **Production Domain**: `backstagechat.me`
- **Cloudflare API Tunnel**: `https://api.backstagechat.me`
  - Tunnel Name: `supabase`
  - Tunnel ID: `c04c55b2-e1b5-4097-a3b6-f63c0b65d345`

---

## ✨ Features

- **Direct 1-on-1 Creator Chat**: Private chat sandbox with creator profile (Harnoor K.), live active status badge (Online / Active Xm ago), and message history.
- **Pure Realtime WebSockets**:
  - **Live Replies**: Real-time `INSERT` listening on the `messages` table.
  - **Read Receipts**: Blue double checkmarks (`✓✓`) triggered live when `is_read = true`.
  - **AI Typing Indicator**: Real-time typing animation (`...`) synced via `ai_typing` in the `users` table.
  - **Live Online Status**: Immediate switch to "Online 🟢" when messages are read, typed, or received.
- **Smart Message Pagination**:
  - Automatically loads the 20 most recent messages on mount.
  - "Load earlier messages" button to fetch previous history with seamless scroll position preservation.
- **Dual-Currency Credit System (USD & INR)**:
  - Stripe Checkout integration for credit refills with dual-currency support ($ USD and ₹ INR).
  - Dynamic session calculations (50 credits = 1 chat session, 100 credits = 2 sessions, 200 credits = 4 sessions).
- **Apple-Style Glassmorphic UI**:
  - Multi-colored studio mesh gradient backdrop with frosted glass panels (`backdrop-blur-2xl`).
  - Seamless adaptation across light and dark modes.

---

## 🛠️ Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/) (App Router, Server Actions, TypeScript)
- **Authentication**: [Clerk](https://clerk.com/) (Google Login, Email, User Profile)
- **Database & Realtime**: [Supabase](https://supabase.com/) (PostgreSQL running locally via Docker & Supabase CLI)
- **Payments**: [Stripe](https://stripe.com/) (Checkout Sessions with USD & INR)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)

---

## 🗄️ Database Schema (Public Schema)

### `users` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `int8` (PK) | Primary Key (referenced by `messages.user_id`) |
| `clerk_id` | `text` | Unique Clerk user ID (`clerk_...`) |
| `email` | `text` | User's email address |
| `full_name` | `text` | User's display name |
| `credits` | `int4` | Current credit balance (defaults to 10 on signup) |
| `ai_typing` | `bool` | Flag for real-time typing indicator (`true`/`false`) |
| `current_conversation_type` | `text` | Current conversation stage / topic |
| `conversation_types_done` | `_text` | Array of completed conversation stages |
| `no_reply` | `bool` | Backend flag for reply pausing |
| `message_counter` | `int2` | Message count tracking |
| `created_at` | `timestamptz`| Account creation timestamp |
| `updated_at` | `timestamptz`| Last profile update timestamp |

### `messages` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `int8` (PK) | Primary Key |
| `user_id` | `int8` (FK) | Foreign Key referencing `users.id` |
| `sender_type` | `text` | `"user"` or `"Harnoor"` |
| `message_text` | `text` | Text content of the message |
| `is_read` | `bool` | Read receipt flag (`true` shows blue double checkmarks) |
| `created_at` | `timestamptz`| Message timestamp |

---

## ⚡ Supabase Realtime Setup

To ensure real-time events broadcast properly across WebSocket channels, run the following in your Supabase SQL editor:

```sql
-- Enable Realtime publication for messages and users tables
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- Set replica identity to full so update payloads contain complete records
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE users REPLICA IDENTITY FULL;
```

---

## 🔐 Environment Variables

Create a `.env.local` file in the project root:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase Local / Remote
NEXT_PUBLIC_SUPABASE_URL=https://api.backstagechat.me
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
```

---

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start local Supabase (Docker)**:
   ```bash
   supabase start
   ```

3. **Run the Next.js development server**:
   ```bash
   npm run dev
   ```

4. **Open the application**:
   - Landing page: [http://localhost:3000](http://localhost:3000)
   - Creator chat: [http://localhost:3000/harnoor](http://localhost:3000/harnoor)

