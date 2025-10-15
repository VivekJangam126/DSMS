# DSMS - Decentralized Secure Management System

## Overview
DSMS is a decentralized document management system that allows users to securely store, share, and manage documents using blockchain technology and IPFS (InterPlanetary File System). The application provides end-to-end privacy, blockchain audit trails, and instant sharing capabilities.

## Project Architecture

### Tech Stack
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Authentication**: Firebase Authentication
- **Database**: Firebase Realtime Database
- **Storage**: Pinata (IPFS) for decentralized document storage
- **Server**: Node.js http-server for serving static files

### Project Structure
```
.
├── index.html           # Landing page
├── auth.html           # Login/Registration page
├── register.html       # Alternate registration page
├── dashboard.html      # Main dashboard with document summary
├── documents.html      # Document management page
├── share.html          # Document sharing interface
├── settings.html       # User settings
├── logs.html          # Access logs
├── notifications.html  # Notification center
├── script.js          # Main application logic
├── style.css          # Application styles
└── package.json       # Node.js dependencies
```

## Recent Changes (October 15, 2025)

### GitHub Import Setup
1. Added missing authentication handlers to `script.js`:
   - Login form submission with Firebase authentication
   - Registration form with email/password validation
   - Tab switching between login and register forms
   - Logout functionality
   - MetaMask placeholder handlers

2. Fixed Firebase initialization:
   - Added proper type checking for Firebase before initialization
   - Added Firebase scripts to `index.html` to prevent loading errors
   - All HTML pages now properly load Firebase SDK

3. Configured development workflow:
   - Installed `http-server` package via npm
   - Set up workflow to serve static files on port 5000
   - Enabled CORS for proper API access

4. Configured deployment:
   - Set up autoscale deployment for the static website
   - Configured http-server with cache disabled for production

## Features

### Core Functionality
- **User Authentication**: Email/password authentication with Firebase
- **Document Upload**: Upload documents to IPFS via Pinata
- **Document Management**: View, share, revoke, and delete documents
- **Secure Sharing**: Generate secure links with permissions (View-only/Download)
- **Dashboard**: Overview of total documents, active shares, and storage used
- **Decentralized Storage**: All documents stored on IPFS for immutability

### Document Operations
- Upload files (PDF, DOC, DOCX, JPG, PNG) up to 10MB
- View IPFS hash for each document
- Share documents with specific permissions
- Revoke shared document access
- Delete documents (unpins from Pinata IPFS)

## Configuration

### Firebase Configuration
The application uses Firebase for authentication and database storage. The configuration is in `script.js`:
- Project: dsms-c67f6
- Authentication: Email/password enabled
- Database: Realtime Database

### Pinata Configuration
Documents are uploaded to IPFS using Pinata's pinning service. The JWT token is configured in `script.js`.

## Running the Application

### Development
The application runs automatically via the configured workflow:
```bash
npx http-server -p 5000 -a 0.0.0.0 --cors
```

Access the application at the Replit preview URL (port 5000).

### Production Deployment
The application is configured for autoscale deployment using the same http-server setup with cache disabled.

## Security Notes
- Firebase configuration and Pinata JWT are currently hardcoded in `script.js`
- For production use, these should be moved to environment variables
- The Pinata JWT token has an expiration date (configured in the token)

## User Preferences
None configured yet. The project follows standard web development practices.

## Protected Pages
The following pages require authentication:
- `dashboard.html`
- `documents.html`

Unauthenticated users are redirected to `auth.html`.

## Future Enhancements
- Implement MetaMask Web3 authentication (currently placeholder)
- Add proper environment variable management for API keys
- Implement document encryption before IPFS upload
- Add blockchain audit trail functionality
- Complete implementation of logs, notifications, and settings pages
