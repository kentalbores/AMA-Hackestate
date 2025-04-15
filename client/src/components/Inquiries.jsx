import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Inquiries.css';
import Navbar from './Navbar';
import InquiryChat from './InquiryChat';

const Inquiries = () => {
  const [user, setUser] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Fetch user data
    const fetchUserData = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(response.data);
        
        // After getting user data, fetch inquiries
        fetchInquiries(response.data);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Error fetching user data. Please try again.');
        setLoading(false);
        localStorage.removeItem('token');
        navigate('/login');
      }
    };

    const fetchInquiries = async (userData) => {
      try {
        setLoading(true);
        console.log('Fetching inquiries for user role:', userData.role);
        const token = localStorage.getItem('token');
        let response;
        
        // Fetch inquiries based on user role
        if (userData.role === 'agent') {
          // Agents see inquiries for their properties
          console.log('Fetching agent inquiries...');
          response = await axios.get('http://localhost:3000/api/inquiries/agent', {
            headers: { Authorization: `Bearer ${token}` },
          });
        } else {
          // Buyers see their sent inquiries
          console.log('Fetching buyer inquiries...');
          response = await axios.get('http://localhost:3000/api/inquiries/buyer', {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        
        console.log('Inquiries loaded:', response.data);
        setInquiries(response.data);
        setError(null); // Clear any previous errors
        setLoading(false);
      } catch (error) {
        console.error('Error fetching inquiries:', error);
        if (error.response) {
          console.error('Error response data:', error.response.data);
          console.error('Error response status:', error.response.status);
          
          // Show detailed error message if available
          const errorMsg = error.response.data.error || error.response.data.message || 'Error loading inquiries';
          const errorDetails = error.response.data.details 
            ? `: ${error.response.data.details}` 
            : '';
          
          setError(`${errorMsg}${errorDetails}`);
        } else if (error.request) {
          // The request was made but no response was received
          console.error('Error request - no response:', error.request);
          setError('Unable to reach the server. Please check your connection and try again.');
        } else {
          // Something happened in setting up the request
          setError(`Request error: ${error.message}`);
        }
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleInquiryClick = (inquiry) => {
    setSelectedInquiry(inquiry);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPropertyImage = (inquiry) => {
    if (!inquiry.property_image_url) return 'https://static.vecteezy.com/system/resources/previews/020/911/740/non_2x/user-profile-icon-profile-avatar-user-icon-male-icon-face-icon-profile-icon-free-png.png';
    
    return inquiry.property_image_url.startsWith('http') 
      ? inquiry.property_image_url 
      : `http://localhost:3000${inquiry.property_image_url}`;
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading inquiries...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar user={user} activePage="inquiries" />
      
      <div className="inquiries-container">
        <h1>Property Inquiries</h1>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="inquiries-content">
          <div className="inquiries-list">
            <h2>{user?.role === 'agent' ? 'Received Inquiries' : 'Your Inquiries'}</h2>
            
            {inquiries.length === 0 ? (
              <div className="no-inquiries">
                <p>No inquiries found.</p>
                {user?.role !== 'agent' && (
                  <p>Browse properties and send an inquiry to start a conversation with an agent.</p>
                )}
              </div>
            ) : (
              <div className="inquiry-items">
                {inquiries.map((inquiry) => (
                  <div 
                    key={inquiry.id} 
                    className={`inquiry-item ${selectedInquiry?.id === inquiry.id ? 'selected' : ''}`}
                    onClick={() => handleInquiryClick(inquiry)}
                  >
                    <div className="inquiry-item-image">
                      <img 
                        src={getPropertyImage(inquiry)} 
                        alt={inquiry.property_title}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://static.vecteezy.com/system/resources/previews/020/911/740/non_2x/user-profile-icon-profile-avatar-user-icon-male-icon-face-icon-profile-icon-free-png.png';
                        }}
                      />
                    </div>
                    <div className="inquiry-item-details">
                      <h3>{inquiry.property_title}</h3>
                      <p className="inquiry-sender">
                        
                      <p className="inquiry-preview">{inquiry.last_message}</p>
                   {user?.role === 'agent' ? `From: ${inquiry.sender_name}` : `To: ${inquiry.agent_name}`}
                      </p>   <p className="inquiry-date">{formatDate(inquiry.created_at)}</p>
                    </div>
                    {inquiry.unread_count > 0 && (
                      <div className="inquiry-badge">{inquiry.unread_count}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="inquiry-chat-container">
            {selectedInquiry ? (
              <InquiryChat 
                inquiry={selectedInquiry} 
                user={user}
                onMessageSent={() => {
                  // Refresh inquiries list after sending a message
                  const token = localStorage.getItem('token');
                  if (token && user) {
                    console.log('Refreshing inquiries after message sent');
                    const endpoint = user.role === 'agent' 
                      ? 'http://localhost:3000/api/inquiries/agent'
                      : 'http://localhost:3000/api/inquiries/buyer';
                      
                    axios.get(endpoint, {
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    .then(response => {
                      console.log('Refreshed inquiries:', response.data);
                      setInquiries(response.data);
                    })
                    .catch(error => {
                      console.error('Error refreshing inquiries after message sent:', error);
                      // Don't show error to user as this is a background refresh
                    });
                  }
                }}
              />
            ) : (
              <div className="select-inquiry-prompt">
                <h3>Select an inquiry to view the conversation</h3>
                <p>Click on an inquiry from the list to see messages and respond.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inquiries; 