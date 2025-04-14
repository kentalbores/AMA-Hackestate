import React, { useState, useRef } from 'react';
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { PDFDocument } from 'pdf-lib';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import ChatBox from './ChatBox';
import './PDFViewer.css';

function PDFViewer() {
  const [docs, setDocs] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [contractId, setContractId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const qrRef = useRef(null);
  
  // QR Code value - you can customize this
  const qrValue = "Your QR Code Value Here";

  const calculateQRPosition = (page, qrDims) => {
    // Get page dimensions
    const { width: pageWidth, height: pageHeight } = page.getSize();
    
    // Define margins (in points)
    const margin = 20;
    
    // Calculate positions for different corners
    const positions = {
      topRight: {
        x: pageWidth - qrDims.width - margin,
        y: pageHeight - qrDims.height - margin
      },
      topLeft: {
        x: margin,
        y: pageHeight - qrDims.height - margin
      },
      bottomRight: {
        x: pageWidth - qrDims.width - margin,
        y: margin
      },
      bottomLeft: {
        x: margin,
        y: margin
      },
      center: {
        x: (pageWidth - qrDims.width) / 2,
        y: (pageHeight - qrDims.height) / 2
      }
    };

    return positions.topRight;
  };

  // Create a contract in the database
  const createContract = async () => {
    try {
      // Looking at your database schema, we need to adjust the fields
      const contractResponse = await axios.post('http://localhost:3000/api/contracts', {
        property_id: 1,           // Required by the schema
        tenant_id: 1,             // Required by the schema (changed from buyer_id)
        start_date: new Date().toISOString().split('T')[0], // Required by the schema
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], // Required by the schema
        monthly_rent: 1000,       // Required by the schema
        status: 'pending'         // Optional, has default
      });

      console.log('Contract created:', contractResponse.data);
      return contractResponse.data.id;
    } catch (error) {
      console.error('Error creating contract:', error);
      
      // Better error handling
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        setErrorMessage(`Server error: ${error.response.data.error || error.response.statusText}`);
      } else if (error.request) {
        // The request was made but no response was received
        setErrorMessage('No response received from server. Please check if the server is running.');
      } else {
        // Something happened in setting up the request that triggered an Error
        setErrorMessage(`Error: ${error.message}`);
      }
      
      throw error;
    }
  };

  // Upload the PDF to the server
  const uploadPdfToServer = async (file, contractId) => {
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('contractId', contractId);
      
      const uploadResponse = await axios.post('http://localhost:3000/api/contracts/upload-pdf', formData);
      console.log('Upload response:', uploadResponse.data);
      
      return uploadResponse.data;
    } catch (error) {
      console.error('Error uploading PDF:', error);
      
      if (error.response) {
        setErrorMessage(`Upload error: ${error.response.data.error || error.response.statusText}`);
      } else if (error.request) {
        setErrorMessage('No response received from server during upload.');
      } else {
        setErrorMessage(`Upload error: ${error.message}`);
      }
      
      throw error;
    }
  };

  const processPdfWithQr = async (fileUrl, file) => {
    try {
      setIsUploading(true);
      setErrorMessage('');
      
      // Get QR code as PNG from canvas
      const canvas = qrRef.current.querySelector('canvas');
      const qrImageUrl = canvas.toDataURL('image/png');

      // Fetch the PDF and QR code image
      const existingPdfBytes = await fetch(fileUrl).then(res => res.arrayBuffer());
      const qrImageBytes = await fetch(qrImageUrl).then(res => res.arrayBuffer());

      // Load the PDF document
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

      // Embed the QR code image
      const qrImage = await pdfDoc.embedPng(qrImageBytes);
      const qrDims = qrImage.scale(0.15);

      // Add QR code to each page
      const pages = pdfDoc.getPages();
      pages.forEach(page => {
        const position = calculateQRPosition(page, qrDims);
        page.drawImage(qrImage, {
          x: position.x,
          y: position.y,
          width: qrDims.width,
          height: qrDims.height,
        });
      });

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();

      // Create blob and URL for the modified PDF
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const modifiedPdfUrl = URL.createObjectURL(blob);
      
      // Create a File object from the Blob to upload
      const modifiedFile = new File([blob], file.name, { type: 'application/pdf' });
      
      // Create a contract and get the ID
      console.log('Creating contract...');
      const newContractId = await createContract();
      console.log('Contract created with ID:', newContractId);
      setContractId(newContractId);
      
      // Upload the modified PDF
      console.log('Uploading PDF...');
      await uploadPdfToServer(modifiedFile, newContractId);
      console.log('PDF uploaded successfully');
      
      // Update the viewer with the modified PDF
      setDocs([{ uri: modifiedPdfUrl }]);
      
      // Keep track of the current file for the chat component
      setCurrentFile(modifiedFile);
      
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert(`Error processing PDF: ${errorMessage || error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      await processPdfWithQr(fileUrl, file);
    }
  };

  const handleDownload = async () => {
    if (!docs[0]?.uri) {
      alert('No PDF to download');
      return;
    }

    const response = await fetch(docs[0].uri);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'document-with-qr.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!docs[0]?.uri) {
      alert('No PDF to print');
      return;
    }
    window.open(docs[0].uri, '_blank');
  };

  return (
    <div className="pdf-viewer-container">
      <div className="main-content">
        <div className="upload-section">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="file-input"
            disabled={isUploading}
          />
          {isUploading && <p>Uploading and processing PDF...</p>}
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>
        <div className="controls-section">
          <button 
            onClick={handleDownload} 
            className="control-button"
            disabled={!docs.length || isUploading}
          >
            Download PDF
          </button>
          <button 
            onClick={handlePrint} 
            className="control-button"
            disabled={!docs.length || isUploading}
          >
            Print PDF
          </button>
        </div>
        {docs.length > 0 && (
          <div className="viewer-section">
            <DocViewer
              documents={docs}
              pluginRenderers={DocViewerRenderers}
              style={{ height: "calc(100vh - 100px)" }}
            />
          </div>
        )}
      </div>
      <div className="chat-section">
        <ChatBox currentPdfFile={currentFile} contractId={contractId} />
      </div>
      {/* Hidden QR Code component */}
      <div style={{ display: 'none' }} ref={qrRef}>
        <QRCodeCanvas value={qrValue} size={256} />
      </div>
    </div>
  );
}

export default PDFViewer;