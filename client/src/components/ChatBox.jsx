import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatBox.css';

const ChatBox = ({ currentPdfFile }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [contractId, setContractId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Analyze PDF when a new file is uploaded
  useEffect(() => {
    if (currentPdfFile) {
      analyzeContract();
    }
  }, [currentPdfFile]);

  const analyzeContract = async () => {
    setIsAnalyzing(true);
    try {
      // First, upload the PDF
      const formData = new FormData();
      formData.append('pdf', currentPdfFile);
      
      // Create a temporary contract to store the PDF
      const contractResponse = await axios.post('http://localhost:3000/api/contracts', {
        property_id: 1, // You might want to make this dynamic
        buyer_id: 1,    // You might want to get this from user context
        seller_id: 1,   // You might want to make this dynamic
        status: 'pending',
        contract_detail: 'pending'
      });

      const newContractId = contractResponse.data.id;
      setContractId(newContractId);

      // Upload the PDF
      formData.append('contractId', newContractId);
      await axios.post('http://localhost:3000/api/contracts/upload-pdf', formData);

      // Analyze the contract
      const analysisResponse = await axios.get(`http://localhost:3000/api/contracts/${newContractId}/analyze`);
      
      // Add the analysis to the chat
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
        // Use the stored contractId for the request
        if (!contractId) {
          throw new Error('No contract has been analyzed yet');
        }

        // Send the user's question to the correct API endpoint
        const response = await axios.post(`http://localhost:3000/api/contracts/analyze`, {
          question: userQuestion,
          context: messages
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
        {isAnalyzing && (
          <div className="analyzing-message">
            Analyzing your contract... Please wait...
          </div>
        )}
        {messages.map((message, index) => (
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
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="message-input-container">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Ask about the contract..."
          className="message-input"
          disabled={isAnalyzing}
        />
        <button type="submit" className="send-button" disabled={isAnalyzing}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatBox;