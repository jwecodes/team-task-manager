# Team Task Manager

A collaborative task management application that allows teams to create projects, assign tasks, track progress, and manage team members through role-based access control.

## Features

### Authentication

* User Registration
* User Login
* Secure Authentication using Supabase Auth

### Project Management

* Create Projects
* Add Team Members
* Role-Based Access (Admin / Member)
* View Assigned Projects

### Task Management

* Create Tasks
* Assign Tasks to Team Members
* Set Priorities
* Set Due Dates
* Update Task Status (To Do, In Progress, Done)

### Dashboard

* Total Tasks Overview
* Tasks by Status
* Tasks per User
* Overdue Tasks Tracking

### Role-Based Access Control

#### Admin

* Manage Projects
* Add/Remove Members
* Create and Assign Tasks
* View All Tasks

#### Member

* View Assigned Tasks
* Update Assigned Task Status

## Tech Stack

* React
* TypeScript
* Vite
* TanStack Router
* Tailwind CSS
* shadcn/ui
* Supabase (Authentication & Database)
* Railway (Deployment)

## Project Structure

```text
src/
├── components/
├── routes/
├── integrations/
│   └── supabase/
├── lib/
├── hooks/
└── styles.css

supabase/
├── migrations/
└── config.toml
```

## Local Setup

### 1. Clone Repository

```bash
git clone <https://github.com/jwecodes/team-task-manager.git>
cd team-task-manager
```

### 2. Install Dependencies

```bash
npm install
```


### 3. Run the Application

```bash
npm run dev
```

Application will start at:

```text
http://localhost:5173
```

## Deployment

The application is deployed on Railway and is publicly accessible.

### Live Application

<https://team-task-manager-production-46cd.up.railway.app/>

## Database

The application uses Supabase PostgreSQL with the following core entities:

* Users
* Projects
* Project Members
* Tasks

## GitHub Repository

Repository Link:

<https://github.com/jwecodes/team-task-manager>

## Author

Bhoomika Jain
