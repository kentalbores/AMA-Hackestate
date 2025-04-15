import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatBox.css';

// Typing indicator component
const TypingIndicator = () => (
  <div className="typing-indicator">
    <span></span>
    <span></span>
    <span></span>
  </div>
);

const ChatBox = ({ currentPdfFile, contractId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const actualContractId = useRef(contractId);
  const inputRef = useRef(null);

  // Update ref when contractId changes
  useEffect(() => {
    actualContractId.current = contractId;
  }, [contractId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Focus input when component loads
  useEffect(() => {
    if (inputRef.current && !isAnalyzing) {
      inputRef.current.focus();
    }
  }, [isAnalyzing]);

  // Load the contract analysis only once when the component mounts
  useEffect(() => {
    // Setup initial message
    setMessages([
      {
        text: "Hello! I'm your Contract Analysis Assistant.",
        sender: 'bot',
        timestamp: new Date()
      }
    ]);

    // Only analyze if contractId and PDF file are available and we haven't analyzed yet
    if (contractId && currentPdfFile && !hasAnalyzed) {
      // Add a delay to prevent simultaneous requests
      const timer = setTimeout(() => {
        analyzeContract();
      }, 500); 
      
      return () => clearTimeout(timer);
    }
  }, []);  // Empty dependency array ensures this runs only once on mount

  const analyzeContract = async () => {
    // Prevent analyzing if we already have or don't have a contract ID
    if (!actualContractId.current || hasAnalyzed || isAnalyzing) {
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      console.log(`Analyzing contract with ID: ${actualContractId.current}`);
      
      // Use the current contract ID value from the ref
      const response = await axios.get(`http://localhost:3000/api/contracts/${actualContractId.current}/analyze`);
      
      setMessages(prevMessages => [
        ...prevMessages,
        {
          text: response.data.analysis,
          sender: 'bot',
          timestamp: new Date()
        }
      ]);
      
      // Mark as analyzed to prevent duplicate requests
      setHasAnalyzed(true);
    } catch (error) {
      console.error('Error analyzing contract:', error);
      setMessages(prevMessages => [
        ...prevMessages,
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
      
      // Show typing indicator
      setIsTyping(true);

      try {
        // Send the user's question to the correct API endpoint
        const response = await axios.post(`http://localhost:3000/api/contracts/analyze`, {
          question: userQuestion,
          context: messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
        });

        // Short delay to make the typing indicator visible
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Hide typing indicator
        setIsTyping(false);

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
        setIsTyping(false);
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

  // Format message text to handle line breaks and links
  const formatMessageText = (text) => {
    // Split text by newlines and map each line
    return text.split('\n').map((line, i) => {
      // Check if line contains a URL
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = line.split(urlRegex);
      
      return (
        <React.Fragment key={i}>
          {parts.map((part, j) => {
            if (part.match(urlRegex)) {
              return (
                <a 
                  key={j} 
                  href={part} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="message-link"
                >
                  {part}
                </a>
              );
            }
            return part;
          })}
          {i < text.split('\n').length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="chat-box">
      <div className="chat-header">
        <h3>
          <span className="ai-icon">🤖</span> 
          Contract Analysis Assistant
        </h3>
        {hasAnalyzed && (
          <div className="contract-info">
            Contract {actualContractId.current}
          </div>
        )}
      </div>
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message bot-message">
            <div className="message-content">
              Loading contract analysis...
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
            >
              <div className="message-content">
                {formatMessageText(message.text)}
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
              <div className="analyzing-spinner"></div>
              Analyzing your contract... Please wait...
            </div>
          </div>
        )}
        {isTyping && (
          <div className="bot-message">
            <div className="message-content typing-content">
              <TypingIndicator /> 
              <span className="typing-text">AI is typing</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="message-input-container">
        <input
          type="text"
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Ask about the contract..."
          className="message-input"
          disabled={isAnalyzing || !currentPdfFile || isTyping}
        />
        <button 
          type="submit" 
          className="send-button" 
          disabled={isAnalyzing || !currentPdfFile || !newMessage.trim() || isTyping}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatBox;