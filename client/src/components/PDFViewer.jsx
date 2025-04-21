import React, { useState, useRef } from 'react';
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { PDFDocument } from 'pdf-lib';
import { QRCodeCanvas } from 'qrcode.react';

function PDFViewer() {
  const [docs, setDocs] = useState([]);
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

    // You can change this to any position from the positions object
    return positions.topRight; // or positions.topLeft, positions.bottomRight, etc.
  };

  const processPdfWithQr = async (fileUrl) => {
    try {
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
      const qrDims = qrImage.scale(0.15); // You can adjust this scale factor

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

      // Update the viewer with the modified PDF
      setDocs([{ uri: modifiedPdfUrl }]);
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Error processing PDF. Please try again.');
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      // Instead of setting docs immediately, process the PDF first
      await processPdfWithQr(fileUrl);
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
    link.download = 'dummy.pdf';
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
      <div className="upload-section">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="file-input"
        />
      </div>

      <div className="controls-section">
        <button 
          onClick={handleDownload} 
          className="control-button"
          disabled={!docs.length}
        >
          Download PDF
        </button>
        <button 
          onClick={handlePrint} 
          className="control-button"
          disabled={!docs.length}
        >
          Print PDF
        </button>
      </div>

      {/* Hidden QR Code component */}
      <div style={{ display: 'none' }} ref={qrRef}>
        <QRCodeCanvas value={qrValue} size={256} />
      </div>

      {docs.length > 0 && (
        <div className="viewer-section">
          <DocViewer
            documents={docs}
            pluginRenderers={DocViewerRenderers}
            style={{ height: "calc(100vh - 200px)" }}
          />
        </div>
      )}
    </div>
  );
}

export default PDFViewer; 