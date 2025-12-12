#!/bin/bash

set -e

echo "🚀 Setting up Business Canvas AI..."

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install it first:"
    echo "   npm install -g pnpm"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your Anthropic/OpenAI API keys"
fi

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data

echo ""
echo "✨ Setup complete!"
echo ""
echo "⚠️  Before starting, make sure to:"
echo "   1. Add your ANTHROPIC_API_KEY to .env (required)"
echo "   2. Optionally add your OPENAI_API_KEY to .env"
echo ""
echo "To start the development server:"
echo "   pnpm dev"
echo ""
echo "Then open http://localhost:3000"
