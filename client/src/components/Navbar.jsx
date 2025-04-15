import { Link, useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import './Navbar.css';

const Navbar = ({ user, activePage }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <nav className="navigation">
      <div className="nav-brand">SeguradHomes</div>
      <ul className="nav-links">
        <li>
          <Link 
            to="/home" 
            className={`nav-link ${activePage === 'dashboard' ? 'active' : ''}`}
          >
            Home
          </Link>
        </li>
        
        {user?.role === 'agent' && (
          <li>
            <Link 
              to="/listings" 
              className={`nav-link ${activePage === 'listings' ? 'active' : ''}`}
            >
              My Listings
            </Link>
          </li>
        )}
        
        <li>
          <Link 
            to="/properties" 
            className={`nav-link ${activePage === 'properties' ? 'active' : ''}`}
          >
            Properties
          </Link>
        </li>
        
        <li>
          <Link 
            to="/inquiries" 
            className={`nav-link ${activePage === 'inquiries' ? 'active' : ''}`}
          >
            Inquiries
          </Link>
        </li>
      </ul>
      
      <div className="user-actions">
        <NotificationBell />
        <div className="user-avatar">
          {user?.name?.charAt(0) || 'U'}
        </div>
        <span className="user-name">{user?.name || 'User'}</span>
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;