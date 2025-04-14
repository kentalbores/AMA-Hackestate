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
    <div className="container mx-auto p-4 flex gap-4">
      <div className="w-1/2">
        <h1 className="text-2xl font-bold mb-4">Upload Contract</h1>
        <div className="max-w-md">
          <div className="mb-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {uploadStatus && <p className="text-green-500 mb-4">{uploadStatus}</p>}
          <button
            onClick={handleUpload}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Upload
          </button>
        </div>
      </div>

      <div className="w-1/2">
        <div className="chat-box">
          <div className="chat-header">
            <h3>Contract Analysis Assistant</h3>
          </div>
          <div className="messages-container">
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
              disabled={isAnalyzing}
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={isAnalyzing}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Text; 