import React, { useState, useEffect, useRef } from "react";
import socket from "./socket/socket";

const REACTIONS = ["👍", "❤️", "😂"];

function App() {
  const [username, setUsername] = useState("");
  const [inputName, setInputName] = useState("");
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState({}); // { userId: [msg, ...] }
  const [currentChat, setCurrentChat] = useState(null); // null = global, else user object
  const [messageInput, setMessageInput] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef(null);
  const messagesEndRef = useRef(null);
  const [unreadCounts, setUnreadCounts] = useState({ global: 0 }); // { chatId: count }
  const [connectionStatus, setConnectionStatus] = useState("connected"); // 'connected', 'disconnected', 'reconnecting'

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, privateMessages, currentChat]);

  // Socket event listeners
  useEffect(() => {
    // Receive user list
    socket.on("user_list", (userList) => setUsers(userList));

    // Receive new message
    socket.on("receive_message", (msg) => setMessages((prev) => [...prev, msg]));

    // Receive typing users
    socket.on("typing_users", (typingList) => setTypingUsers(typingList));

    // User joined/left notifications (optional)
    socket.on("user_joined", ({ username }) => {
      setMessages((prev) => [
        ...prev,
        { system: true, text: `${username} joined the chat.` },
      ]);
    });
    socket.on("user_left", ({ username }) => {
      setMessages((prev) => [
        ...prev,
        { system: true, text: `${username} left the chat.` },
      ]);
    });

    // Private message receive
    socket.on("private_message", (msg) => {
      setPrivateMessages((prev) => {
        const otherId = msg.senderId === socket.id ? msg.to : msg.senderId;
        const arr = prev[otherId] ? [...prev[otherId]] : [];
        arr.push(msg);
        return { ...prev, [otherId]: arr };
      });
    });

    // Update message (for reactions)
    socket.on("update_message", (updatedMsg) => {
      // Update in global or private messages
      setMessages((prev) =>
        prev.map((msg) => (msg.id === updatedMsg.id ? { ...msg, ...updatedMsg } : msg))
      );
      setPrivateMessages((prev) => {
        const newObj = { ...prev };
        Object.keys(newObj).forEach((uid) => {
          newObj[uid] = newObj[uid].map((msg) =>
            msg.id === updatedMsg.id ? { ...msg, ...updatedMsg } : msg
          );
        });
        return newObj;
      });
    });

    // Fetch initial messages
    fetch("http://localhost:5000/api/messages")
      .then((res) => res.json())
      .then((msgs) => setMessages(msgs));

    // Fetch initial users
    fetch("http://localhost:5000/api/users")
      .then((res) => res.json())
      .then((userList) => setUsers(userList));

    return () => {
      socket.off("user_list");
      socket.off("receive_message");
      socket.off("typing_users");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("private_message");
      socket.off("update_message");
    };
  }, []);

  // Update unread counts on message receive
  useEffect(() => {
    // Global messages
    const handleGlobalMsg = (msg) => {
      if (!currentChat) return; // already in global chat
      setUnreadCounts((prev) => ({ ...prev, global: (prev.global || 0) + 1 }));
    };
    // Private messages
    const handlePrivateMsg = (msg) => {
      const otherId = msg.senderId === socket.id ? msg.to : msg.senderId;
      if (!currentChat || !currentChat.id || currentChat.id !== otherId) {
        setUnreadCounts((prev) => ({ ...prev, [otherId]: (prev[otherId] || 0) + 1 }));
      }
    };
    socket.on("receive_message", handleGlobalMsg);
    socket.on("private_message", handlePrivateMsg);
    return () => {
      socket.off("receive_message", handleGlobalMsg);
      socket.off("private_message", handlePrivateMsg);
    };
  }, [currentChat]);

  // Reset unread count when switching chats
  useEffect(() => {
    if (!currentChat) {
      setUnreadCounts((prev) => ({ ...prev, global: 0 }));
    } else {
      setUnreadCounts((prev) => ({ ...prev, [currentChat.id]: 0 }));
    }
  }, [currentChat]);

  // Handle username submit
  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (inputName.trim()) {
      setUsername(inputName.trim());
      socket.emit("user_join", inputName.trim());
    }
  };

  // Send message (global or private)
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim()) {
      if (!currentChat) {
        // Global chat
        socket.emit("send_message", { message: messageInput });
      } else {
        // Private chat
        socket.emit("private_message", {
          to: currentChat.id,
          message: messageInput,
        });
        // Also add to local privateMessages for immediate feedback
        setPrivateMessages((prev) => {
          const arr = prev[currentChat.id] ? [...prev[currentChat.id]] : [];
          arr.push({
            id: Date.now(),
            sender: username,
            senderId: socket.id,
            to: currentChat.id,
            message: messageInput,
            timestamp: new Date().toISOString(),
            isPrivate: true,
          });
          return { ...prev, [currentChat.id]: arr };
        });
      }
      setMessageInput("");
      setIsTyping(false);
      socket.emit("typing", false);
    }
  };

  // Handle typing
  const handleTyping = (e) => {
    setMessageInput(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", true);
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing", false);
    }, 1000);
  };

  // Select chat (null = global, else user)
  const handleSelectChat = (user) => {
    setCurrentChat(user);
  };

  // Reaction click handler
  const handleReact = (messageId, emoji) => {
    socket.emit("add_reaction", { messageId, emoji });
  };

  useEffect(() => {
    const handleConnect = () => setConnectionStatus("connected");
    const handleDisconnect = () => setConnectionStatus("disconnected");
    const handleReconnect = () => setConnectionStatus("connected");
    const handleReconnectAttempt = () => setConnectionStatus("reconnecting");
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("reconnect", handleReconnect);
    socket.on("reconnect_attempt", handleReconnectAttempt);
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("reconnect", handleReconnect);
      socket.off("reconnect_attempt", handleReconnectAttempt);
    };
  }, []);

  if (!username) {
    return (
      <div style={{ marginTop: 100, textAlign: "center" }}>
        <h2>Enter your username</h2>
        <form onSubmit={handleNameSubmit}>
          <input
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder="Username"
            autoFocus
          />
          <button type="submit">Join</button>
        </form>
      </div>
    );
  }

  // Determine which messages to show
  let chatMessages = [];
  if (!currentChat) {
    chatMessages = messages;
  } else {
    chatMessages = privateMessages[currentChat.id] || [];
  }

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif" }}>
      {/* Connection status banner */}
      {connectionStatus !== "connected" && (
        <div style={{
          background: connectionStatus === "disconnected" ? "#e74c3c" : "#f1c40f",
          color: "#fff",
          padding: "8px 0",
          textAlign: "center",
          fontWeight: "bold",
          marginBottom: 10,
          borderRadius: 4,
        }}>
          {connectionStatus === "disconnected"
            ? "Disconnected. Trying to reconnect..."
            : "Reconnecting..."}
        </div>
      )}
      <h1>Socket.io Chat App</h1>
      <div style={{ display: "flex", gap: 20 }}>
        {/* Users List */}
        <div style={{ minWidth: 180, borderRight: "1px solid #ccc", paddingRight: 10 }}>
          <h3>Chats</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            <li
              style={{
                fontWeight: !currentChat ? "bold" : "normal",
                cursor: "pointer",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
              }}
              onClick={() => handleSelectChat(null)}
            >
              🌐 Global Chat
              {unreadCounts.global > 0 && (
                <span style={{
                  background: "#e74c3c",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "0 7px",
                  fontSize: 12,
                  marginLeft: 6,
                  minWidth: 18,
                  textAlign: "center",
                  display: "inline-block",
                }}>
                  {unreadCounts.global}
                </span>
              )}
            </li>
            {users
              .filter((u) => u.username !== username)
              .map((u) => (
                <li
                  key={u.id}
                  style={{
                    fontWeight: currentChat && currentChat.id === u.id ? "bold" : "normal",
                    cursor: "pointer",
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                  }}
                  onClick={() => handleSelectChat(u)}
                >
                  💬 {u.username}
                  {unreadCounts[u.id] > 0 && (
                    <span style={{
                      background: "#e74c3c",
                      color: "#fff",
                      borderRadius: 12,
                      padding: "0 7px",
                      fontSize: 12,
                      marginLeft: 6,
                      minWidth: 18,
                      textAlign: "center",
                      display: "inline-block",
                    }}>
                      {unreadCounts[u.id]}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </div>
        {/* Chat Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: 500 }}>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              border: "1px solid #ccc",
              padding: 10,
              background: "#fafafa",
              marginBottom: 10,
            }}
          >
            {chatMessages.length === 0 && (
              <div style={{ color: "#888", textAlign: "center" }}>
                No messages yet.
              </div>
            )}
            {chatMessages.map((msg, idx) =>
              msg.system ? (
                <div key={idx} style={{ color: "#888", fontStyle: "italic", textAlign: "center" }}>
                  {msg.text}
                </div>
              ) : (
                <div key={msg.id || idx} style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: "bold" }}>{msg.sender}:</span>{" "}
                  <span>{msg.message}</span>
                  <span style={{ color: "#aaa", fontSize: 12, marginLeft: 8 }}>
                    {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString()}
                    {msg.isPrivate && <span style={{ color: "#e67e22", marginLeft: 4 }}>(private)</span>}
                  </span>
                  {/* Reactions */}
                  <span style={{ marginLeft: 8 }}>
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(msg.id, emoji)}
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          fontSize: 16,
                          marginRight: 2,
                          opacity: 0.7,
                        }}
                        title={`React with ${emoji}`}
                        type="button"
                      >
                        {emoji}
                        {msg.reactions && msg.reactions[emoji] && msg.reactions[emoji].length > 0 && (
                          <span style={{ fontSize: 12, marginLeft: 2 }}>
                            {msg.reactions[emoji].length}
                          </span>
                        )}
                      </button>
                    ))}
                  </span>
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* Typing Indicator (only for global chat) */}
          {!currentChat && (
            <div style={{ minHeight: 24, color: "#888", marginBottom: 4 }}>
              {typingUsers.length > 0 &&
                `${typingUsers.filter((u) => u !== username).join(", ")}${
                  typingUsers.length > 1 ? " are" : " is"
                } typing...`}
            </div>
          )}
          {/* Message Input */}
          <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 8 }}>
            <input
              value={messageInput}
              onChange={handleTyping}
              placeholder={
                currentChat
                  ? `Message @${currentChat.username}...`
                  : "Type a message..."
              }
              style={{ flex: 1, padding: 8 }}
              autoFocus
            />
            <button type="submit" style={{ padding: "8px 16px" }}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;