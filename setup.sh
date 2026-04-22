#!/bin/bash

# Education Platform - Quick Start Script
# This script helps you get started quickly

echo "🎓 Education Platform - Quick Start"
echo "===================================="
echo ""

# Check if in correct directory
if [ ! -f "README.md" ]; then
    echo "❌ Error: Please run this script from the education-platform root directory"
    exit 1
fi

# Check prerequisites
echo "📋 Checking prerequisites..."

# Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
else
    echo "✅ Python $(python3 --version | cut -d' ' -f2)"
fi

# Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
else
    echo "✅ Node.js $(node --version)"
fi

echo ""
echo "🔧 Setup Options:"
echo "1. Setup Backend Only"
echo "2. Setup Frontend Only"
echo "3. Setup Both"
echo ""
read -p "Choose option (1-3): " choice

case $choice in
    1|3)
        echo ""
        echo "📦 Setting up Backend..."
        cd backend
        
        # Create virtual environment
        if [ ! -d "venv" ]; then
            echo "Creating virtual environment..."
            python3 -m venv venv
        fi
        
        # Activate virtual environment
        source venv/bin/activate
        
        # Install dependencies
        echo "Installing Python dependencies..."
        pip install -r requirements.txt
        
        # Create .env if not exists
        if [ ! -f ".env" ]; then
            echo "Creating .env file..."
            cp .env.example .env
            echo ""
            echo "⚠️  IMPORTANT: Edit backend/.env with your credentials!"
            echo "   - Supabase URL and keys"
            echo "   - Redis URL"
            echo "   - Claude API key"
            echo ""
        fi
        
        cd ..
        echo "✅ Backend setup complete!"
        ;;
esac

case $choice in
    2|3)
        echo ""
        echo "📦 Setting up Frontend..."
        cd frontend
        
        # Install dependencies
        echo "Installing Node dependencies..."
        npm install
        
        # Create .env if not exists
        if [ ! -f ".env" ]; then
            echo "Creating .env file..."
            cp .env.example .env
        fi
        
        cd ..
        echo "✅ Frontend setup complete!"
        ;;
esac

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo ""

if [ "$choice" = "1" ] || [ "$choice" = "3" ]; then
    echo "1. Edit backend/.env with your credentials"
    echo "2. Start backend:"
    echo "   cd backend"
    echo "   source venv/bin/activate"
    echo "   python -m app.main"
    echo ""
fi

if [ "$choice" = "2" ] || [ "$choice" = "3" ]; then
    echo "3. Start frontend (in another terminal):"
    echo "   cd frontend"
    echo "   npm run dev"
    echo ""
fi

echo "📚 Read DEPLOYMENT_GUIDE.md for detailed instructions"
echo ""
