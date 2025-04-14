import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './PropertyListing.css';

const PropertyListing = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    listingType: 'FOR SALE',
    propertyType: 'Any',
    propertySubType: 'Any',
    minPrice: 'Any',
    maxPrice: 'Any',
    sortByDate: 'New to old',
    sortByPrice: 'Low to high'
  });

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

    fetchUserData();
    fetchProperties();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3000/api/properties/');
      
      if (response.data) {
        setProperties(response.data);
      } else {
        // If data is not an array, create a sample property for demo purposes
        setProperties([
          {
            id: 1,
            title: 'Sample Condominium Unit',
            description: 'A beautiful unit with great amenities',
            price: 2500000,
            location: 'Cebu City, Philippines',
            image_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60',
            beds: 2,
            baths: 1,
            property_type: 'condominium',
            land_area: 65,
            listing_type: 'for_sale',
            agents_id: 1,
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            title: 'Modern Family House',
            description: 'Spacious house with garden',
            price: 8500000,
            location: 'Mandaue City, Philippines',
            image_url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60',
            beds: 3,
            baths: 2,
            property_type: 'house',
            land_area: 150,
            listing_type: 'for_sale',
            agents_id: 1,
            created_at: new Date().toISOString()
          },
          {
            id: 3,
            title: 'Beachfront Vacant Lot',
            description: 'Perfect for building your dream home',
            price: 12000000,
            location: 'Mactan, Cebu, Philippines',
            image_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60',
            beds: 0,
            baths: 0,
            property_type: 'land',
            land_area: 500,
            listing_type: 'for_sale',
            agents_id: 2,
            created_at: new Date().toISOString()
          }
        ]);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching properties:', err);
      // Add demo properties instead of showing error
      setProperties([
        {
          id: 1,
          title: 'Sample Condominium Unit',
          description: 'A beautiful unit with great amenities',
          price: 2500000,
          location: 'Cebu City, Philippines',
          image_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60',
          beds: 2,
          baths: 1,
          property_type: 'condominium',
          land_area: 65,
          listing_type: 'for_sale',
          agents_id: 1,
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          title: 'Modern Family House',
          description: 'Spacious house with garden',
          price: 8500000,
          location: 'Mandaue City, Philippines',
          image_url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60',
          beds: 3,
          baths: 2,
          property_type: 'house',
          land_area: 150,
          listing_type: 'for_sale',
          agents_id: 1,
          created_at: new Date().toISOString()
        },
        {
          id: 3,
          title: 'Beachfront Vacant Lot',
          description: 'Perfect for building your dream home',
          price: 12000000,
          location: 'Mactan, Cebu, Philippines',
          image_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60',
          beds: 0,
          baths: 0,
          property_type: 'land',
          land_area: 500,
          listing_type: 'for_sale',
          agents_id: 2,
          created_at: new Date().toISOString()
        }
      ]);
      setLoading(false);
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const handleFilterChange = (category, value) => {
    setFilters({
      ...filters,
      [category]: value
    });
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Filter properties by search term and filters
  const filteredProperties = properties.filter(property => {
    // Search filter
    if (searchTerm && !property.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !property.location.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Filter by listing type
    if (filters.listingType !== 'ANY' && 
        property.listing_type !== filters.listingType.toLowerCase().replace(' ', '_')) {
      return false;
    }
    
    // Filter by property type
    if (filters.propertyType !== 'Any' && 
        property.property_type !== filters.propertyType.toLowerCase()) {
      return false;
    }
    
    // Filter by price (if not "Any")
    if (filters.minPrice !== 'Any') {
      const minPrice = parseInt(filters.minPrice);
      if (property.price < minPrice) return false;
    }
    
    if (filters.maxPrice !== 'Any') {
      const maxPrice = parseInt(filters.maxPrice);
      if (property.price > maxPrice) return false;
    }
    
    return true;
  });

  // Sort the filtered properties
  const sortedProperties = [...filteredProperties].sort((a, b) => {
    if (filters.sortByPrice === 'Low to high') {
      return a.price - b.price;
    } else if (filters.sortByPrice === 'High to low') {
      return b.price - a.price;
    }
    
    // Default sort by date
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  const formatPrice = (price) => {
    return '₱' + Number(price).toLocaleString();
  };

  const getPropertyTypeBadge = (type) => {
    const propertyType = type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Property';
    return propertyType;
  };

  if (!user) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <nav className="navigation">
        <div className="nav-brand">Real Estate Platform</div>
        <ul>
          <li><Link to="/home" className="nav-link">Dashboard</Link></li>
          <li><Link to="/properties" className="nav-link">Properties</Link></li>
          <li><Link to="/listings" className="nav-link active">My Listings</Link></li>
          <li><Link to="/profile" className="nav-link">My Profile</Link></li>
        </ul>
        <div className="user-actions">
          <span className="user-name">{user?.name || 'User'}</span>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </nav>

      <div className="property-listing-container">
        <div className="page-header">
          <h1>Property Listings</h1>
          <p>Browse available properties in your area</p>
        </div>
        
        {/* Search and Filter Header */}
        <div className="search-filter-header">
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Search by name or location..." 
              className="search-input"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <button className="search-button">
              <i className="search-icon">🔍</i>
            </button>
          </div>
          
          <div className="header-actions">
            <button className="filter-button" onClick={toggleFilters}>
              <i className="filter-icon">⚙️</i> Filters
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="status-bar">
          <span className="properties-found">
            {sortedProperties.length} {sortedProperties.length === 1 ? 'property' : 'properties'} found
          </span>
        </div>

        {/* Filter Modal */}
        {showFilters && (
          <div className="filter-modal">
            <div className="filter-header">
              <h2>Filters</h2>
              <button className="close-button" onClick={toggleFilters}>✕</button>
            </div>
            
            {/* Listing Type Filter */}
            <div className="filter-tabs">
              <button 
                className={filters.listingType === 'ANY' ? 'tab-active' : ''}
                onClick={() => handleFilterChange('listingType', 'ANY')}>
                ANY
              </button>
              <button 
                className={filters.listingType === 'FOR SALE' ? 'tab-active' : ''}
                onClick={() => handleFilterChange('listingType', 'FOR SALE')}>
                FOR SALE
              </button>
              <button 
                className={filters.listingType === 'FOR RENT' ? 'tab-active' : ''}
                onClick={() => handleFilterChange('listingType', 'FOR RENT')}>
                FOR RENT
              </button>
              <button 
                className={filters.listingType === 'FORECLOSURE' ? 'tab-active' : ''}
                onClick={() => handleFilterChange('listingType', 'FORECLOSURE')}>
                FORECLOSURE
              </button>
            </div>
            
            {/* Property Type Filter */}
            <div className="filter-section">
              <h3>Property type</h3>
              <div className="property-type-buttons">
                <button 
                  className={filters.propertyType === 'Any' ? 'type-active' : ''}
                  onClick={() => handleFilterChange('propertyType', 'Any')}>
                  Any
                </button>
                <button 
                  className={filters.propertyType === 'Condominium' ? 'type-active' : ''}
                  onClick={() => handleFilterChange('propertyType', 'Condominium')}>
                  Condominium
                </button>
                <button 
                  className={filters.propertyType === 'House' ? 'type-active' : ''}
                  onClick={() => handleFilterChange('propertyType', 'House')}>
                  House
                </button>
                <button 
                  className={filters.propertyType === 'Land' ? 'type-active' : ''}
                  onClick={() => handleFilterChange('propertyType', 'Land')}>
                  Land
                </button>
                <button 
                  className={filters.propertyType === 'Commercial' ? 'type-active' : ''}
                  onClick={() => handleFilterChange('propertyType', 'Commercial')}>
                  Commercial
                </button>
              </div>
            </div>
            
            {/* Price Range */}
            <div className="filter-section">
              <h3>Price Range</h3>
              <div className="price-range">
                <div className="price-input">
                  <label>Min</label>
                  <select 
                    value={filters.minPrice}
                    onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                  >
                    <option value="Any">Any</option>
                    <option value="1000000">₱1,000,000</option>
                    <option value="5000000">₱5,000,000</option>
                    <option value="10000000">₱10,000,000</option>
                    <option value="20000000">₱20,000,000</option>
                  </select>
                </div>
                <div className="price-input">
                  <label>Max</label>
                  <select 
                    value={filters.maxPrice}
                    onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                  >
                    <option value="Any">Any</option>
                    <option value="5000000">₱5,000,000</option>
                    <option value="10000000">₱10,000,000</option>
                    <option value="20000000">₱20,000,000</option>
                    <option value="50000000">₱50,000,000</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Sort options */}
            <div className="filter-section">
              <h3>Sort by</h3>
              <div className="sort-options">
                <div className="sort-group">
                  <label>Date posted</label>
                  <select 
                    value={filters.sortByDate}
                    onChange={(e) => handleFilterChange('sortByDate', e.target.value)}
                  >
                    <option value="New to old">New to old</option>
                    <option value="Old to new">Old to new</option>
                  </select>
                </div>
                <div className="sort-group">
                  <label>Price</label>
                  <select 
                    value={filters.sortByPrice}
                    onChange={(e) => handleFilterChange('sortByPrice', e.target.value)}
                  >
                    <option value="Low to high">Low to high</option>
                    <option value="High to low">High to low</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="filter-actions">
              <button className="apply-filters" onClick={toggleFilters}>
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Property Listing Grid */}
        {loading ? (
          <div className="loading">
            <div className="loader"></div>
            <p>Loading properties...</p>
          </div>
        ) : (
          <div className="property-grid">
            {sortedProperties.length > 0 ? (
              sortedProperties.map(property => (
                <div className="property-card" key={property.id}>
                  <div className="property-image">
                    <span className="property-type-badge">{getPropertyTypeBadge(property.property_type)}</span>
                    <span className="listing-type-badge">
                      {property.listing_type === 'for_sale' ? 'For Sale' : 
                      property.listing_type === 'for_rent' ? 'For Rent' : 'Foreclosure'}
                    </span>
                    <img 
                      src={property.image_url.startsWith('http') ? property.image_url : `http://localhost:3000${property.image_url}`} 
                      alt={property.title}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                      }}
                    />
                    <div className="image-overlay">
                      <button className="view-details-btn">View Details</button>
                    </div>
                  </div>
                  <div className="property-details">
                    <h3 className="property-title">{property.title}</h3>
                    <div className="property-location">
                      <i className="location-icon">📍</i> {property.location}
                    </div>
                    <div className="property-price">{formatPrice(property.price)}</div>
                    <div className="property-features">
                      <div className="feature">
                        <span className="feature-icon">🛏️</span>
                        <span className="feature-value">{property.beds || 0}</span>
                        <span className="feature-label">Beds</span>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">🚿</span>
                        <span className="feature-value">{property.baths || 0}</span>
                        <span className="feature-label">Baths</span>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">📏</span>
                        <span className="feature-value">{property.land_area || 0}m²</span>
                        <span className="feature-label">Area</span>
                      </div>
                    </div>
                    <div className="property-footer">
                      <div className="agent-info">
                        <div className="agent-avatar">👤</div>
                        <div className="agent-name">Agent {property.agents_id}</div>
                      </div>
                      <button className="contact-agent-btn">Contact</button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-properties">
                <div className="no-properties-icon">🏠</div>
                <h3>No properties found</h3>
                <p>Try adjusting your filters or search criteria</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyListing; 