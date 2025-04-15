import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AgentListings.css';
import Navbar from './Navbar';

const AgentListings = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    location: '',
    beds: '',
    baths: '',
    property_type: 'house',
    land_area: '',
    listing_type: 'for_sale',
    image: null
  });
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
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
        
        // Redirect if not an agent
        if (response.data.role !== 'agent') {
          navigate('/home');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        localStorage.removeItem('token');
        navigate('/login');
      }
    };

    fetchUserData();
    fetchAgentProperties();
  }, [navigate]);

  const fetchAgentProperties = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get('http://localhost:3000/api/properties/agent/my-properties', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data) {
        setProperties(response.data);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching agent properties:', err);
      setProperties([]);
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      title: '',
      description: '',
      price: '',
      location: '',
      beds: '',
      baths: '',
      property_type: 'house',
      land_area: '',
      listing_type: 'for_sale',
      image: null
    });
    setPreviewImage(null);
    setErrorMessage('');
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEditModal = (property) => {
    console.log("Editing property:", property);
    
    // Reset form data and errors before filling with selected property data
    setFormData({
      title: '',
      description: '',
      price: '',
      location: '',
      beds: '',
      baths: '',
      property_type: '',
      land_area: '',
      listing_type: '',
      image: null
    });
    setErrorMessage('');
    setIsEditing(true);
    setSelectedProperty(property);
    
    // Set form data based on the selected property
    setFormData({
      title: property.title || '',
      description: property.description || '',
      price: property.price ? property.price.toString() : '',
      location: property.location || '',
      beds: property.beds ? property.beds.toString() : '',
      baths: property.baths ? property.baths.toString() : '',
      property_type: property.property_type || '',
      land_area: property.land_area ? property.land_area.toString() : '',
      listing_type: property.listing_type || '',
      image: null
    });
    
    // Set preview image if the property has an image
    if (property.image_url) {
      setPreviewImage(property.image_url);
    } else {
      setPreviewImage(null);
    }
    
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedProperty(null);
    setErrorMessage('');
    setPreviewImage(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        image: file
      });

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      // If no file is selected and we're editing, maintain the existing image
      if (isEditing && selectedProperty && selectedProperty.image_url) {
        setPreviewImage(selectedProperty.image_url);
      } else {
        setPreviewImage(null);
      }
    }
  };

  const validateForm = () => {
    // Validate price
    if (parseFloat(formData.price) <= 0) {
      setErrorMessage('Price must be greater than 0');
      return false;
    }

    // Validate bedrooms and bathrooms
    if (parseInt(formData.beds) < 0 || parseInt(formData.baths) < 0) {
      setErrorMessage('Bedrooms and bathrooms count must be positive numbers');
      return false;
    }

    // Validate land area
    if (parseFloat(formData.land_area) <= 0) {
      setErrorMessage('Land area must be greater than 0');
      return false;
    }

    // Validate image
    if (!isEditing && !formData.image) {
      setErrorMessage('Please select an image for the property');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setErrorMessage('');
    
    try {
      const token = localStorage.getItem('token');
      
      // Create form data object for file upload
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('price', formData.price);
      formDataToSend.append('location', formData.location);
      formDataToSend.append('beds', formData.beds);
      formDataToSend.append('baths', formData.baths);
      formDataToSend.append('property_type', formData.property_type);
      formDataToSend.append('land_area', formData.land_area);
      formDataToSend.append('listing_type', formData.listing_type);
      
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }
      
      let response;
      
      if (isEditing && selectedProperty) {
        // Update existing property
        console.log(`Updating property ID: ${selectedProperty.id}`);
        response = await axios.put(
          `http://localhost:3000/api/properties/agent/${selectedProperty.id}`, 
          formDataToSend, 
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            },
          }
        );
        console.log("Update response:", response.data);
      } else {
        // Add new property
        console.log("Adding new property");
        response = await axios.post(
          'http://localhost:3000/api/properties/agent/add', 
          formDataToSend, 
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            },
          }
        );
        console.log("Add response:", response.data);
      }
      
      // Refresh property list
      await fetchAgentProperties();
      closeModal();
    } catch (error) {
      console.error('Error saving property:', error);
      
      // Extract detailed error message
      let errorMsg = 'Failed to save property. Please try again.';
      
      if (error.response) {
        if (error.response.data.details) {
          errorMsg = `${error.response.data.error}: ${error.response.data.details}`;
        } else if (error.response.data.error) {
          errorMsg = error.response.data.error;
        } else if (error.response.status === 413) {
          errorMsg = 'The image file is too large. Please select a smaller image (max 2MB).';
        }
      } else if (error.request) {
        errorMsg = 'Network error. Please check your connection and try again.';
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (propertyId) => {
    if (window.confirm('Are you sure you want to delete this property?')) {
      try {
        const token = localStorage.getItem('token');
        
        await axios.delete(`http://localhost:3000/api/properties/agent/${propertyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        // Refresh property list
        fetchAgentProperties();
      } catch (error) {
        console.error('Error deleting property:', error);
        alert('Failed to delete property. Please try again.');
      }
    }
  };

  const formatPrice = (price) => {
    return '₱' + Number(price).toLocaleString();
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading your listings...</p>
      </div>
    );
  }

  return (
    <div className="agent-listings-container">
      <Navbar user={user} activePage="listings" />

      <div className="listings-header">
        <h1>My Property Listings</h1>
        <button className="add-property-btn" onClick={openAddModal}>
          <i className="add-icon">+</i> Add New Property
        </button>
      </div>

      {properties.length === 0 ? (
        <div className="no-listings">
          <h2>You don't have any listings yet</h2>
          <p>Click the "Add New Property" button to create your first listing.</p>
        </div>
      ) : (
        <div className="property-grid">
          {properties.map(property => (
            <div key={property.id} className="property-card">
              <div className="property-status">
                {property.is_verified === 1 ? (
                  <span className="status verified">Verified</span>
                ) : (
                  <span className="status pending">Pending Verification</span>
                )}
              </div>
              <div className="property-image">
                <img 
                  src={property.image_url?.startsWith('http') ? property.image_url : `http://localhost:3000${property.image_url}`} 
                  alt={property.title}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                  }}
                />
              </div>
              <div className="property-info">
                <h3>{property.title}</h3>
                <p className="property-location">{property.location}</p>
                <p className="property-price">{formatPrice(property.price)}</p>
                <div className="property-details">
                  <span>{property.beds} Beds</span>
                  <span>{property.baths} Baths</span>
                  <span>{property.land_area} m²</span>
                </div>
                <div className="property-type">
                  {property.property_type?.charAt(0).toUpperCase() + property.property_type?.slice(1) || 'Property'}
                </div>
                <div className="listing-type">
                  {property.listing_type === 'for_sale' ? 'For Sale' : 
                   property.listing_type === 'for_rent' ? 'For Rent' : 'Foreclosure'}
                </div>
                <div className="property-actions">
                  <button className="view-btn" onClick={() => navigate(`/property/${property.id}`)}>View</button>
                  <button className="edit-btn" onClick={() => openEditModal(property)}>Edit</button>
                  <button className="delete-btn" onClick={() => handleDelete(property.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="property-modal">
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Property' : 'Add New Property'}</h2>
              <button className="close-modal" onClick={closeModal}>&times;</button>
            </div>
            
            {errorMessage && (
              <div className="error-message">
                <i className="error-icon">⚠️</i> {errorMessage}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="form-tabs">
                <div className={`form-tab ${formData.listing_type === 'for_sale' ? 'active' : ''}`} 
                     onClick={() => handleInputChange({target: {name: 'listing_type', value: 'for_sale'}})}>
                  For Sale
                </div>
                <div className={`form-tab ${formData.listing_type === 'for_rent' ? 'active' : ''}`}
                     onClick={() => handleInputChange({target: {name: 'listing_type', value: 'for_rent'}})}>
                  For Rent
                </div>
                <div className={`form-tab ${formData.listing_type === 'foreclosure' ? 'active' : ''}`}
                     onClick={() => handleInputChange({target: {name: 'listing_type', value: 'foreclosure'}})}>
                  Foreclosure
                </div>
              </div>
            
              <div className="form-sections">
                <div className="form-section">
                  <h3 className="section-title">Basic Information</h3>
                  
                  <div className="form-group">
                    <label htmlFor="title">Property Title</label>
                    <input 
                      type="text" 
                      id="title" 
                      name="title" 
                      value={formData.title} 
                      onChange={handleInputChange} 
                      placeholder="e.g. Beautiful House with Garden"
                      required 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="description">Description</label>
                    <textarea 
                      id="description" 
                      name="description" 
                      value={formData.description} 
                      onChange={handleInputChange} 
                      placeholder="Describe your property in detail"
                      rows={4}
                      required 
                    />
                  </div>
                </div>
                
                <div className="form-section">
                  <h3 className="section-title">Location & Price</h3>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="price">Price (₱)</label>
                      <input 
                        type="number" 
                        id="price" 
                        name="price" 
                        value={formData.price} 
                        onChange={handleInputChange} 
                        placeholder="e.g. 5000000"
                        required 
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="location">Location</label>
                      <input 
                        type="text" 
                        id="location" 
                        name="location" 
                        value={formData.location} 
                        onChange={handleInputChange} 
                        placeholder="e.g. Manila, Philippines"
                        required 
                      />
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h3 className="section-title">Property Details</h3>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="beds">Bedrooms</label>
                      <input 
                        type="number" 
                        id="beds" 
                        name="beds" 
                        value={formData.beds} 
                        onChange={handleInputChange} 
                        min="0" 
                        required 
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="baths">Bathrooms</label>
                      <input 
                        type="number" 
                        id="baths" 
                        name="baths" 
                        value={formData.baths} 
                        onChange={handleInputChange} 
                        min="0" 
                        required 
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="land_area">Land Area (m²)</label>
                      <input 
                        type="number" 
                        id="land_area" 
                        name="land_area" 
                        value={formData.land_area} 
                        onChange={handleInputChange} 
                        min="0" 
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="property_type">Property Type</label>
                    <div className="property-type-options">
                      {["house", "condominium", "apartment", "land", "commercial"].map(type => (
                        <div 
                          key={type}
                          className={`property-type-option ${formData.property_type === type ? 'selected' : ''}`}
                          onClick={() => handleInputChange({target: {name: 'property_type', value: type}})}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h3 className="section-title">Property Image</h3>
                  
                  <div className="image-upload-container">
                    <div className="image-preview">
                      {previewImage ? (
                        <img 
                          src={previewImage} 
                          alt="Property Preview" 
                          className="preview-img"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                          }}
                        />
                      ) : (
                        <div className="no-image">
                          <i className="image-icon">🖼️</i>
                          <p>No image selected</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="image-upload">
                      <label htmlFor="image" className="upload-label">
                        <i className="upload-icon">📷</i>
                        {isEditing ? 'Change Image' : 'Select Image'}
                      </label>
                      <input 
                        type="file" 
                        id="image" 
                        name="image" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        className="file-input"
                        {...(!isEditing && { required: true })}
                      />
                      {isEditing && (
                        <p className="image-note">Leave empty to keep current image</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeModal}>Cancel</button>
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner"></span>
                      {isEditing ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    isEditing ? 'Update Property' : 'Add Property'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentListings; 