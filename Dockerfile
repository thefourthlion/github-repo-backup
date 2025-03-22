FROM node:18-alpine

# Install git
RUN apk add --no-cache git

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Create volume mount point for backups
VOLUME /usr/src/app/backups

# Set environment variables
ENV BACKUP_DIR=/usr/src/app/backups

# Run the app
CMD ["npm", "start"] 