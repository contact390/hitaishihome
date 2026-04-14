# Hitaishi Homes - Registration System Setup Guide

## Files Created

### 1. **db.js** - Database Configuration
- Configures SQLite3 database
- Creates `users` table with fields:
  - id (Primary Key)
  - fullName
  - username (Unique)
  - email (Unique)
  - mobile
  - password (hashed)
  - createdAt
  - updatedAt

### 2. **server.js** - Express Server
- Sets up Express.js server on port 5001
- Configures CORS for frontend communication
- Enables JSON body parsing
- Serves static files
- Health check endpoint: `GET /api/health`

### 3. **routes/register.js** - Registration API
- POST endpoint: `/api/properties_re`
- Validates all form inputs:
  - Email format validation
  - Password minimum 6 characters
  - Mobile number 10 digits
  - Password confirmation match
  - Username/Email uniqueness
- Hashes passwords using bcrypt
- Returns appropriate error/success messages

### 4. **Register.html** - Updated Form
- Improved UI with focus/blur effects
- Client-side validation before sending
- Loading spinner while processing
- Error and success message displays
- Better spacing with box-sizing
- All styles are inline CSS

### 5. **package.json** - Dependencies
Required packages:
- express: Web framework
- cors: Cross-origin requests
- body-parser: JSON parsing
- sqlite3: Database
- bcrypt: Password hashing
- nodemon: Development auto-reload

## Setup Instructions

### Step 1: Install Node.js
Download and install from https://nodejs.org/ (LTS version recommended)

### Step 2: Install Dependencies
Open PowerShell in your project directory and run:
```powershell
npm install
```

### Step 3: Start the Server
```powershell
npm start
```

Or for development with auto-reload:
```powershell
npm install -g nodemon
npm run dev
```

The server will run on: `http://localhost:5001`

### Step 4: Access the Application
Open your browser and navigate to:
```
http://localhost:5001/Register.html
```

## API Endpoints

### Register User
**POST** `/api/properties_re`

Request body:
```json
{
  "fullName": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "password": "password123"
}
```

Response (Success):
```json
{
  "success": true,
  "message": "User registered successfully",
  "userId": 1
}
```

Response (Error):
```json
{
  "success": false,
  "message": "Email or username already registered"
}
```

### Health Check
**GET** `/api/health`

Response:
```json
{
  "status": "Server is running",
  "timestamp": "2025-12-01T10:30:00.000Z"
}
```

## Form Validation

### Client-Side (Register.html)
✓ All fields required
✓ Valid email format
✓ Password minimum 6 characters
✓ Password and confirm password match
✓ Mobile number exactly 10 digits

### Server-Side (register.js)
✓ All validations repeated
✓ Username uniqueness check
✓ Email uniqueness check
✓ Password hashing with bcrypt
✓ Error handling and database integrity

## Database File
The SQLite database will be created automatically as `hitaishi.db` in the project root directory.

## Troubleshooting

### Server won't start
- Check if port 5001 is available
- Ensure Node.js is installed: `node --version`
- Reinstall packages: `npm install`

### Database errors
- Delete `hitaishi.db` to reset the database
- Ensure the database file isn't locked

### CORS errors
- The server allows all origins (`origin: '*'`)
- If issues persist, check the browser console for details

### Connection refused
- Make sure server is running on port 5001
- Check firewall settings
- Verify the API URL in Register.html matches server address

## Security Notes

✓ Passwords are hashed using bcrypt
✓ Input validation on both client and server
✓ SQL injection protection via parameterized queries
✓ CORS enabled for cross-origin requests
✓ Error messages don't leak sensitive information

## Next Steps

1. Add login functionality
2. Add email verification
3. Add password reset feature
4. Add user profile management
5. Implement JWT authentication tokens
