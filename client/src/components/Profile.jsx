import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Profile.css';

function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: ''
  });
  const [updateStatus, setUpdateStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          navigate('/login');
          return;
        }

        // Using axios instead of fetch for better error handling
        const response = await axios.get('http://localhost:3000/api/users/me', {
          headers: { 
            Authorization: `Bearer ${token}`
          }
        });

        const userData = response.data;
        setUser(userData);
        setFormData({
          name: userData.name,
          email: userData.email,
          phone_number: userData.phone_number
        });
        setLoading(false);
      } catch (err) {
        console.error('Error fetching profile:', err);
        
        if (err.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          setError(`Server error: ${err.response.status} ${err.response.statusText}`);
        } else if (err.request) {
          // The request was made but no response was received
          setError('Could not connect to server. Please check your connection.');
        } else {
          // Something happened in setting up the request that triggered an Error
          setError(err.message);
        }
        
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      // Send the update request but no need to store the response
      await axios.put(`http://localhost:3000/api/users/${user.id}`, {
        name: formData.name,
        email: formData.email,
        phone_number: formData.phone_number,
        role: user.role
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      setUser({
        ...user,
        name: formData.name,
        email: formData.email,
        phone_number: formData.phone_number
      });
      setIsEditing(false);
      setUpdateStatus('Profile updated successfully!');
      
      setTimeout(() => {
        setUpdateStatus(null);
      }, 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      
      if (err.response) {
        setUpdateStatus(`Error: Server returned ${err.response.status} ${err.response.statusText}`);
      } else if (err.request) {
        setUpdateStatus('Error: Could not connect to server');
      } else {
        setUpdateStatus('Error: ' + err.message);
      }
    }
  };

  if (loading) {
    return <div className="profile-container"><div className="loading">Loading profile...</div></div>;
  }

  if (error) {
    return <div className="profile-container"><div className="error">Error: {error}</div></div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h1>My Profile</h1>
        
        {updateStatus && (
          <div className={`update-status ${updateStatus.includes('Error') ? 'error-status' : 'success-status'}`}>
            {updateStatus}
          </div>
        )}
        
        {isEditing ? (
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input 
                type="text" 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="phone_number">Phone</label>
              <input 
                type="tel" 
                id="phone_number" 
                name="phone_number" 
                value={formData.phone_number} 
                onChange={handleChange} 
              />
            </div>
            
            <div className="info-group">
              <label>Role</label>
              <p className="role-badge">{user.role}</p>
              <span className="role-note">(Role cannot be changed)</span>
            </div>
            
            <div className="form-actions">
              <button type="button" className="cancel-button" onClick={() => setIsEditing(false)}>Cancel</button>
              <button type="submit" className="save-button">Save Changes</button>
            </div>
          </form>
        ) : (
          <>
            <div className="profile-info">
              <div className="info-group">
                <label>Name</label>
                <p>{user.name}</p>
              </div>
              <div className="info-group">
                <label>Email</label>
                <p>{user.email}</p>
              </div>
              <div className="info-group">
                <label>Phone</label>
                <p>{user.phone_number}</p>
              </div>
              <div className="info-group">
                <label>Role</label>
                <p className="role-badge">{user.role}</p>
              </div>
            </div>
            <button className="edit-button" onClick={() => setIsEditing(true)}>Edit Profile</button>
          </>
        )}
        
        <div className="profile-actions">
          <button className="back-button" onClick={() => navigate('/home')}>Back to Home</button>
          <button className="logout-button" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </div>
  );
}

export default Profile; 