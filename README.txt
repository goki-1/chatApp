BackstageChat.me - Current Status
Project Goal

A website where users can:

Visit a public landing page.
Click Sign In / Sign Up.
Authenticate with Clerk.
Enter a chat interface.
Chat with an AI.
Credits are consumed per message.
Payments handled through Stripe and Razorpay.
Current Architecture
Frontend (Next.js)
        ↓
Cloudflare
        ↓
Mac Mini
        ├── Supabase
        ├── Future Backend APIs
        └── OpenAI Integration (future)
Hosting
Frontend

Hosted through Cloudflare.

Domain:

backstagechat.me

Current status:

Landing page works
Clerk login works
Database

Running on local Mac Mini using Supabase.

Supabase started through:

supabase start

Runs inside Docker containers.

Current API exposed through Cloudflare Tunnel:

https://api.backstagechat.me

Example endpoint:

https://api.backstagechat.me/rest/v1/users

Returns database data successfully.

Cloudflare Tunnel

Tunnel created:

supabase

Tunnel ID:

c04c55b2-e1b5-4097-a3b6-f63c0b65d345

Cloudflare Tunnel is being used so the database APIs running on the Mac can be reached from the internet.

Authentication

Using:

Clerk

Current features:

✓ Sign In
✓ Sign Up
✓ User Button
✓ Google Login

Current Clerk user object can be retrieved with:

const user = await currentUser();

Example Clerk fields available:

user.id
user.firstName
user.lastName
user.emailAddresses
user.imageUrl

Example Clerk ID:

user_3EnbUkSqXVkdxNv2YTM3DkaTeR3
Database Schema
users
create table users (
    id bigint generated always as identity primary key,

    clerk_id text unique not null,

    email text,
    full_name text,

    age int,
    country text,
    gender text,

    credits int default 0,

    stripe_customer_id text,
    razorpay_customer_id text,

    last_seen_at timestamptz,

    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

Purpose:

Stores application user profile
Maps Clerk users to database users
Tracks credits and payment accounts
conversations
create table conversations (
    id bigint generated always as identity primary key,

    user_id bigint references users(id),

    title text,

    conversation_type text,

    status text default 'active',

    started_at timestamptz default now(),
    finished_at timestamptz,

    created_at timestamptz default now()
);

Purpose:

One row per chat conversation
Tracks active and completed chats
messages
create table messages (
    id bigint generated always as identity primary key,

    conversation_id bigint not null
        references conversations(id)
        on delete cascade,

    sender_type text not null,

    message_text text not null,

    is_read boolean default false,

    created_at timestamptz default now()
);

Purpose:

Stores chat history
Stores both user and AI messages

Current plan:

Text messages only
Audio/image support later
Supabase Configuration
Public Client
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

Used for:

Client-side database access
Admin Client
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

Used for:

Server-only operations
Create users
Update credits
Future payment processing
Environment Variables

Currently expected:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

Future:

OPENAI_API_KEY=

STRIPE_SECRET_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
Current UI

Landing page exists.

Header contains:

Backstage Chat.me

Authentication buttons:

Sign In
Sign Up
User Button
Completed Features
✓ GitHub repository created
✓ Mac development environment configured
✓ Next.js running on Mac
✓ Cloudflare hosting configured
✓ Clerk authentication configured
✓ Supabase installed and running locally
✓ Docker running on Mac
✓ Cloudflare Tunnel configured
✓ Database tables created
✓ Next.js can connect to Supabase
✓ Clerk user object accessible
Next Tasks
1. User Sync

Create/update user automatically after login.

Flow:

Clerk User
      ↓
users table

Store:

clerk_id
email
full_name
credits
2. Chat Page

Create:

/ chat

After login:

Landing Page
      ↓
Login
      ↓
Chat Page
3. Conversation Creation

When user starts chat:

insert into conversations
4. Message Storage

When user sends message:

insert into messages
5. OpenAI Integration

Flow:

User Message
      ↓
Save Message
      ↓
OpenAI API
      ↓
Save AI Response
      ↓
Return Response
6. Credits System

Store credits in:

users.credits

Deduct credits per AI request.

7. Payments

Integrate:

Stripe
Razorpay

to purchase credits.