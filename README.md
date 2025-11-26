# EXO Client Portal

A Next.js client portal application built with Supabase authentication, Drizzle ORM, and Tailwind CSS.

## Features

- 🔐 **Email Magic Link Authentication** - Simple email-based authentication via Supabase (no registration, accounts are added manually)
- 🎨 **Modern UI** - Built based on Figma design with fixed background and responsive layout
- 📊 **Project Management** - View project details, deliverables, client assets, and legal documents
- 💾 **Database** - Drizzle ORM with PostgreSQL (via Supabase)
- 🎯 **Fixed Layout** - Background image stays fixed while content scrolls, user info always visible in top right

## Tech Stack

- **Next.js 16** - React framework with App Router
- **Supabase** - Authentication and database
- **Drizzle ORM** - Type-safe database queries
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file in the root directory:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DATABASE_URL=your_postgres_connection_string
   ```

   **Important:**
   - Use the **anon key** (publishable key) for `NEXT_PUBLIC_SUPABASE_ANON_KEY` - this is safe for client-side use
   - The **service_role key** (secret key) should NEVER be used in `NEXT_PUBLIC_` variables - it's only for server-side admin operations
   - You can find both keys in your Supabase dashboard under Settings > API

3. **Set up Supabase:**
   - Create a new Supabase project
   - Copy your project URL and anon key to `.env.local`
   - In Supabase dashboard, go to Authentication > Settings
   - Enable "Email" provider
   - Disable "Enable sign up" (accounts are added manually)
   - Set up email templates for magic links

4. **Set up Database:**
   - Run Drizzle migrations to create tables:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. **Add client accounts manually:**
   - In Supabase dashboard, go to Authentication > Users
   - Click "Add user" and enter the client's email
   - The client will receive a magic link to sign in

6. **Run the development server:**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── auth/
│   │   └── callback/     # Auth callback handler
│   ├── login/            # Login page
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main portal page
├── components/
│   ├── ProjectDetails.tsx # Main project content
│   └── UserInfo.tsx       # Fixed user info component
├── db/
│   ├── schema.ts          # Drizzle schema definitions
│   └── index.ts           # Database connection
└── lib/
    └── supabase/          # Supabase client utilities
```

## Database Schema

The application uses the following main tables:

- `users` - User accounts (managed via Supabase Auth)
- `projects` - Project information
- `deliverables` - Project deliverables/files
- `client_assets` - Client-uploaded assets
- `legal_documents` - Contracts, NDAs, invoices

## Authentication Flow

1. User enters email on login page
2. Supabase sends magic link email
3. User clicks link and is redirected to `/auth/callback`
4. Session is established and user is redirected to portal
5. Middleware protects routes and redirects unauthenticated users to login

## Notes

- The background image (`bg.jpg`) is fixed and stays in place when scrolling
- User info component is fixed in the top right corner
- No registration - all accounts must be created manually in Supabase dashboard
- Magic links expire after a set time (configurable in Supabase)

## License

Private project for EXO.
