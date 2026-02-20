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
- **Resend** - Email delivery via SMTP (Supabase Auth) and API (custom emails)
- **Drizzle ORM** - Type-safe database queries
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Setup

1. **Install dependencies:**

   ```bash
   bun install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file in the root directory:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DATABASE_URL=your_postgres_connection_string
   RESEND_API_KEY=your_resend_api_key  # Optional: for custom emails from the app
   RESEND_FROM_EMAIL=Portal <noreply@yourdomain.com>  # Sender for cron alerts (use verified Resend domain)
   ```

   **Important:**
   - Use the **anon key** (publishable key) for `NEXT_PUBLIC_SUPABASE_ANON_KEY` - this is safe for client-side use
   - The **service_role key** (secret key) should NEVER be used in `NEXT_PUBLIC_` variables - it's only for server-side admin operations
   - You can find both keys in your Supabase dashboard under Settings > API
   - **Production (Vercel)**: Use the Supabase **Transaction pooler** connection string (port 6543) for `DATABASE_URL` to avoid connection exhaustion. In Dashboard → Project Settings → Database → Connection string, select "URI" and "Transaction" mode.

3. **Set up Supabase:**
   - Create a new Supabase project
   - Copy your project URL and anon key to `.env.local`
   - In Supabase dashboard, go to Authentication > Settings
   - Enable "Email" provider
   - Disable "Enable sign up" (accounts are added manually)
   - In **Authentication → URL Configuration**, set **Site URL** (e.g. `https://portal.exo.black`) and add your callback to **Redirect URLs** (e.g. `https://portal.exo.black/auth/callback`)
   - **Important**: Customize the **Magic Link** email template (Authentication → Email Templates) so links work across devices. Replace the default link with:
     ```
     {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=magiclink
     ```
     This ensures users can click the link from any browser or device (e.g. request on desktop, click from phone email).

4. **Configure Resend SMTP for Supabase Auth** (fixes "email rate limit exceeded"):
   - Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **SMTP Settings**
   - Enable custom SMTP and enter Resend credentials:
     - **Host:** `smtp.resend.com`
     - **Port:** `465`
     - **Username:** `resend`
     - **Password:** Your Resend API key (from [resend.com/api-keys](https://resend.com/api-keys))
   - Set **Sender email** and **Sender name** (use a verified domain in Resend)
   - Save — magic links will be sent via Resend, bypassing Supabase's 2/hour default limit

5. **Set up Database:**
   - Run Drizzle migrations to create tables:

   ```bash
   bun db:generate
   bun db:migrate
   ```

6. **Add client accounts manually:**
   - In Supabase dashboard, go to Authentication > Users
   - Click "Add user" and enter the client's email
   - The client will receive a magic link to sign in

7. **Run the development server:**

   ```bash
   bun dev
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
    ├── email/             # Resend email client
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
