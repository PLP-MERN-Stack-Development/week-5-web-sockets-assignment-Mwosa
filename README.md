# 🔄 Real-Time Chat Application (Socket.io)

## 📝 Project Overview
This is a full-stack real-time chat application built with Node.js, Express, Socket.io, and React. It demonstrates bidirectional communication between clients and server, supporting live messaging, notifications, online status, private messaging, message reactions, and more. The app is designed for both desktop and mobile use, with a focus on user experience and real-time interactivity.

## 🚀 Setup Instructions

### Prerequisites
- Node.js v18+ installed
- npm (comes with Node.js)

### 1. Clone the Repository
```
git clone <your-repo-url>
cd week-5-web-sockets-assignment-Mwosa
```

### 2. Install Server Dependencies
```
cd server
npm install
```

### 3. Install Client Dependencies
```
cd ../client
npm install
```

### 4. Start the Development Servers
Open two terminals:

**Terminal 1 (Server):**
```
cd server
npm run dev
```

**Terminal 2 (Client):**
```
cd client
npm start
```

- The server runs on [http://localhost:5000](http://localhost:5000)
- The client runs on [http://localhost:3000](http://localhost:3000)

### 5. Open the App
Go to [http://localhost:3000](http://localhost:3000) in your browser. Open multiple tabs or browsers to test real-time features.

---

## ✨ Features Implemented

### Core Features
- **Username-based authentication** (simple join form)
- **Global chat room** for all users
- **Display messages** with sender name and timestamp
- **Typing indicators** ("User is typing...")
- **Online/offline status** (user list updates in real time)

### Advanced Features
- **Private messaging** (click a user to start a private chat)
- **Message reactions** (👍 ❤️ 😂 on any message, real-time updates)
- **Unread message count** (badges for each chat, resets on view)

### Real-Time & UX Enhancements
- **Connection status banner** (shows when disconnected/reconnecting)
- **Responsive design** (works on desktop and mobile)
- **Socket.io reconnection logic** (auto-reconnects, UI feedback)

---

Happy chatting! 🎉 