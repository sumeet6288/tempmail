# TempMail SaaS Application

## Overview
This is a temporary email service application that allows users to generate disposable email addresses. Administrators can manage access codes, and users can verify their access codes to create temporary email addresses.

## Tech Stack
- **Frontend**: React with Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB

## Admin Credentials
- **Email**: admin@botsmith.com
- **Password**: admin123

## Features
- Admin panel for managing access codes
- User dashboard for temporary email management
- Access code verification system
- Temporary email generation
- Email message management

## Getting Started

### Prerequisites
- Node.js and Yarn
- Python 3.11+
- MongoDB

### Installation

#### Frontend
```bash
cd /app/frontend
yarn install
```

#### Backend
```bash
cd /app/backend
pip install -r requirements.txt
```

### Running the Application

The application runs using supervisor:
```bash
sudo supervisorctl restart all
```

### Access Points
- Frontend: Available on port 3000
- Backend API: Available on port 8001
- Admin Login: Navigate to `/admin` route
- User Login: Navigate to `/` route

## Application Structure
- `/app/frontend` - React frontend application
- `/app/backend` - FastAPI backend application
- `/app/tests` - Test files

## Environment Variables
- Backend environment variables are stored in `/app/backend/.env`
- Frontend environment variables are stored in `/app/frontend/.env`

## Admin Features
- Generate access codes with custom expiry times
- View all generated access codes
- Revoke/delete access codes
- View statistics (total codes, active codes, used codes, etc.)

## User Features
- Verify access codes to create session
- Generate temporary email addresses
- View received emails
- Read and delete email messages
- Multiple email addresses per session
