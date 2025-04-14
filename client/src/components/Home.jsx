import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

const Home = () => {
  const [user, setUser] = useState(null);
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
        setUser(response.data);
      } catch (error) {
        console.error('Error fetching user data:', error);
        localStorage.removeItem('token');
        navigate('/login');
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
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
      <nav className="navigation">
        <ul>
          <li><Link to="/home" className="nav-link">Dashboard</Link></li>
          <li><Link to="/listings" className="nav-link">My Listings</Link></li>
          <li><Link to="/leads" className="nav-link">Leads</Link></li>
          <li><Link to="/analytics" className="nav-link">Analytics</Link></li>
        </ul>
      </nav>

      <header className="dashboard-header">
        <h1>Welcome, {user.name}</h1>
        <button onClick={handleLogout} className="logout-button">Logout</button>
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

        <section className="welcome-message">
          <h2>Real Estate Dashboard</h2>
          <p>Monitor your listings, track buyer inquiries, and manage appointments all in one place.</p>
        </section>
      </main>
    </div>
  );
};

export default Home;
