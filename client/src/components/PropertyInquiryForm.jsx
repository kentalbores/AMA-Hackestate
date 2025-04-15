import { useState, useEffect } from 'react';
import axios from 'axios';
import './PropertyInquiryForm.css';

const PropertyInquiryForm = ({ propertyId, propertyTitle, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    message: `I'm interested in this property "${propertyTitle}" and I'd like to know more details.`
  });
  const [userData, setUserData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('You must be logged in to send an inquiry');
        }
        
        const response = await axios.get('http://localhost:3000/api/users/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('User data fetched:', response.data);
        setUserData(response.data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError(err.response?.data?.error || err.message || 'Failed to fetch user data');
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (!userData) {
      setError('User information not available');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('You must be logged in to send an inquiry');
      }
      
      // For debugging - log the propertyId
      console.log('Property ID type:', typeof propertyId, 'Value:', propertyId);
      
      // Ensure propertyId is a number if it's a string
      const actualPropertyId = typeof propertyId === 'string' ? parseInt(propertyId, 10) : propertyId;
      
      console.log('Using property ID:', actualPropertyId);
      
      // Format the data exactly as expected by the server
      const inquiryData = {
        message: formData.message,
        name: userData.name,
        email: userData.email,
        phone: userData.phone_number || ''
      };
      
      console.log('Sending inquiry data:', inquiryData);
      
      // Check if propertyId is valid
      if (!actualPropertyId || isNaN(actualPropertyId)) {
        console.error('Invalid property ID:', propertyId);
        throw new Error('Invalid property ID');
      }
      
      const response = await axios.post(
        `http://localhost:3000/api/properties/${actualPropertyId}/inquire`,
        inquiryData,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Inquiry response:', response.data);
      setSuccess(true);
      setIsSubmitting(false);
      
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      console.error('Error sending inquiry:', err);
      let errorMessage = 'Failed to send inquiry';
      
      if (err.response) {
        console.error('Response error data:', err.response.data);
        console.error('Response status:', err.response.status);
        errorMessage = err.response.data?.error || errorMessage;
      } else if (err.request) {
        console.error('Request was made but no response received');
        errorMessage = 'No response from server';
      } else {
        console.error('Error message:', err.message);
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="inquiry-form-container success">
        <div className="success-message">
          <i className="success-icon">✓</i>
          <h3>Inquiry Sent!</h3>
          <p>Your message has been sent to the agent. They will contact you soon.</p>
          <button 
            onClick={() => {
              setSuccess(false);
              setFormData({
                message: `I'm interested in this property "${propertyTitle}" and I'd like to know more details.`
              });
              if (onCancel) onCancel();
            }}
            className="close-button"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="inquiry-form-container">
        <div className="inquiry-form-loading">
          <p>Loading your information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inquiry-form-container">
      <div className="inquiry-form-header">
        <h3>Ask about this property</h3>
        {onCancel && (
          <button onClick={onCancel} className="close-form-button">
            ×
          </button>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="inquiry-form">
        {userData && (
          <div className="user-info-summary">
            <p>Sending as: <strong>{userData.name}</strong></p>
            <p>Email: {userData.email}</p>
            {userData.phone_number && <p>Phone: {userData.phone_number}</p>}
          </div>
        )}
        
        <div className="form-row">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={4}
            required
            placeholder="Enter your message to the agent"
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-actions">
          <button 
            type="submit" 
            className="send-inquiry-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send property inquiry'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PropertyInquiryForm; 