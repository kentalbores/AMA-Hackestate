import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './InquiryChat.css';

const InquiryChat = ({ inquiry, user, onMessageSent }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const [propertyDetails, setPropertyDetails] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Scroll to bottom whenever messages change
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Fetch messages for this inquiry
    const fetchMessages = async () => {
      if (!inquiry || !inquiry.id) return;

      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        console.log('Fetching messages for inquiry ID:', inquiry.id);
        
        const response = await axios.get(`http://localhost:3000/api/inquiries/${inquiry.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        console.log('Fetched messages:', response.data);
        setMessages(response.data);
        setError(null); // Clear any previous errors
        setLoading(false);
        
        // Mark messages as read
        try {
          await axios.post(`http://localhost:3000/api/inquiries/${inquiry.id}/mark-read`, {}, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (markReadError) {
          console.error('Error marking messages as read:', markReadError);
          // Don't set the main error state for this, as we already have the messages
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        if (error.response) {
          console.error('Error response data:', error.response.data);
          console.error('Error response status:', error.response.status);
          
          // Show detailed error message if available
          const errorMsg = error.response.data.error || error.response.data.message || 'Could not load messages';
          const errorDetails = error.response.data.details 
            ? `: ${error.response.data.details}` 
            : '';
          
          setError(`${errorMsg}${errorDetails}`);
        } else if (error.request) {
          // The request was made but no response was received
          console.error('Error request:', error.request);
          setError('Unable to reach the server. Please check your connection and try again.');
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error message:', error.message);
          setError(`Request error: ${error.message}`);
        }
        setLoading(false);
      }
    };

    // Fetch property details
    const fetchPropertyDetails = async () => {
      if (!inquiry || !inquiry.property_id) return;

      try {
        const response = await axios.get(`http://localhost:3000/api/properties/${inquiry.property_id}`);
        setPropertyDetails(response.data);
      } catch (error) {
        console.error('Error fetching property details:', error);
      }
    };

    fetchMessages();
    fetchPropertyDetails();
    
    // Set up periodic refresh of messages
    const interval = setInterval(() => {
      fetchMessages();
    }, 5000); // Check for new messages every 5 seconds
    
    return () => clearInterval(interval);
  }, [inquiry]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedFile) {
      await handleFileUpload();
      return;
    }
    
    if (!newMessage.trim()) return;
    
    try {
      const token = localStorage.getItem('token');
      
      // Add the message to the local state immediately for better UX
      const tempMessage = {
        id: 'temp-' + Date.now(),
        inquiry_id: inquiry.id,
        sender_id: user.id,
        sender_name: user.name,
        message: newMessage,
        is_from_agent: user.role === 'agent',
        created_at: new Date().toISOString(),
        is_read: false
      };
      
      // Update UI immediately
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      
      // Send the message to the server
      console.log('Sending message to server for inquiry ID:', inquiry.id);
      const response = await axios.post(`http://localhost:3000/api/inquiries/${inquiry.id}/messages`, {
        message: newMessage
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log('Message sent:', response.data);
      
      // Notify parent component that a message was sent
      if (onMessageSent) onMessageSent();
      
      // Fetch the updated messages in a separate try/catch
      try {
        console.log('Refreshing messages after send');
        const messagesResponse = await axios.get(`http://localhost:3000/api/inquiries/${inquiry.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        setMessages(messagesResponse.data);
      } catch (refreshError) {
        console.error('Error refreshing messages after send:', refreshError);
        // Don't update the error state as the message was still sent successfully
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      setError('Failed to send message. Please try again.');
      
      // Remove the temporary message since the send failed
      setMessages(prev => prev.filter(msg => !msg.id.toString().startsWith('temp-')));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('pdf', selectedFile);
    formData.append('contractId', inquiry.id);

    try {
      // Add a temporary message showing the upload
      const tempFileMessage = {
        id: 'temp-file-' + Date.now(),
        inquiry_id: inquiry.id,
        sender_id: user.id,
        sender_name: user.name,
        message: `Uploading file: ${selectedFile.name}...`,
        is_from_agent: user.role === 'agent',
        created_at: new Date().toISOString(),
        is_read: false
      };
      
      setMessages(prev => [...prev, tempFileMessage]);
      
      // Upload the file
      const uploadResponse = await axios.post(
        'http://localhost:3000/api/contracts/upload-pdf',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log('File uploaded:', uploadResponse.data);

      // Create a message with the file attachment
      const fileMessage = `Shared a file: ${selectedFile.name}`;
      
      // Construct file URL for viewing - use the filePath from the response
      const filePath = uploadResponse.data.filePath || '';
      // Extract just the filename, as the API returns the full path
      const fileName = filePath.split('/').pop();
      
      // The actual URL to access the file will be via the PDF endpoint
      const fileUrl = `http://localhost:3000/api/contracts/${uploadResponse.data.contractId}/pdf`;
      
      console.log('File data:', {
        fileName,
        filePath,
        fileUrl,
        contractId: uploadResponse.data.contractId
      });
      
      // Send a message about the file
      const messageResponse = await axios.post(
        `http://localhost:3000/api/inquiries/${inquiry.id}/messages`,
        {
          message: fileMessage,
          file_url: fileUrl,
          file_name: fileName,
          contract_id: uploadResponse.data.contractId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('File message sent:', messageResponse.data);

      // Reset file state
      setSelectedFile(null);
      
      // Notify parent component that a message was sent
      if (onMessageSent) onMessageSent();
      
      // Refresh messages
      const messagesResponse = await axios.get(
        `http://localhost:3000/api/inquiries/${inquiry.id}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessages(messagesResponse.data);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error.response?.data?.error || 'Failed to upload file. Please try again.');
      
      // Remove the temporary message
      setMessages(prev => prev.filter(msg => !msg.id.toString().startsWith('temp-file-')));
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups = {};
    
    messages.forEach(message => {
      const date = formatDate(message.created_at);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  };

  // Extract file name from URL or message
  const getFileNameFromMessage = (message) => {
    if (message.file_name) {
      return message.file_name;
    }
    
    if (message.file_url) {
      console.log('Extracting filename from URL:', message.file_url);
      const parts = message.file_url.split('/');
      return parts[parts.length - 1];
    }
    
    if (message.message && message.message.startsWith('Shared a file:')) {
      const fileParts = message.message.split(': ');
      if (fileParts.length > 1) {
        return fileParts[1];
      }
    }
    
    return 'Document';
  };

  // Check if a message contains a file
  const isFileMessage = (message) => {
    if (!message) return false;
    
    const hasFileUrl = !!message.file_url;
    const hasFileInfo = !!message.file_name || !!message.contract_id;
    const isSharedFileMessage = message.message && 
      (message.message.toLowerCase().includes('shared a file') || 
       message.message.toLowerCase().includes('file:') || 
       message.message.toLowerCase().includes('.pdf') ||
       message.message.toLowerCase().includes('.doc'));
    
    console.log('Is file message check:', { 
      messageId: message.id, 
      hasFileUrl, 
      hasFileInfo,
      isSharedFileMessage,
      file_url: message.file_url,
      contract_id: message.contract_id,
      message: message.message
    });
    
    return hasFileUrl || hasFileInfo || isSharedFileMessage;
  };

  // Extract file URL from message
  const getFileUrlFromMessage = (message) => {
    console.log('Getting file URL from message:', message);
    
    // Direct file URL in message
    if (message.file_url) {
      console.log('Using direct file_url:', message.file_url);
      return message.file_url;
    }
    
    // If message has contract_id, construct URL
    if (message.contract_id) {
      const contractUrl = `http://localhost:3000/api/contracts/${message.contract_id}/pdf`;
      console.log('Using contract_id to construct URL:', contractUrl);
      return contractUrl;
    }
    
    // Try to extract contract ID from file_url if it follows pattern /api/contracts/:id/pdf
    if (message.file_url && message.file_url.includes('/contracts/')) {
      const matches = message.file_url.match(/\/contracts\/(\d+)\/pdf/);
      if (matches && matches[1]) {
        console.log('Extracted contract ID from URL pattern:', message.file_url);
        return message.file_url;
      }
    }
    
    // Try to extract contract ID from the message ID as fallback
    if (message.id) {
      const fallbackUrl = `http://localhost:3000/api/contracts/${message.id}/pdf`;
      console.log('Using fallback URL with message ID:', fallbackUrl);
      return fallbackUrl;
    }
    
    console.log('No valid file URL found');
    return null;
  };

  // Get contract ID from message
  const getContractIdFromMessage = (message) => {
    if (message.contract_id) {
      return message.contract_id;
    }
    
    if (message.file_url && message.file_url.includes('/contracts/')) {
      const matches = message.file_url.match(/\/contracts\/(\d+)\/pdf/);
      if (matches && matches[1]) {
        return matches[1];
      }
    }
    
    return message.id || inquiry.id;
  };

  // Open document in a separate page
  const openDocumentPage = (message) => {
    console.log('Opening document in new page:', message);
    const fileUrl = getFileUrlFromMessage(message);
    const contractId = getContractIdFromMessage(message);
    const fileName = getFileNameFromMessage(message);
    
    if (!fileUrl) {
      setError('Cannot view file: Missing file URL');
      return;
    }
    
    // Store document information in localStorage to pass to the viewer page
    localStorage.setItem('viewerDocument', JSON.stringify({
      uri: fileUrl,
      fileName: fileName,
      contractId: contractId
    }));
    
    // Also add contract ID to URL query params as fallback
    const queryParams = new URLSearchParams();
    queryParams.append('contractId', contractId);
    queryParams.append('fileName', fileName);
    
    // Navigate to the document viewer page
    window.open(`/document-viewer?${queryParams.toString()}`, '_blank');
  };

  if (loading && messages.length === 0) {
    return (
      <div className="inquiry-chat">
        <div className="chat-loading">
          <div className="loader"></div>
          <p>Loading conversation...</p>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate();

  return (
    <div className="inquiry-chat">
      <div className="chat-header">
        <h3>
          {propertyDetails ? propertyDetails.title : inquiry.property_title}
        </h3>
        <p>
          {user?.role === 'agent' 
            ? `Conversation with ${inquiry.sender_name}` 
            : `Conversation with ${inquiry.agent_name}`}
        </p>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="messages-container">
        {Object.keys(messageGroups).length === 0 ? (
          <div className="no-messages">
            <p>No messages in this conversation yet.</p>
            <p>Send a message to start the conversation.</p>
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, messagesForDate]) => (
            <div key={date} className="message-group">
              <div className="date-divider">
                <span>{date}</span>
              </div>
              
              {messagesForDate.map(message => {
                const isSentByCurrentUser = message.sender_id === user?.id;
                const isFile = isFileMessage(message);
                
                return (
                  <div 
                    key={message.id} 
                    className={`message ${isSentByCurrentUser ? 'sent' : 'received'} ${isFile ? 'file-message' : ''}`}
                  >
                    <div className="message-content">
                      {!isSentByCurrentUser && message.sender_name && (
                        <div className="message-sender">
                          From: {message.sender_name || 'Unknown user'}
                        </div>
                      )}
                      
                      {isFile ? (
                        <div className="file-attachment-wrapper">
                          <div 
                            className="file-attachment"
                            onClick={() => {
                              console.log('File attachment clicked', message);
                              openDocumentPage(message);
                            }}
                            style={{ cursor: 'pointer' }}
                            title="Click to view document"
                          >
                            <div className="file-icon">📄</div>
                            <div className="file-details">
                              <p>{getFileNameFromMessage(message)}</p>
                              <span className="file-action">Click to view in document viewer</span>
                            </div>
                          </div>
                          <div className="file-actions">
                            <button 
                              className="file-download-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const fileUrl = getFileUrlFromMessage(message);
                                if (fileUrl) {
                                  window.open(fileUrl, '_blank');
                                } else {
                                  setError('Cannot download file: Missing file URL');
                                }
                              }}
                              title="Download file"
                            >
                              📥
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p>{message.message}</p>
                      )}
                      
                      <span className="message-time">{formatTime(message.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="message-input-form">
        <div className="file-upload-container">
          {selectedFile ? (
            <div className="selected-file">
              <span>{selectedFile.name}</span>
              <button 
                type="button" 
                className="remove-file-btn"
                onClick={() => setSelectedFile(null)}
              >
                ✕
              </button>
            </div>
          ) : (
            <button 
              type="button" 
              className="file-button" 
              onClick={() => fileInputRef.current.click()}
              disabled={uploading}
            >
              📎
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.txt"
          />
        </div>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={selectedFile ? "Send with file..." : "Type your message..."}
          className="message-input"
          disabled={uploading}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={uploading || (!newMessage.trim() && !selectedFile)}
        >
          {uploading ? "Uploading..." : "Send"}
        </button>
      </form>
    </div>
  );
};

export default InquiryChat; 