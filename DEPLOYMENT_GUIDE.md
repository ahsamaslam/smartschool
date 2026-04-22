# 🚀 EDUCATION PLATFORM - COMPLETE DEPLOYMENT GUIDE

## 📦 **What Has Been Built**

### ✅ **Completed Backend (FastAPI)**
- ✅ Database schema (30+ tables)
- ✅ Authentication system
- ✅ Student portal APIs
- ✅ Teacher portal APIs
- ✅ Manager portal APIs
- ✅ Admin portal APIs
- ✅ Quiz generation & grading
- ✅ Q&A bot with caching
- ✅ Video analytics tracking
- ✅ Attendance management
- ✅ Reports & analytics

### 🔨 **Frontend Structure Created**
- ✅ React + Vite + Tailwind setup
- ✅ Package.json with dependencies
- ⚠️ Components need to be built (next phase)

---

## 🎯 **PHASE 1: Local Development Setup**

### **Step 1: Install Prerequisites**

```bash
# Check installations
python --version  # Should be 3.9+
node --version    # Should be 16+
npm --version
git --version
```

### **Step 2: Setup Supabase (Database)**

1. Go to https://supabase.com and sign up
2. Create new project:
   - Name: `education-platform-dev`
   - Database Password: (save this!)
   - Region: Choose closest to you
3. Wait for project creation (~2 minutes)

4. **Run Database Setup:**
   - Go to **SQL Editor** in Supabase dashboard
   - Click "New Query"
   - Copy entire contents of `database/schema.sql`
   - Click "Run"
   - Wait for success ✅

5. **Load Sample Data:**
   - New query
   - Copy contents of `database/seed.sql`
   - Run it ✅

6. **Get Credentials:**
   - Go to **Project Settings > API**
   - Save these values:
     ```
     Project URL: https://xxxxx.supabase.co
     anon key: eyJhbGc...
     service_role key: eyJhbGc... (secret!)
     ```
   - Go to **Project Settings > Database**
   - Connection string:
     ```
     postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres
     ```

### **Step 3: Setup Cloudflare R2 (Video Storage)**

1. Go to https://dash.cloudflare.com
2. Sign up / Log in
3. Navigate to **R2 Object Storage**
4. Click **Create bucket**
   - Name: `education-videos-dev`
   - Location: Automatic
5. Click **Manage R2 API Tokens**
6. **Create API Token:**
   - Name: `education-platform-dev`
   - Permissions: Object Read & Write
   - TTL: Forever (for dev)
   - **Save these:**
     ```
     Access Key ID: xxx
     Secret Access Key: xxx
     Account ID: xxx (from R2 overview)
     ```

### **Step 4: Setup Upstash Redis (Caching)**

1. Go to https://console.upstash.com
2. Sign up / Log in
3. **Create Database:**
   - Name: `education-platform-cache`
   - Type: Regional
   - Region: Choose closest
   - Eviction: allkeys-lru
4. **Get Connection:**
   - Copy the **Redis URL**:
     ```
     redis://default:[password]@[endpoint].upstash.io:6379
     ```

### **Step 5: Get Claude API Key**

1. Go to https://console.anthropic.com
2. Sign up / Log in
3. Go to **API Keys**
4. Click **Create Key**
   - Name: `education-platform-dev`
   - Copy the key: `sk-ant-api03-...`

---

## 💻 **PHASE 2: Backend Setup**

### **Step 1: Setup Backend Environment**

```bash
# Navigate to backend folder
cd education-platform/backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### **Step 2: Configure Environment**

```bash
# Copy example env file
cp .env.example .env

# Edit .env file with your credentials
nano .env  # or use any text editor
```

**Fill in these values in `.env`:**

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres

# Redis
REDIS_URL=redis://default:password@endpoint.upstash.io:6379

# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-xxx

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=education-videos-dev

# JWT Secret (generate random string)
SECRET_KEY=your-super-secret-key-change-this-123456789

# CORS (for development)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### **Step 3: Create User Accounts in Supabase**

Since we're using Supabase Auth, you need to create user accounts:

1. Go to Supabase Dashboard
2. Navigate to **Authentication > Users**
3. Click **Add user** (manually create these):

```
Admin Account:
Email: admin@education.com
Password: Admin@123

Teacher Account:
Email: teacher1@education.com
Password: Teacher@123

Student Account:
Email: student1@education.com
Password: Student@123
```

### **Step 4: Run Backend**

```bash
# Make sure you're in backend folder with venv activated
python -m app.main

# OR use uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Test it:**
- Open browser: http://localhost:8000
- Should see: `{"message": "Education Platform API", ...}`
- API Docs: http://localhost:8000/api/docs

