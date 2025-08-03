# Chat App Backend

## Description
This project is the backend for a chat application that supports video and audio calls using WebRTC and message/file transmission using Socket.IO. The backend is built with Node.js and includes several key services:
- **Signaling Server**: Manages signaling messages to initialize WebRTC connections.
- **Presence Service**: Tracks user presence.
- **Database Communication Service**: Handles communication with the database, including endpoints for various operations.

## Setup Instructions
1. **Clone the Repository**
   ```bash
   git clone https://github.com/tammam-alsoleman/Chat_APP_BACKEND.git
   cd Chat_APP_BACKEND
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory with the following variables:
   ```plaintext
   # Server Configuration
   API_PORT=5000
   JWT_SECRET=your_jwt_secret

   # Database Configuration
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_SERVER=your_db_server
   DB_DATABASE=your_db_database
   DB_PORT=your_db_port
   DB_OPTIONS_ENCRYPT=false
   DB_OPTIONS_TRUST_SERVER_CERTIFICATE=true

4. **Set Up the Database**
   Ensure your database is running and accessible. The `DATABASE_URL` should be configured to point to your database instance. For example, if you are using SQL Server, it might look like this:
   ```plaintext
   DATABASE_URL=mssql://username:password@localhost:1433/database_name
   ```

5. **Start the Server**
   ```bash
   npm start
   ```

## Dependencies
- Node.js
- Express
- Socket.IO
- mssql (for database communication)
- cors
- dotenv
- joi
- jsonwebtoken
- winston

## Contribution Guidelines
1. **Fork the Repository**
2. **Create a New Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make Your Changes**
4. **Commit Your Changes**
   ```bash
   git commit -m "Add your commit message"
   ```
5. **Push to the Branch**
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request**

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
