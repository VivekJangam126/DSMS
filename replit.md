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

### GitHub Import & Security Setup
1. **Security Improvements**:
   - Moved all Firebase and Pinata credentials to Replit Secrets
   - Created backend server (server.js) to serve config securely via /api/config endpoint
   - Updated frontend to fetch credentials from backend instead of hardcoding
   - Added .gitignore to prevent committing sensitive files

2. **Authentication & Firebase**:
   - Login/registration with Firebase authentication working
   - Proper config loading with async initialization
   - All HTML pages load Firebase SDK correctly

3. **Development Workflow**:
   - Node.js server on port 5000 serving static files
   - CORS enabled for API access
   - Cache-control headers for proper development

### Feature Enhancements
4. **Share Page Improvements**:
   - Replaced manual email input with searchable user dropdown
   - Users can search by name or email to select recipients
   - Pre-selects document when redirected from documents page
   - Proper validation prevents empty recipient submissions

5. **Documents Page Update**:
   - Removed inline share modal
   - Share button now redirects to share.html with pre-selected document via URL parameters
   - Cleaner UI with better user flow

6. **Comprehensive Activity Logging**:
   - All user actions logged to Firebase (upload, delete, share, revoke)
   - logs.html displays activity timeline with timestamps
   - Color-coded log types (upload, share, delete, revoke, access)
   - Detailed logging includes file names, sizes, recipients, and IPFS CIDs

7. **Landing Page Redesign**:
   - Modern gradient hero section with call-to-action buttons
   - Feature cards showcasing DSMS capabilities (6 features)
   - "How It Works" section with 3-step guide
   - Professional navigation and footer
   - Responsive design for mobile devices

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

## ⚠️ CRITICAL SECURITY WARNINGS

### Exposed Credentials (HIGH PRIORITY)
**The following credentials are currently hardcoded in `script.js` and publicly visible:**

1. **Firebase API Key**: AIzaSyC4QwcMK93Hp1blRZRH9o9P2n1nLh8nOyg
2. **Pinata JWT Token**: Exposed bearer token for IPFS uploads

**IMMEDIATE ACTIONS REQUIRED:**
- These credentials should be **rotated immediately** if this code has been pushed to a public repository
- Move all credentials to environment variables or a secure backend
- Never commit API keys or secrets to version control
- For production deployment, implement a backend API that handles Pinata uploads server-side

### Recommended Security Improvements
1. **Backend API**: Create a server-side endpoint to handle IPFS uploads
2. **Environment Variables**: Store Firebase config and API keys in Replit Secrets
3. **Firebase Security Rules**: Configure proper database security rules to restrict access
4. **Key Rotation**: Rotate both Firebase and Pinata credentials after moving them to secure storage

## Additional Security Notes
- The Pinata JWT token has an expiration date (expires: 2026-06-04)
- Firebase security rules should be configured to prevent unauthorized access
- Client-side storage of credentials is inherently insecure for production applications

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
