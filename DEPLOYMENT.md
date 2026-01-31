# Prodash Deployment Guide

## Deploying to /prodash on a Server (Alongside Sundial)

### Prerequisites

1. **Node.js** (v18 or higher)
2. **MongoDB** (same instance as sundial)
3. **PM2** (for process management): `npm install -g pm2`

### Setup Steps

#### 1. Navigate to the application directory:
```bash
cd /prodash
```

#### 2. Install dependencies:
```bash
npm install
```

#### 3. Configure environment:
```bash
cp .env.example .env
nano .env  # Edit with your production settings
```

Important production settings:
```env
PORT=3006
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/prodash
```

#### 4. Create logs directory:
```bash
mkdir -p logs
```

#### 5. Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
```

### PM2 Management Commands

```bash
# View status
pm2 status

# View logs (live)
pm2 logs prodash

# Restart application
pm2 restart prodash

# Stop application
pm2 stop prodash
```

### Nginx Configuration

Add this location block to your existing Nginx server config:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # ... existing sundial location ...

    # Prodash location
    location /prodash {
        proxy_pass http://localhost:3006;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support for prodash socket.io
    location /prodash/socket.io {
        proxy_pass http://localhost:3006/prodash/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Running Alongside Sundial

Both apps can coexist on the same server:

- **Sundial**: Port 3005, path `/sundial`, MongoDB database `sundial-invoices`
- **Prodash**: Port 3006, path `/prodash`, MongoDB database `prodash`

They share the same MongoDB instance but use different databases, and are managed by PM2 with different process names.

### Access

Once deployed, access your dashboard at:
- `http://yourdomain.com/prodash`

### Monitoring

```bash
# View both apps
pm2 status

# Monitor resources
pm2 monit

# View prodash logs
pm2 logs prodash --lines 100
```

### Updating

```bash
# Stop the app
pm2 stop prodash

# Pull updates
git pull

# Install dependencies (if updated)
npm install

# Restart
pm2 restart prodash
```

### Troubleshooting

**Application won't start:**
- Check logs: `pm2 logs prodash`
- Verify MongoDB is running: `systemctl status mongod`
- Check port availability: `netstat -tlnp | grep 3006`

**MongoDB connection fails:**
- Verify MONGODB_URI in .env
- Check MongoDB is accessible: `mongosh --eval "db.version()"`

**WebSocket connection issues:**
- Verify Nginx socket.io location block is configured
- Check firewall allows websocket upgrades
