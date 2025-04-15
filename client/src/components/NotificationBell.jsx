import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './NotificationBell.css';
import { FaBell, FaEnvelope, FaHome, FaCog, FaBullhorn } from 'react-icons/fa';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);
  const dropdownRef = useRef(null);

  const fetchUnreadCount = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      console.log('Fetching unread notification count...');
      const response = await axios.get('http://localhost:3000/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Unread count response:', response.data);
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      console.log('Fetching notifications...');
      const response = await axios.get('http://localhost:3000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched notifications:', response.data);
      setNotifications(response.data);
      setLastFetched(new Date().toISOString());
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Initial load and periodic refresh
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Fetch data immediately
    fetchUnreadCount();
    fetchNotifications();

    // Set up interval to check for new notifications
    const interval = setInterval(() => {
      fetchUnreadCount();
      if (isOpen) {
        fetchNotifications();
      }
    }, 5000); // Check every 5 seconds to see changes faster

    return () => clearInterval(interval);
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Manual refresh button handler
  const handleRefresh = () => {
    fetchUnreadCount();
    fetchNotifications();
  };

  const handleToggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    axios.post('http://localhost:3000/api/notifications/mark-read', {}, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() => {
        setUnreadCount(0);
        // Update notifications to mark all as read
        setNotifications(prevNotifications => 
          prevNotifications.map(notification => ({
            ...notification,
            is_read: true
          }))
        );
      })
      .catch(error => console.error('Error marking notifications as read:', error));
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <div className="notification-bell" onClick={handleToggleDropdown}>
        <FaBell className="bell-icon" />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </div>
      
      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            <div className="notification-actions">
              {unreadCount > 0 && (
                <button className="mark-read-button" onClick={handleMarkAsRead}>
                  Mark all as read
                </button>
              )}
              <button className="refresh-button" onClick={handleRefresh} title="Refresh notifications">
                ↻
              </button>
            </div>
          </div>
          
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-notifications">
                <p>No notifications yet</p>
                <p className="last-fetched-info">Last checked: {lastFetched ? formatTimeAgo(lastFetched) : 'never'}</p>
              </div>
            ) : (
              <>
                {notifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                  >
                    <div className="notification-icon">
                      {notification.type === 'property_inquiry' ? <FaEnvelope /> : 
                       notification.type === 'property_purchase' ? <FaHome /> : 
                       notification.type === 'system' ? <FaCog /> : <FaBullhorn />}
                    </div>
                    <div className="notification-content">
                      <p className="notification-message">{notification.message}</p>
                      <p className="notification-time">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <p className="last-fetched-info">Last updated: {lastFetched ? formatTimeAgo(lastFetched) : 'never'}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell; 