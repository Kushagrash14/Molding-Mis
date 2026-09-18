# 🚀 PG Electroplast Molding MIS — Complete AWS EC2 + RDS MySQL Deployment Guide

This guide takes you step-by-step from zero to a live production application running on **AWS EC2** with a centralized **AWS RDS (MySQL)** database.

---

## 📋 Architecture
- **Web Server:** Nginx (Port 80/443) -> Serves built React frontend (`dist/`) & reverse proxies `/api/*`
- **API Server:** Node.js Express on port 5000 managed by PM2
- **Database:** AWS RDS MySQL (Port 3306)

---

## Step 1: Create AWS RDS MySQL Database

1. Log in to **AWS Management Console** and navigate to **RDS**.
2. Click **Create database**:
   - Choose **Standard create**.
   - Engine type: **MySQL** (MySQL 8.0).
   - Templates: **Free Tier** (or Production / Dev/Test).
   - DB instance identifier: `molding-mis-db`
   - Master username: `admin`
   - Master password: `YourSecurePassword123!` (keep note of this!)
   - DB instance class: `db.t3.micro` (Free tier eligible) or `db.t4g.micro`.
   - Storage: 20 GiB gp3.
   - Public access: **No** (Secure, only accessible within VPC / EC2) or **Yes** (if you want to test from your laptop).
   - VPC Security Group: Choose or create a new Security Group named `rds-mysql-sg`.
   - Initial database name: `molding_mis_db` (under Additional configuration).
3. Click **Create database** (takes 3–5 minutes).
4. Once created, copy the **Endpoint** (e.g. `molding-mis-db.czxxxxxx.ap-south-1.rds.amazonaws.com`).

---

## Step 2: Create AWS EC2 Instance

1. Navigate to **EC2** in AWS Console.
2. Click **Launch instances**:
   - Name: `molding-mis-server`
   - OS Image: **Ubuntu Server 24.04 LTS** (or 22.04 LTS).
   - Instance type: `t3.small` (Recommended: 2 vCPU, 2GB RAM) or `t2.micro` (Free tier).
   - Key pair: Select your existing key pair or create a new `.pem` key.
   - Network settings:
     - Allow SSH traffic (Port 22) from your IP.
     - Allow HTTP traffic (Port 80) from Anywhere (0.0.0.0/0).
     - Allow HTTPS traffic (Port 443) from Anywhere (0.0.0.0/0).
   - Storage: 20 GB gp3.
3. Click **Launch instance**.

---

## Step 3: Link EC2 to RDS in Security Group

1. Go to **RDS** -> Databases -> Click your database -> Under **Connectivity & security**, click the **VPC security groups** link.
2. Click **Edit inbound rules**.
3. Add rule:
   - Type: **MYSQL/Aurora** (Port 3306)
   - Source: Select your **EC2 Security Group** (or Custom -> EC2 Private IP).
4. Save rules.

---

## Step 4: Setup EC2 Server (SSH)

Connect to your EC2 instance using SSH:
```bash
ssh -i "your-key.pem" ubuntu@<YOUR-EC2-PUBLIC-IP>
```

Run the following commands on your EC2 terminal:

### 1. Update system & install Node.js (v20+), Nginx, and Git:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx

# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Clone the repository:
```bash
sudo git clone https://github.com/Kushagrash14/Molding-Mis.git /var/www/production-oee-tracker
sudo chown -R ubuntu:ubuntu /var/www/production-oee-tracker
cd /var/www/production-oee-tracker
```

### 3. Install dependencies & configure RDS:
```bash
npm install

# Create server .env file
nano server/.env
```

Paste your RDS credentials into `server/.env`:
```env
DB_HOST=molding-mis-db.czxxxxxx.ap-south-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=YourSecurePassword123!
DB_NAME=molding_mis_db
PORT=5000
```
*(Press `Ctrl + O` then `Enter` to save, and `Ctrl + X` to exit)*

### 4. Initialize RDS Database (1-Command Migration & Seeder):
```bash
npm run init-db
```
*This will automatically create all tables and import 1,146 SAP codes and 85 machines into your RDS MySQL!*

### 5. Build React Frontend:
```bash
npm run build
```

### 6. Start Backend API with PM2:
```bash
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 7. Configure Nginx Web Server:
```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/molding-mis
sudo ln -s /etc/nginx/sites-available/molding-mis /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 5: Test Live Application! 🎉

Open your browser and enter your EC2 Public IPv4 address:
```
http://<YOUR-EC2-PUBLIC-IP>
```

- Frontend is live!
- Backend API is running on `http://<YOUR-EC2-PUBLIC-IP>/api/health`
- All production entries are saved straight into AWS RDS MySQL!

---

## 🔄 Future Updates (When you make Git changes):
Whenever you push new code from your laptop:
```bash
ssh -i "your-key.pem" ubuntu@<YOUR-EC2-PUBLIC-IP>
cd /var/www/production-oee-tracker
git pull origin main
npm run build
pm2 restart molding-mis-api
```
