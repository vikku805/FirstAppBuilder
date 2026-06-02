# FirstAppBuilder

![Adobe App Builder](https://img.shields.io/badge/Adobe-App%20Builder-red)
![Node.js](https://img.shields.io/badge/Node.js-v20-green)
![React](https://img.shields.io/badge/React-Frontend-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Overview

FirstAppBuilder is a sample Adobe App Builder project that demonstrates how to build, deploy, and manage cloud-native applications using Adobe App Builder and Adobe I/O Runtime.

Adobe App Builder enables developers to create scalable, serverless applications that integrate seamlessly with Adobe Experience Cloud products such as Adobe Commerce, Adobe Experience Manager, Adobe Analytics, and Adobe Experience Platform.

This project serves as a starter application for learning Adobe App Builder fundamentals, including authentication, Adobe I/O Runtime actions, Adobe I/O Management APIs, custom services, and deployment workflows.

---

# What is Adobe App Builder?

Adobe App Builder is Adobe's extensibility platform that allows developers to build secure, scalable, event-driven applications without managing infrastructure.

It provides:

- Serverless Runtime Actions
- Adobe I/O Events
- Adobe I/O Management APIs
- Custom UI Extensions
- Secure Authentication
- Event Driven Architecture
- Cloud Native Development

---

# Benefits of Adobe App Builder

### Serverless Architecture

No server management required.

### Faster Development

Rapid development and deployment cycles.

### Adobe Commerce Integration

Extend Adobe Commerce without modifying core code.

### Scalability

Applications automatically scale based on traffic.

### Security

Built-in Adobe authentication and authorization mechanisms.

### Cost Efficient

Pay only for the resources consumed.

### Extensible

Integrates with third-party APIs and enterprise systems.

---

# Tech Stack

- Adobe App Builder
- Adobe I/O Runtime
- Adobe I/O Management API
- Node.js
- NPM
- React
- JavaScript (ES6+)
- Adobe Developer Console
- Postman
- Git & GitHub

---

# Prerequisites

Before starting, install:

- NVM (Node Version Manager)
- Node.js v20
- Git
- Adobe Developer Console Account
- Adobe App Builder Access
- Postman (Optional)

---

# Step 1: Install NVM

Download:

https://github.com/coreybutler/nvm-windows/releases

Install:

```bash
nvm version
```

---

# Step 2: Install Node.js

Install Node 20:

```bash
nvm install 20
```

Use Node 20:

```bash
nvm use 20
```

Verify:

```bash
node -v
```

Expected:

```bash
v20.x.x
```

Verify npm:

```bash
npm -v
```

---

# Step 3: Install Adobe AIO CLI

Install globally:

```bash
npm install -g @adobe/aio-cli
```

Verify:

```bash
aio help
```

Update CLI:

```bash
npm install -g @adobe/aio-cli
```

---

# Step 4: Login to Adobe

Authenticate Adobe account:

```bash
aio login
```

This command:

- Opens Adobe Login page
- Authenticates account
- Generates Adobe CLI credentials

---

# Step 5: Create Adobe App Builder Project

Initialize project:

```bash
aio app init
```

Follow setup wizard:

- Select Organization
- Select Project
- Select Workspace
- Configure Template

After completion:

```bash
cd FirstAppBuilder
```

---

# Step 6: Install Project Dependencies

Install all project dependencies:

```bash
npm install
```

Verify:

```bash
npm list --depth=0
```

If packages are corrupted:

```bash
rmdir /s /q node_modules
del package-lock.json
npm install
```

---

# Step 7: Run Application

Start development server:

```bash
aio app run
```

Application URL:

```text
https://localhost:9080
```

Actions URL:

```text
https://localhost:9080/#/actions
```

---

# Add Adobe Services

Add Adobe services:

```bash
aio app add services
```

This enables:

- Adobe I/O Management API
- Adobe Runtime APIs
- Additional Adobe Services

---

# Generate Public URL

```bash
aio app get-url
```

---

# Authentication Configuration

Update:

```yaml
app.config.yaml
```

Add:

```yaml
require-adobe-auth: true
```

Restart:

```bash
aio app run
```

---

# Adobe I/O Management API Setup

## Add API

1. Open Adobe Developer Console
2. Open App Builder Project
3. Add I/O Management API

## Download Credentials

Download environment variables.

## Configure Postman

Import downloaded variables into Postman Environment.

## Token Endpoint

```text
https://ims-na1.adobelogin.com/ims/token/v3
```

Use cURL or Postman to generate access tokens.

---

# Add Runtime Actions

Generate a new action:

```bash
aio app add action
```

Actions are created inside:

```text
actions/
```

Example:

```javascript
async function main(params) {
  return {
    statusCode: 200,
    body: {
      message: "Hello World"
    }
  };
}

exports.main = main;
```

---

# Adobe Commerce Integration

Reference Starter Kit:

https://github.com/adobe/commerce-integration-starter-kit

OAuth Example:

https://github.com/adobe/commerce-integration-starter-kit/blob/main/actions/oauth1a.js

---

# Logs and Monitoring

Application logs:

```bash
aio app logs
```

Runtime activations:

```bash
aio runtime activation list
```

Activation details:

```bash
aio runtime activation get <activation-id>
```

Activation logs:

```bash
aio runtime activation log <activation-id>
```

---

# Troubleshooting

## Fix SystemRoot Environment Variable

Press:

```text
Win + R
```

Run:

```text
sysdm.cpl
```

Navigate:

```text
Advanced → Environment Variables
```

Add:

Variable Name:

```text
SystemRoot
```

Variable Value:

```text
C:\Windows
```

Restart:

- VS Code
- PowerShell
- CMD

Verify:

```bash
echo %SystemRoot%
```

Expected:

```text
C:\Windows
```

Retry:

```bash
aio app run
```

---

# Clean Reinstallation

Remove dependencies:

```bash
rmdir /s /q node_modules
```

Delete lock file:

```bash
del package-lock.json
```

Install again:

```bash
npm install
```

---

# Useful Commands

### Login

```bash
aio login
```

### Run Application

```bash
aio app run
```

### Deploy Application

```bash
aio app deploy
```

### Get Application URL

```bash
aio app get-url
```

### Add Services

```bash
aio app add services
```

### Add Action

```bash
aio app add action
```

### View Logs

```bash
aio app logs
```

---

# Project Structure

```text
FirstAppBuilder/
│
├── actions/
│   ├── hello/
│   └── commerce/
│
├── web-src/
│
├── extensions/
│
├── app.config.yaml
├── package.json
├── .env
├── README.md
│
└── node_modules/
```

---

# Git Setup

Clone repository:

```bash
git clone https://github.com/vikku805/FirstAppBuilder.git
```

Navigate:

```bash
cd FirstAppBuilder
```

Install dependencies:

```bash
npm install
```

Add remote:

```bash
git remote add origin https://github.com/vikku805/FirstAppBuilder.git
```

Push changes:

```bash
git add .
git commit -m "Initial Commit"
git push -u origin main
```

---

# Screenshots

## Adobe Developer Console

<img width="1918" height="814" alt="image" src="https://github.com/user-attachments/assets/6c9b29d4-7c5f-458d-b497-2592cda50a83" />

---

# Author

**Vikas Gupta**

Senior Adobe Commerce (Magento) Developer

Adobe Certified Professional – Adobe Commerce Developer (Cloud)

GitHub:
https://github.com/vikku805
