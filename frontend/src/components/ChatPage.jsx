// src/components/ChatPage.jsx

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import API_URL from '../config/api'

export const ChatPage = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI assistant. Ask me anything about Valentin, his projects, skills, or experience.",
      sender: "bot",
    },
  ]);

  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);

    const currentMessage = inputValue;
    setInputValue("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/chat`, {
        message: currentMessage,
        conversationHistory: messages,
      });

      const botMessage = {
        id: Date.now() + 1,
        text: response.data.reply,
        sender: "bot",
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Sorry, something went wrong while connecting to the AI service.",
          sender: "bot",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="chat"
      className="min-h-screen bg-dark-900 text-white flex flex-col items-center justify-center px-4 py-12"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h1 className="text-5xl md:text-6xl font-bold mb-4">AI Assistant</h1>

        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Ask questions about my experience, projects, skills, technologies, or
          anything else you'd like to know.
        </p>
      </motion.div>

      <div className="w-full max-w-3xl h-[550px] bg-dark-800 border border-neon-purple border-opacity-40 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-neon-purple to-neon-pink p-5">
          <h2 className="font-bold text-xl">Portfolio AI Assistant</h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] px-5 py-3 rounded-2xl ${
                  message.sender === "user"
                    ? "bg-neon-purple text-white rounded-br-none"
                    : "bg-dark-700 text-gray-200 rounded-bl-none"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-dark-700 px-5 py-3 rounded-2xl rounded-bl-none">
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-purple animate-bounce"></div>
                  <div
                    className="w-2 h-2 rounded-full bg-neon-purple animate-bounce"
                    style={{ animationDelay: "0.15s" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-neon-purple animate-bounce"
                    style={{ animationDelay: "0.3s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-neon-purple border-opacity-20 p-5 flex gap-3">
          <input
            type="text"
            value={inputValue}
            placeholder="Ask me anything..."
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1 bg-dark-700 rounded-xl px-4 py-3 border border-neon-purple border-opacity-30 focus:outline-none focus:border-opacity-100 text-white"
          />

          <button
            onClick={handleSendMessage}
            disabled={loading || !inputValue.trim()}
            className="bg-neon-purple hover:bg-neon-pink disabled:opacity-50 text-white px-5 rounded-xl transition"
          >
            <Send size={22} />
          </button>
        </div>
      </div>
    </section>
  );
};
