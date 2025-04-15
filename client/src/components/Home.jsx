import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Home.css';
import Navbar from './Navbar';

const Home = () => {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastActivity = new Date().toLocaleDateString();
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
        <div className="welcome-section">
          <h1>Welcome, {user.name}</h1>
          <p className="last-login">Last login: {lastActivity}</p>
        </div>
        <div className="header-actions">
          <Link to="/profile" className="profile-link">View Profile</Link>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="summary-section">
          <div className="summary-card">
            <h2>System Status</h2>
            <div className="status-indicator online">
              <span className="status-dot"></span>
              <span>System Online</span>
            </div>
            <p className="status-message">All systems operational</p>
          </div>
          
          {user.role === 'agent' && (
            <div className="summary-card">
              <h2>Recent Activity</h2>
              <p className="activity-count">{notifications.length} new notifications</p>
              <div className="activity-summary">
                <div className="activity-item">
                  <span className="activity-icon">📈</span>
                  <span>Dashboard views: 12</span>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">📊</span>
                  <span>Profile completion: 85%</span>
                </div>
              </div>
            </div>
          )}
          
          {user.role === 'admin' && (
            <div className="summary-card">
              <h2>Administration Overview</h2>
              <div className="activity-summary">
                <div className="activity-item">
                  <span className="activity-icon">🔔</span>
                  <span>5 items requiring verification</span>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">🏠</span>
                  <span>2 new properties submitted</span>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">👤</span>
                  <span>3 new agent registrations</span>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">⚠️</span>
                  <span>1 reported listing</span>
                </div>
              </div>
            </div>
          )}
          
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

        {user.role === 'admin' && (
          <section className="admin-verification-section">
            <div className="admin-panel-row">
              <div className="admin-panel">
                <div className="section-header">
                  <h2>Properties Pending Verification</h2>
                  <button onClick={handleRefresh} className="refresh-button" disabled={isLoading}>
                    {isLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="verification-cards">
                  <div className="verification-card">
                    <div className="verification-icon">🏠</div>
                    <div className="verification-details">
                      <h3>Luxury Villa with Ocean View</h3>
                      <p>4 bed, 3 bath • $1,250,000</p>
                      <p className="verification-agent">Listed by: John Smith</p>
                      <p className="verification-date">Submitted: {new Date().toLocaleDateString()}</p>
                      <div className="verification-actions">
                        <button className="verify-button">✓ Verify</button>
                        <button className="reject-button">✕ Reject</button>
                      </div>
                    </div>
                  </div>
                  <div className="verification-card">
                    <div className="verification-icon">🏢</div>
                    <div className="verification-details">
                      <h3>Downtown Penthouse Apartment</h3>
                      <p>2 bed, 2 bath • $850,000</p>
                      <p className="verification-agent">Listed by: Sarah Johnson</p>
                      <p className="verification-date">Submitted: {new Date().toLocaleDateString()}</p>
                      <div className="verification-actions">
                        <button className="verify-button">✓ Verify</button>
                        <button className="reject-button">✕ Reject</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-panel">
                <div className="section-header">
                  <h2>Agents Pending Verification</h2>
                </div>
                <div className="verification-cards">
                  <div className="verification-card">
                    <div className="verification-icon">👤</div>
                    <div className="verification-details">
                      <h3>Michael Rodriguez</h3>
                      <p>License #: CAL-12345678</p>
                      <p>Agency: Prestige Real Estate</p>
                      <p className="verification-date">Registered: {new Date().toLocaleDateString()}</p>
                      <div className="verification-actions">
                        <button className="verify-button">✓ Verify</button>
                        <button className="reject-button">✕ Reject</button>
                      </div>
                    </div>
                  </div>
                  <div className="verification-card">
                    <div className="verification-icon">👤</div>
                    <div className="verification-details">
                      <h3>Jennifer Williams</h3>
                      <p>License #: CAL-87654321</p>
                      <p>Agency: HomeFind Realtors</p>
                      <p className="verification-date">Registered: {new Date().toLocaleDateString()}</p>
                      <div className="verification-actions">
                        <button className="verify-button">✓ Verify</button>
                        <button className="reject-button">✕ Reject</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-stats-row">
              <div className="admin-stat-card">
                <div className="admin-stat-icon">✓</div>
                <div className="admin-stat-details">
                  <h3>15</h3>
                  <p>Properties Verified This Month</p>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon">👤</div>
                <div className="admin-stat-details">
                  <h3>8</h3>
                  <p>Agents Verified This Month</p>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon">⏱️</div>
                <div className="admin-stat-details">
                  <h3>5</h3>
                  <p>Pending Verifications</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="dashboard-info">
          <div className="info-card">
            <h3>Platform Updates</h3>
            <div className="update-item">
              <span className="update-date">May 15, 2023</span>
              <p>New document approval system with QR code functionality</p>
            </div>
            <div className="update-item">
              <span className="update-date">May 1, 2023</span>
              <p>Enhanced messaging system with file attachments</p>
            </div>
          </div>
          
          <div className="info-card">
            {user.role === 'admin' ? (
              <>
                <h3>Admin Resources</h3>
                <ul className="tips-list">
                  <li>Use the verification tools to approve or reject new property listings</li>
                  <li>Verify agent credentials before approving their accounts</li>
                  <li>Check reported listings within 24 hours of submission</li>
                  <li>Access the admin analytics panel for system usage statistics</li>
                </ul>
              </>
            ) : (
              <>
                <h3>Tips & Tricks</h3>
                <ul className="tips-list">
                  <li>Use the document viewer to easily review contracts</li>
                  <li>Enable notifications to stay updated on new inquiries</li>
                  <li>Complete your profile to improve visibility</li>
                </ul>
              </>
            )}
          </div>
          
          {user.role === 'admin' && (
            <div className="info-card">
              <h3>Verification Guidelines</h3>
              <ul className="tips-list">
                <li>Property listings must include clear photos and accurate details</li>
                <li>Agent licenses must be valid and verifiable with local authorities</li>
                <li>Reported content should be reviewed with the content policy guidelines</li>
                <li>All verifications should be completed within 48 hours of submission</li>
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Home;