---

## 🎨 **PHASE 3: Frontend Setup**

### **Step 1: Install Dependencies**

```bash
# Navigate to frontend
cd education-platform/frontend

# Install packages
npm install
# or
yarn install
```

### **Step 2: Configure Environment**

```bash
# Copy example
cp .env.example .env

# Edit .env
nano .env
```

**Contents:**
```bash
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=Education Platform
```

### **Step 3: Build Frontend Components**

⚠️ **The React components need to be built!**

I'll create a basic structure now:

```bash
# Frontend structure
frontend/
├── src/
│   ├── components/     # Reusable components
│   ├── pages/          # Page components
│   │   ├── Student/
│   │   ├── Teacher/
│   │   ├── Manager/
│   │   └── Admin/
│   ├── services/       # API calls
│   ├── context/        # State management
│   └── App.jsx         # Main app
```

**I can create these in the next step! Let me know if you want me to continue.**

### **Step 4: Run Frontend**

```bash
# Start development server
npm run dev
# or
yarn dev
```

Frontend will run at: http://localhost:3000

---

## 🧪 **PHASE 4: Testing the System**

### **Test 1: Backend Health**

```bash
# Test database connection
curl http://localhost:8000/api/health/db

# Test Redis cache
curl http://localhost:8000/api/health/cache

# Should return {"status": "healthy"}
```

### **Test 2: Login**

```bash
# Test student login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student1@education.com",
    "password": "Student@123"
  }'
```

### **Test 3: Q&A Bot**

```bash
# Ask a question (replace {token} with login response)
curl -X POST http://localhost:8000/api/qa/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "student_id": "...",
    "video_id": "...",
    "question": "What is a quadratic equation?"
  }'
```

---

## 🚀 **PHASE 5: Production Deployment**

### **Backend Deployment (Railway)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to your project
railway link

# Add environment variables in Railway dashboard
# (Same variables from .env)

# Deploy
railway up
```

**Your API will be at:** `https://your-app.railway.app`

### **Frontend Deployment (Vercel)**

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy from frontend folder
cd frontend
vercel

# Follow prompts
# Set environment variables in Vercel dashboard
```

**Your frontend will be at:** `https://your-app.vercel.app`

---

## 📊 **Cost Tracking (Free Tiers)**

### **Current Usage:**

| Service | Free Tier | Status |
|---------|-----------|--------|
| Supabase | 500MB DB, 1GB storage | ✅ Enough for MVP |
| Cloudflare R2 | 10GB storage | ✅ ~50 videos |
| Upstash Redis | 10K commands/day | ✅ Sufficient |
| Railway | $5 credit/month | ✅ 1 month free |
| Vercel | Unlimited | ✅ Free forever |

### **Claude API Usage Estimate:**
- 100 students × 5 questions/day = 500 questions
- With 80% cache hit rate = 100 API calls/day
- Cost: ~$5-10/month

**Total: $5-10/month for MVP testing!**

---

## 🔧 **Troubleshooting**

### **Backend won't start:**

```bash
# Check Python version
python --version  # Must be 3.9+

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall

# Check database connection
# Try connecting with psql or Supabase SQL editor
```

### **Database errors:**

```bash
# Verify schema loaded
# Go to Supabase > SQL Editor
# Run: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
# Should see 30+ tables
```

### **Frontend build fails:**

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Must be 16+
```

### **API calls fail:**

```bash
# Check CORS settings in backend .env
# Ensure frontend URL is in CORS_ORIGINS

# Check if backend is running
curl http://localhost:8000/health
```

---

## 📝 **Next Steps After Deployment**

1. **Build Frontend Components** (I can do this!)
2. **Video Upload System**
3. **Email Integration**
4. **Avatar Video Processing**
5. **Mobile Responsive Design**
6. **Performance Optimization**
7. **Security Hardening**
8. **Load Testing**
9. **Monitoring Setup**
10. **Documentation**

---

## 🎓 **Default Test Accounts**

```
Admin:
  URL: http://localhost:3000/admin
  Email: admin@education.com
  Password: Admin@123

Teacher:
  URL: http://localhost:3000/teacher
  Email: teacher1@education.com
  Password: Teacher@123

Student:
  URL: http://localhost:3000/student
  Email: student1@education.com
  Password: Student@123
```

---

## 📞 **Need Help?**

- Check logs: `tail -f backend.log`
- Supabase logs: Dashboard > Logs
- Railway logs: Dashboard > Deployments > Logs
- Vercel logs: Dashboard > Deployments > Logs

---

**🎉 You're ready to start developing!**

**Next:** Would you like me to create the React components?
