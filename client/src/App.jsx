import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Home from './components/Home';
import PDFViewer from './components/PDFViewer';
import Text from './components/Text';
import Profile from './components/Profile';
import './App.css';
import PropertyListing from './components/PropertyListing';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/pdf-viewer" element={<PDFViewer />} />
        <Route path="/upload" element={<Text />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/listings" element={<PropertyListing />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
