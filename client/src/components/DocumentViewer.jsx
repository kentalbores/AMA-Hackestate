import React, { useState, useEffect } from 'react';
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ChatBox from './ChatBox';
import './DocumentViewer.css';

function DocumentViewer() {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contractId, setContractId] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchDocumentData = async () => {
      try {
        // First try to get document from localStorage
        const storedDoc = localStorage.getItem('viewerDocument');
        
        if (storedDoc) {
          const parsedDoc = JSON.parse(storedDoc);
          console.log('Retrieved document from localStorage:', parsedDoc);
          
          setDocument(parsedDoc);
          setContractId(parsedDoc.contractId);
          localStorage.removeItem('viewerDocument');
          setLoading(false);
          return;
        }
        
        // If not in localStorage, try to extract from URL query params
        const queryParams = new URLSearchParams(location.search);
        const contractIdFromUrl = queryParams.get('contractId');
        
        if (contractIdFromUrl) {
          console.log('Getting document from URL params, contract ID:', contractIdFromUrl);
          const fileUrl = `http://localhost:3000/api/contracts/1/pdf`;
          
          // Verify the file exists
          try {
            await axios.head(fileUrl);
            
            // Create document object
            const documentObj = {
              uri: fileUrl,
              fileName: queryParams.get('fileName') || `Contract-${contractIdFromUrl}.pdf`,
              contractId: contractIdFromUrl
            };
            
            console.log('Created document object from URL params:', documentObj);
            setDocument(documentObj);
            setContractId(contractIdFromUrl);
            setLoading(false);
          } catch (fileError) {
            console.error('Error verifying file exists:', fileError);
            throw new Error(`File does not exist: ${fileUrl}`);
          }
          return;
        }
        
        // If we get here, we couldn't find the document
        throw new Error('No document information found');
      } catch (error) {
        console.error('Error retrieving document information:', error);
        setError(error.message || 'Failed to load document information');
        setLoading(false);
      }
    };

    fetchDocumentData();
  }, [location]);

  const handleBackToChat = () => {
    navigate(-1);
  };

  const handleDownload = async () => {
    if (!document?.uri) {
      setError('No document to download');
      return;
    }

    try {
      window.open(document.uri, '_blank');
    } catch (error) {
      console.error('Error downloading document:', error);
      setError('Failed to download document');
    }
  };

  const tryAgain = () => {
    setLoading(true);
    setError(null);
    const queryParams = new URLSearchParams(location.search);
    const contractIdFromUrl = queryParams.get('contractId');
    
    if (contractIdFromUrl) {
      window.location.reload();
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="document-viewer-container">
        <div className="document-loading">
          <div className="loader"></div>
          <p>Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-viewer-container">
        <div className="document-error">
          <h3>Error</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={handleBackToChat} className="back-button">
              Back to Chat
            </button>
            <button onClick={tryAgain} className="retry-button">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="document-viewer-container">
      <div className="document-header">
        <button onClick={handleBackToChat} className="back-button">
          ← Back to Chat
        </button>
        <h3>{document?.fileName || 'Document'}</h3>
        <button onClick={handleDownload} className="download-button">
          Download
        </button>
      </div>
      <div className="document-content">
        <div className="pdf-container">
          {document && (
            <DocViewer
              documents={[document]}
              pluginRenderers={DocViewerRenderers}
              style={{ height: "100%" }}
              config={{
                header: {
                  disableHeader: false,
                  disableFileName: false,
                },
                pdfZoom: {
                  defaultZoom: 1.1,
                  zoomJump: 0.2,
                },
                pdfVerticalScrollByDefault: true
              }}
            />
          )}
        </div>
        <div className="chat-container">
          <ChatBox currentPdfFile={document} contractId={contractId} />
        </div>
      </div>
    </div>
  );
}

export default DocumentViewer; 