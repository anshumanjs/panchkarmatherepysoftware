# Panchakarma Management Platform - Deployment Guide

## 🚀 Quick Start

This guide will help you deploy the complete Panchakarma Management Platform with Node.js backend and MongoDB database.

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (v4.4 or higher)
- **Git** (for cloning the repository)

## 🛠️ Installation Steps

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install MongoDB (if not already installed)
# On Ubuntu/Debian:
sudo apt-get install mongodb

# On macOS with Homebrew:
brew install mongodb

# On Windows:
# Download from https://www.mongodb.com/try/download/community
```

### 2. Database Setup

```bash
# Start MongoDB service
# On Ubuntu/Debian:
sudo systemctl start mongodb

# On macOS:
brew services start mongodb

# On Windows:
# Start MongoDB service from Services panel

# Initialize database with sample data
node scripts/init-db.js
```

### 3. Environment Configuration

```bash
# Copy environment template
cp env.example .env

# Edit .env file with your configuration
nano .env
```

**Required Environment Variables:**
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://localhost:27017/panchakarma_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 4. Start the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/api/health

## 🔧 Configuration Options

### Database Configuration

**Local MongoDB:**
```env
MONGODB_URI=mongodb://localhost:27017/panchakarma_db
```

**MongoDB Atlas (Cloud):**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/panchakarma_db
```

**MongoDB with Authentication:**
```env
MONGODB_URI=mongodb://username:password@localhost:27017/panchakarma_db
```

### Email Configuration (Optional)

For email notifications, configure SMTP settings:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=PanchakarmaPro <noreply@panchakarmapro.com>
```

### SMS Configuration (Optional)

For SMS notifications, configure Twilio:

```env
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

## 📊 Sample Data

The database initialization script creates sample data including:

**Users:**
- Admin: `admin@panchakarmapro.com` / `admin123`
- Practitioners: `dr.priya@panchakarmapro.com` / `practitioner123`
- Patients: `sarah.johnson@email.com` / `patient123`

**Features:**
- 3 sample practitioners with different specializations
- 3 sample patients with therapy progress
- Sample appointments and feedback
- Sample notifications

## 🌐 Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start server.js --name "panchakarma-api"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
# Build Docker image
docker build -t panchakarma-platform .

# Run container
docker run -p 3000:3000 --env-file .env panchakarma-platform
```

### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/panchakarma_db
    depends_on:
      - mongo

  mongo:
    image: mongo:4.4
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

Run with Docker Compose:

```bash
docker-compose up -d
```

## 🔒 Security Considerations

### 1. Environment Variables
- Never commit `.env` files to version control
- Use strong, unique JWT secrets
- Rotate secrets regularly

### 2. Database Security
- Enable MongoDB authentication
- Use SSL/TLS for database connections
- Regular database backups

### 3. Application Security
- Use HTTPS in production
- Implement rate limiting
- Regular security updates

### 4. CORS Configuration
Update CORS settings in `server.js`:

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

## 📈 Monitoring and Logging

### Health Check Endpoint
```bash
curl http://localhost:3000/api/health
```

### Log Monitoring
```bash
# View PM2 logs
pm2 logs panchakarma-api

# View specific log file
tail -f logs/app.log
```

## 🔄 Backup and Recovery

### Database Backup
```bash
# Create backup
mongodump --db panchakarma_db --out backup/

# Restore backup
mongorestore --db panchakarma_db backup/panchakarma_db/
```

### Application Backup
```bash
# Backup application files
tar -czf panchakarma-backup-$(date +%Y%m%d).tar.gz .
```

## 🐛 Troubleshooting

### Common Issues

**1. MongoDB Connection Error**
```bash
# Check if MongoDB is running
sudo systemctl status mongodb

# Check MongoDB logs
sudo journalctl -u mongodb
```

**2. Port Already in Use**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

**3. Permission Errors**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod -R 755 .
```

**4. Memory Issues**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 server.js
```

## 📞 Support

For technical support or questions:

- **Email**: support@panchakarmapro.com
- **Documentation**: [API Documentation](./API.md)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)

## 🎯 Next Steps

1. **Customize**: Modify the application for your specific needs
2. **Integrate**: Connect with existing healthcare systems
3. **Scale**: Implement load balancing and clustering
4. **Monitor**: Set up comprehensive monitoring and alerting
5. **Backup**: Implement automated backup strategies

---

**Happy Deploying! 🚀**
