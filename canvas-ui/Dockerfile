# Use an official Node.js runtime as a parent image
FROM node:20.19.6-bookworm-slim

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \ 
 && sed -i 's|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources || true

# Patch OS packages in builder image
RUN apt-get update && \ 
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create a non-root user to run the app
RUN groupadd --system appuser \ 
 && useradd --system --gid appuser --create-home --home-dir /home/appuser appuser

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Ensure non-root can read the app directory
RUN chown -R appuser:appuser /app

# Drop privileges for runtime
USER appuser

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3001"]