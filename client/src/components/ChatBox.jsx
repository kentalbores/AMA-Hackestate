import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatBox.css';

const ChatBox = ({ currentPdfFile, contractId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat when component mounts
  useEffect(() => {
    setMessages([
      {
        text: "Hello! I'm your Contract Analysis Assistant. Upload a contract PDF to get started.",
        sender: 'bot',
        timestamp: new Date()
      }
    ]);
  }, []);

  // Analyze contract when a contract ID is available
  useEffect(() => {
    if (contractId && currentPdfFile) {
      analyzeContract();
    }
  }, [contractId, currentPdfFile]);

  const analyzeContract = async () => {
    if (!contractId) return;
    
    setIsAnalyzing(true);
    setMessages(prev => [
      ...prev,
      {
        text: "I'm analyzing your contract. This may take a moment...",
        sender: 'bot',
        timestamp: new Date()
      }
    ]);

    try {
      // Call the analyze endpoint
      const analysisResponse = await axios.get(`http://localhost:3000/api/contracts/1/analyze`);
      
      setMessages(prev => [
        ...prev,
        {
          text: "I've analyzed your contract. Here's what I found:",
          sender: 'bot',
          timestamp: new Date()
        },
        {
          text: analysisResponse.data.analysis,
          sender: 'bot',
          timestamp: new Date()
        }
      ]);
    } catch (error) {
      console.error('Error analyzing contract:', error);
      setMessages(prev => [
        ...prev,
        {
          text: "Sorry, I encountered an error while analyzing the contract. Please try again.",
          sender: 'bot',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      // Add user message
      setMessages(prev => [
        ...prev,
        {
          text: newMessage,
          sender: 'user',
          timestamp: new Date()
        }
      ]);
      
      const userQuestion = newMessage;
      setNewMessage('');

      try {
        // Send the user's question to the correct API endpoint
        const response = await axios.post(`http://localhost:3000/api/contracts/analyze`, {
          question: userQuestion,
          context: messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
        });

        // Add bot response
        setMessages(prev => [
          ...prev,
          {
            text: response.data.answer,
            sender: 'bot',
            timestamp: new Date()
          }
        ]);
      } catch (error) {
        console.error('Error getting response:', error);
        setMessages(prev => [
          ...prev,
          {
            text: "Sorry, I couldn't process your question. Please try again.",
            sender: 'bot',
            timestamp: new Date()
          }
        ]);
      }
    }
  };

  return (
    <div className="chat-box">
      <div className="chat-header">
        <h3>Contract Analysis Assistant</h3>
      </div>
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message bot-message">
            <div className="message-content">
              Hello! I'm your Contract Analysis Assistant. Upload a contract PDF to get started.
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
            >
              <div className="message-content">
                {message.text}
              </div>
              <div className="message-timestamp">
                {new Date(message.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          ))
        )}
        {isAnalyzing && (
          <div className="analyzing-message bot-message">
            <div className="message-content">
              Analyzing your contract... Please wait...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="message-input-container">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Ask about the contract..."
          className="message-input"
          disabled={isAnalyzing || !currentPdfFile}
        />
        <button 
          type="submit" 
          className="send-button" 
          disabled={isAnalyzing || !currentPdfFile}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatBox;