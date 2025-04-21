import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './SOS.css';

const SOS = () => {
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latitude, setLatitude] = useState(10.3157);
  const [longitude, setLongitude] = useState(123.8918);
  const [locationStatus, setLocationStatus] = useState('Using default location');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Get user's actual location when component mounts
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setLocationStatus('Location acquired');
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationStatus('Using default location (Cebu)');
        }
      );
    }

    // Cleanup camera stream when component unmounts
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setShowCamera(false);
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (err) {
      setError('Unable to access camera. Please check permissions.');
      console.error('Error accessing camera:', err);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
        setFile(file);
        stopCamera();
      }, 'image/jpeg');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !description.trim()) {
      setError('Please provide both a file and description');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);

    try {
      setIsSubmitting(true);
      setUploadStatus('Sending SOS request...');
      
      const response = await axios.post('http://localhost:3000/api/sos/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadStatus('SOS request sent successfully! Emergency services have been notified.');
      setFile(null);
      setDescription('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error sending SOS request');
      setUploadStatus('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sos-container py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="sos-card p-4 sm:p-6">
          <div className="text-center mb-6">
            <h1 className="sos-title text-2xl sm:text-3xl">Emergency SOS</h1>
            <p className="mt-2 text-sm text-gray-600">Upload media and describe your emergency situation</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Upload Image/Video
              </label>
              
              {showCamera ? (
                <div className="sos-camera-container">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="sos-camera-preview"
                  />
                  <div className="sos-camera-controls">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="sos-camera-button"
                    >
                      Take Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="sos-camera-button sos-camera-button-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="sos-upload-area mt-1 flex justify-center px-6 pt-5 pb-6 rounded-lg">
                  <div className="space-y-1 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="flex flex-col space-y-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="sos-upload-button"
                      >
                        Take Photo
                      </button>
                      <label className="sos-upload-button sos-upload-button-secondary">
                        <span>Choose File</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, MP4 up to 10MB</p>
                  </div>
                </div>
              )}
              
              {file && !showCamera && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {file.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Description of Emergency
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your emergency situation in detail..."
                className="sos-textarea w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
                rows="4"
              />
            </div>

            <div className="sos-location-info rounded-lg p-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm text-blue-700">{locationStatus}</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </p>
            </div>

            {error && (
              <div className="sos-error text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            {uploadStatus && (
              <div className="sos-success text-green-600 px-4 py-3 rounded-lg text-sm">
                {uploadStatus}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="sos-button w-full bg-red-600 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-red-700 transition-colors disabled:bg-red-300"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="sos-spinner -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </span>
              ) : (
                'Send SOS Request'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SOS; 