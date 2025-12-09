# VoterPulse

A comprehensive political organizing CRM designed to manage large-scale voter outreach campaigns. More powerful than VoteBuilder/VAN with modern architecture and superior usability.

## Features

### 📊 Dashboard & Analytics
- Real-time metrics for voter contacts, doors knocked, and calls made
- Support level distribution tracking
- Canvassing and phone banking progress visualization
- Recent activity feed

### 👥 Voter Management
- Import and manage millions of voter records
- Advanced search and filtering (by district, precinct, party, voting history)
- Individual voter profiles with full history
- Custom fields support for campaign-specific data
- Geocoding and mapping integration

### 📋 List Building
- Create targeted voter lists with powerful filters
- Support canvassing turf cuts and phone bank lists
- List membership tracking
- Export capabilities

### 🚪 Canvassing (Door-to-Door)
- Mobile-optimized walk list interface
- GPS-based navigation between doors
- Real-time sync across volunteers
- Script display with survey questions
- Automatic response recording

### 📞 Phone Banking
- Click-to-call dialing interface
- Call timer and script prompts
- Result disposition tracking
- Volunteer performance metrics

### ✉️ Email Campaigns
- Bulk email sending to voter lists
- Template management with merge fields
- Open and click tracking
- Campaign analytics

### 📝 Script Management
- Create and manage phone/canvass scripts
- Dynamic survey questions
- Response option configuration
- Usage analytics

### 👤 Team Management
- Role-based access control (Admin, Organizer, Volunteer)
- Team member invitations
- Activity logging and auditing

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **TanStack Query** - Server state management
- **Wouter** - Lightweight routing
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - Component library
- **Lucide React** - Icon system
- **Recharts** - Data visualization

### Backend
- **Express.js** - API server
- **TypeScript** - Type safety
- **PostgreSQL** - Primary database
- **Drizzle ORM** - Database toolkit
- **express-session** - Session management
- **Busboy** - File upload streaming

### Authentication
- OIDC-based authentication
- Role-based permissions
- Session management with PostgreSQL store

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mbs4816-create/VoterFile.git
cd VoterFile
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Create PostgreSQL database
createdb voterpulse

# Run migrations
npm run db:push
```

5. Import voter data (optional):
```bash
# Import all 8 congressional districts
npm run import:voters

# Or import specific districts
npm run import:voters -- 1,2,3
```

### Development

Start the development server:
```bash
npm run dev
```

This will start:
- Vite dev server on http://localhost:5173
- Express API server on http://localhost:3000

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
├── client/                # React frontend
│   ├── components/        # Reusable UI components
│   │   ├── layout/        # Layout components
│   │   └── ui/            # Shadcn UI components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   └── pages/             # Page components
├── server/                # Express backend
│   ├── middleware/        # Express middleware
│   └── routes/            # API route handlers
├── shared/                # Shared code
│   ├── schema.ts          # Database schema
│   └── types.ts           # TypeScript types
├── scripts/               # Utility scripts
│   └── import-voters.ts   # Voter file import
└── District*_Unified.csv  # Minnesota voter data files
```

## API Routes

### Authentication
- `GET /api/auth/me` - Get current user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Voters
- `GET /api/voters` - List voters (with filtering)
- `GET /api/voters/:id` - Get voter details
- `PATCH /api/voters/:id` - Update voter
- `GET /api/voters/:id/history` - Get voting history

### Lists
- `GET /api/lists` - List all lists
- `POST /api/lists` - Create list
- `GET /api/lists/:id` - Get list details
- `PATCH /api/lists/:id` - Update list
- `DELETE /api/lists/:id` - Delete list
- `POST /api/lists/:id/voters` - Add voters to list
- `DELETE /api/lists/:id/voters/:voterId` - Remove voter

### Interactions
- `GET /api/interactions` - List interactions
- `POST /api/interactions` - Log new interaction
- `GET /api/voters/:id/interactions` - Get voter interactions

### Scripts
- `GET /api/scripts` - List scripts
- `POST /api/scripts` - Create script
- `PATCH /api/scripts/:id` - Update script
- `DELETE /api/scripts/:id` - Delete script

### Import
- `POST /api/import/preview` - Preview import file
- `POST /api/import/voters` - Import voters

### Dashboard
- `GET /api/dashboard/metrics` - Get dashboard metrics

## Data Sources

This project includes Minnesota state voter files organized by congressional district:
- `District01_Unified.csv` - `District08_Unified.csv`
- Combined voter registration and election history data
- ~3.5 million voter records total

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and feature requests, please use the GitHub issue tracker.
