import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatBox.css';

const Text = () => {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');
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

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('contractId', '1');

    try {
      setUploadStatus('Uploading...');
      const response = await axios.post('http://localhost:3000/api/contracts/upload-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setUploadStatus('File uploaded successfully!');
      setFile(null);
      
      // After successful upload, analyze the contract
      analyzeContract();
    } catch (err) {
      setError(err.response?.data?.error || 'Error uploading file');
      setUploadStatus('');
    }
  };

  const analyzeContract = async () => {
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
      const analysisResponse = await axios.get('http://localhost:3000/api/contracts/1/analyze');
      
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
        const response = await axios.post('http://localhost:3000/api/contracts/analyze', {
          question: userQuestion,
          context: messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
        });

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
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Contract Analysis</h2>
        </div>
        <div className="upload-section">
          <h3>Upload Contract</h3>
          <div className="file-input-container">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="file-input"
              id="file-input"
            />
            <label htmlFor="file-input" className="file-label">
              {file ? file.name : 'Choose PDF file'}
            </label>
          </div>
          {error && <p className="error-message">{error}</p>}
          {uploadStatus && <p className="success-message">{uploadStatus}</p>}
          <button
            onClick={handleUpload}
            className="upload-button"
            disabled={!file}
          >
            Upload Contract
          </button>
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-box">
          <div className="messages-container">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`message-wrapper ${message.sender === 'user' ? 'user-wrapper' : 'bot-wrapper'}`}
              >
                <div className="message-avatar">
                  {message.sender === 'user' ? 'U' : 'A'}
                </div>
                <div className="message-content-wrapper">
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
              </div>
            ))}
            {isAnalyzing && (
              <div className="message-wrapper bot-wrapper">
                <div className="message-avatar">A</div>
                <div className="message-content-wrapper">
                  <div className="message-content analyzing">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    Analyzing your contract...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="input-container">
            <form onSubmit={handleSubmit} className="message-form">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Ask about the contract..."
                className="message-input"
                disabled={isAnalyzing}
              />
              <button 
                type="submit" 
                className="send-button"
                disabled={isAnalyzing || !newMessage.trim()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="send-icon">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </form>
            <div className="input-footer">
              Contract Analysis Assistant powered by AI
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Text; 