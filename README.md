# Plan.krd - Enterprise Task Management Platform

An advanced AI-powered task management platform built with Next.js, Supabase, and modern web technologies. Plan.krd provides teams with intelligent workflows, real-time collaboration, and powerful task organization capabilities.

## Features

### Core Features
- **Workspace Management**: Create and manage multiple workspaces with role-based access control
- **Kanban Boards**: Visual task management with drag-and-drop functionality
- **Task Management**: Rich task details with assignees, labels, priorities, due dates, and custom fields
- **Real-time Collaboration**: Live updates using Supabase Realtime
- **Multiple Views**: Kanban, List, Calendar, and Workload views
- **Offline Support**: Optimistic updates with offline queue synchronization

### AI Features
- **AI Chat Assistant**: Natural language queries and task management
- **Task Decomposer**: Break down complex tasks into subtasks
- **Auto-Tagging**: AI-powered label and priority suggestions
- **Smart Summaries**: Summarize long descriptions and comments
- **Document RAG**: Chat with attached PDFs

### Enterprise Features
- **RTL Support**: Full UI mirroring for Kurdish/Arabic languages
- **Public Boards**: Share read-only board links
- **Activity Logs**: Complete audit trail of changes
- **Notifications**: In-app notifications for mentions and assignments
- **Search**: Global search across workspaces and tasks
- **Reports**: Export task data to CSV

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Radix UI components
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **State Management**: TanStack Query (React Query)
- **AI**: OpenRouter API (Google Gemini 3 Flash)
- **Drag & Drop**: @hello-pangea/dnd
- **Rich Text**: TipTap

## Getting Started

### Prerequisites

- Node.js 20+ 
- npm or yarn
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd plan.krd
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenRouter AI (optional, for AI features)
OPENROUTER_API_KEY=your_openrouter_api_key

# App URL (optional, defaults to http://localhost:3000)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Set up the database:
   - Create a Supabase project
   - Run the database migrations (see Database Setup below)
   - Configure Row Level Security (RLS) policies

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

The application uses Supabase (PostgreSQL) with the following key tables:

- `workspaces` - Workspace management
- `boards` - Kanban boards
- `lists` - Board columns/lists
- `tasks` - Task items
- `task_assignees` - Task assignments
- `task_labels` - Task labels
- `subtasks` - Nested subtasks
- `comments` - Task comments
- `attachments` - File attachments
- `notifications` - User notifications
- `custom_fields` - Board-specific custom fields

**Important**: All tables must have Row Level Security (RLS) enabled. Users should only see data from workspaces they are members of.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/       # Dashboard routes
│   ├── auth/              # Authentication pages
│   └── public/            # Public board views
├── components/            # React components
│   ├── ai/               # AI feature components
│   ├── boards/           # Board components
│   ├── kanban/           # Kanban view components
│   ├── tasks/            # Task components
│   ├── ui/               # UI primitives (shadcn)
│   └── views/            # View components (List, Calendar, etc.)
├── lib/
│   ├── actions/          # Server actions
│   ├── ai/               # AI integration
│   ├── auth/             # Authentication
│   ├── hooks/            # React hooks
│   ├── query/            # TanStack Query setup
│   ├── supabase/         # Supabase clients
│   ├── utils/            # Utility functions
│   └── validations/      # Zod validation schemas
└── middleware.ts          # Next.js middleware
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Style

- TypeScript strict mode enabled
- No `any` types allowed (ESLint enforced)
- Server Actions for all mutations
- Client components only for interactive UI
- Standardized error handling with `Result<T>` type

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `OPENROUTER_API_KEY` | No | OpenRouter API key for AI features |
| `NEXT_PUBLIC_APP_URL` | No | Application URL (defaults to localhost:3000) |

## Security

- **Row Level Security (RLS)**: All database tables have RLS enabled
- **Input Validation**: Zod schemas validate all user inputs
- **File Upload Validation**: File type and size restrictions
- **Environment Validation**: Environment variables validated on startup
- **Error Boundaries**: React error boundaries catch and handle errors gracefully

## Deployment

### Netlify (Recommended)

1. Connect your repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Add environment variables in Netlify dashboard
5. Deploy!

The app is configured with `output: "standalone"` for optimal deployment.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[Add your license here]

## Support

For issues and questions, please open an issue on GitHub.

## Architecture Overview

### Data Flow

1. **User Action** → Client Component
2. **Mutation Hook** → TanStack Query mutation
3. **Server Action** → Next.js Server Action
4. **Supabase** → Database operation
5. **Realtime** → Broadcast changes
6. **Query Invalidation** → Update UI

### Error Handling

- All server actions return `Result<T>` type
- Errors are caught by error boundaries
- User-facing errors shown via toast notifications
- Errors logged for debugging (Sentry integration recommended)

### Offline Support

- Optimistic updates for immediate UI feedback
- Mutation queue stored in IndexedDB
- Automatic sync when connection restored
- Conflict resolution handled by server

## Roadmap

- [ ] Gantt chart view
- [ ] Advanced reporting and analytics
- [ ] Mobile app (React Native)
- [ ] Webhooks and integrations
- [ ] Advanced AI features
- [ ] Team templates
- [ ] Time tracking
