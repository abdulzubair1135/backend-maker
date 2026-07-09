# Build stage
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --only=production

# Bundle app source
COPY . .

# Expose port
EXPOSE 8000

# Start command
CMD [ "node", "server.js" ]
