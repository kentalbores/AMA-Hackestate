import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Home.css';
import Navbar from './Navbar';

const Home = () => {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchUserData = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('User data loaded:', response.data);
        setUser(response.data);
      } catch (error) {
        console.error('Error fetching user data:', error);
        localStorage.removeItem('token');
        navigate('/login');
      }
    };

    const fetchNotifications = async () => {
      try {
        console.log('Fetching notifications for dashboard...');
        const response = await axios.get('http://localhost:3000/api/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Notifications received:', response.data);
        setNotifications(response.data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setIsLoading(false);
      }
    };

    fetchUserData()
      .then(() => fetchNotifications())
      .catch(err => {
        console.error('Error in initial data loading:', err);
        setIsLoading(false);
      });

    // Set up a refresh interval for notifications
    const refreshInterval = setInterval(() => {
      fetchNotifications().catch(err => 
        console.error('Error refreshing notifications:', err)
      );
    }, 10000); // Every 10 seconds

    return () => clearInterval(refreshInterval);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleRefresh = () => {
    setIsLoading(true);
    const token = localStorage.getItem('token');
    if (!token) return;

    axios.get('http://localhost:3000/api/notifications', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(response => {
        console.log('Manually refreshed notifications:', response.data);
        setNotifications(response.data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error refreshing notifications:', error);
        setIsLoading(false);
      });
  };

  if (!user) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <Navbar user={user} activePage="dashboard" />

      <header className="dashboard-header">
        <h1>Welcome, {user.name}</h1>
        <div className="header-actions">
          <Link to="/profile" className="profile-link">View Profile</Link>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="stats-grid">
          <div className="stat-card">
            <h2>Active Listings</h2>
            <p>12 Properties</p>
          </div>
          <div className="stat-card">
            <h2>New Leads</h2>
            <p>5 Potential Buyers</p>
          </div>
          <div className="stat-card">
            <h2>Appointments</h2>
            <p>3 Scheduled Viewings</p>
          </div>
        </section>

        {user.role === 'agent' && (
          <section className="recent-notifications">
            <div className="section-header">
              <h2>Recent Inquiries</h2>
              <button onClick={handleRefresh} className="refresh-button" disabled={isLoading}>
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="notification-cards">
              {notifications.length === 0 ? (
                <div className="empty-notification-message">
                  <p>No inquiries yet. They will appear here when buyers send property inquiries.</p>
                </div>
              ) : (
                <>
                  {notifications.slice(0, 3).map(notification => (
                    <div key={notification.id} className="notification-card">
                      <div className="notification-icon">
                        {notification.type === 'property_inquiry' ? '📧' : 
                         notification.type === 'property_purchase' ? '🏠' : 
                         notification.type === 'system' ? '⚙️' : '📢'}
                      </div>
                      <div className="notification-details">
                        <p className="notification-message">{notification.message}</p>
                        <span className="notification-time">
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        )}

        <section className="welcome-message">
          <h2>Real Estate Dashboard</h2>
          <p>Monitor your listings, track buyer inquiries, and manage appointments all in one place.</p>
          <div className="action-buttons">
            <Link to="/properties" className="action-button">Browse Properties</Link>
            {user.role === 'agent' && (
              <Link to="/listings" className="action-button">Manage Listings</Link>
            )}
            <Link to="/profile" className="action-button profile-action">Update Profile</Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
