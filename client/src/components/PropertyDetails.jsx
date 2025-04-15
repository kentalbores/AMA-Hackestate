import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './PropertyDetails.css';
import PropertyInquiryForm from './PropertyInquiryForm';
import Navbar from './Navbar';

const PropertyDetails = () => {
  const [property, setProperty] = useState(null);
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const { id } = useParams();
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
      } catch (error) {
        console.error('Error fetching user data:', error);
        localStorage.removeItem('token');
        navigate('/login');
      }
    };

    const fetchPropertyDetails = async () => {
      try {
        setLoading(true);
        // Fetch property details
        console.log(`Fetching property details for ID: ${id}`);
        const propertyResponse = await axios.get(`http://localhost:3000/api/properties/${id}`);
        console.log('Property API response:', propertyResponse);
        console.log('Property data:', propertyResponse.data);
        setProperty(propertyResponse.data);
        
        // Fetch agent details if property has an agent
        if (propertyResponse.data.agents_id) {
          try {
            console.log(`Fetching agent with ID: ${propertyResponse.data.agents_id}`);
            const agentResponse = await axios.get(`http://localhost:3000/api/agents/${propertyResponse.data.agents_id}`);
            console.log('Agent API response:', agentResponse);
            console.log('Agent data:', agentResponse.data);
            setAgent(agentResponse.data);
          } catch (agentError) {
            console.error('Error fetching agent details:', agentError);
            console.error('Error details:', agentError.response ? agentError.response.data : 'No response data');
            // Create a placeholder agent if api call fails
            setAgent({
              name: 'Agent Information',
              email: 'agent@example.com',
              phone_number: '123-456-7890',
              profile_pic: 'https://via.placeholder.com/150',
              experience: '5 years',
              bio: 'Experienced real estate agent specializing in residential properties.'
            });
          }
        } else {
          console.log('No agent ID found in property data');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching property details:', err);
        console.error('Error details:', err.response ? err.response.data : 'No response data');
        setError('Failed to load property details');
        setLoading(false);
      }
    };

    fetchUserData();
    fetchPropertyDetails();
  }, [id, navigate]);

  const formatPrice = (price) => {
    return '₱' + Number(price).toLocaleString();
  };

  const handleInquiryButtonClick = () => {
    setShowInquiryForm(true);
  };

  const handleInquirySuccess = () => {
    // Handle successful inquiry submission
    setShowInquiryForm(false);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading property details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/properties')}>Back to Properties</button>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="not-found-container">
        <h2>Property Not Found</h2>
        <p>The property you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate('/properties')}>Back to Properties</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar user={user} activePage="properties" />

      <div className="property-details-container">
        <div className="back-link">
          <Link to="/properties">← Back to Properties</Link>
        </div>
        
        <div className="property-details-content">
        <div className="property-header">
          <h1>{property.title}</h1>
        </div>
          
          <div className="property-images">
            <img 
              src={property.image_url?.startsWith('http') ? property.image_url : `http://localhost:3000${property.image_url}`} 
              alt={property.title}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://via.placeholder.com/800x500?text=No+Image';
              }}
            />
          </div>
          <div className="property-header">
            <div className="property-location">
              <i className="location-icon">📍</i> {property.location}
            </div>
            <div className="property-price">{formatPrice(property.price)}</div>
          </div>
          <div className="property-info-grid">
            <div className="property-main-info">
              <div className="info-section">
                <h2>Property Details</h2>
                <div className="info-grid">
                  <div className="info-item">
                    <h3>Property Type</h3>
                    <p>{property.property_type ? property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1) : 'N/A'}</p>
                  </div>
                  <div className="info-item">
                    <h3>Listing Type</h3>
                    <p>{property.listing_type === 'for_sale' ? 'For Sale' : 
                      property.listing_type === 'for_rent' ? 'For Rent' : 'Foreclosure'}</p>
                  </div>
                  <div className="info-item">
                    <h3>Bedrooms</h3>
                    <p>{property.beds || 0}</p>
                  </div>
                  <div className="info-item">
                    <h3>Bathrooms</h3>
                    <p>{property.baths || 0}</p>
                  </div>
                  <div className="info-item">
                    <h3>Land Area</h3>
                    <p>{property.land_area || 0} m²</p>
                  </div>
                  <div className="info-item">
                    <h3>Listed On</h3>
                    <p>{property.created_at ? new Date(property.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
              
              <div className="info-section">
                <h2>Description</h2>
                <p className="property-description">{property.description || 'No description available.'}</p>
              </div>
              
            </div>
            
            <div className="agent-sidebar">
              <div className="agent-card">
                <h2>Listing Agent</h2>
                {agent ? (
                  <>
                    <div className="agent-profile">
                      <div className="agent-image">
                        <img 
                          src={agent.profile_pic || 'https://cdn-icons-png.flaticon.com/512/69/69889.png'} 
                          alt={agent.name || 'Agent'} 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://cdn-icons-png.flaticon.com/512/69/69889.png';
                          }}
                        />
                      </div>
                      <div className="agent-info">
                        <h3>{agent.name || 'Agent'}</h3>
                        <p className="agent-title">Real Estate Agent</p>
                      </div>
                    </div>
                    <div className="agent-contact">
                      <div className="contact-item">
                        <i className="contact-icon">📧</i>
                        <span>{agent.email || 'agent@example.com'}</span>
                      </div>
                      <div className="contact-item">
                        <i className="contact-icon">📱</i>
                        <span>{agent.phone_number || 'N/A'}</span>
                      </div>
                    </div>
                    <button 
                      className="contact-agent-button"
                      onClick={handleInquiryButtonClick}
                    >
                      Contact Agent
                    </button>
                  </>
                ) : (
                  <p>Agent information not available</p>
                )}
              </div>
              
          
            </div>
          </div>
        </div>
      </div>
      
      {showInquiryForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <PropertyInquiryForm 
              propertyId={id}
              propertyTitle={property.title}
              onSuccess={handleInquirySuccess}
              onCancel={() => setShowInquiryForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetails; 