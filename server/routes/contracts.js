const express = require('express');
const router = express.Router();
const db = require('../db/database');
require('dotenv').config();
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');


db.prepare(`
    CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        tenant_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        monthly_rent INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties(id),
        FOREIGN KEY (tenant_id) REFERENCES users(id)
    )
`).run();

router.get('/', (req, res) => {
    try {
        const contracts = db.prepare('SELECT * FROM contracts').all();
        res.json(contracts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


async function extractTextFromPDF(filePath) {
  try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
  } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw error;
  }
}

router.get('/test', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', 'contracts_files', '1744612705419-159912386-dummy.pdf');
    console.log('Attempting to read file at:', filePath);
    
    const text = await extractTextFromPDF(filePath);
    res.status(200).json({ text });
  } catch (error) {
    console.error('Error analyzing contract:', error);
    res.status(500).json({ error: 'Failed to analyze contract' });
  }
});



router.get('/:id', (req, res) => {
    try {
        const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        res.json(contract);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', (req, res) => {
    try {
        const { property_id, buyer_id, seller_id, status, contract_detail } = req.body;
        
        if (!property_id || !buyer_id || !seller_id || !status || !contract_detail) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const property = db.prepare('SELECT id FROM properties WHERE id = ?').get(property_id);
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        const buyer = db.prepare('SELECT id FROM users WHERE id = ?').get(buyer_id);
        if (!buyer) {
            return res.status(404).json({ error: 'Buyer not found' });
        }

        const seller = db.prepare('SELECT id FROM users WHERE id = ?').get(seller_id);
        if (!seller) {
            return res.status(404).json({ error: 'Seller not found' });
        }

        const result = db.prepare(`
            INSERT INTO contracts (property_id, buyer_id, seller_id, status, contract_detail)
            VALUES (?, ?, ?, ?, ?)
        `).run(property_id, buyer_id, seller_id, status, contract_detail);

        const newContract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newContract);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', (req, res) => {
    try {
        const { status, contract_detail } = req.body;
        
        const existingContract = db.prepare('SELECT id FROM contracts WHERE id = ?').get(req.params.id);
        if (!existingContract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        const result = db.prepare(`
            UPDATE contracts 
            SET status = COALESCE(?, status),
                contract_detail = COALESCE(?, contract_detail)
            WHERE id = ?
        `).run(status, contract_detail, req.params.id);

        const updatedContract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
        res.json(updatedContract);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', (req, res) => {
    try {
        const existingContract = db.prepare('SELECT id FROM contracts WHERE id = ?').get(req.params.id);
        if (!existingContract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
        res.json({ message: 'Contract deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/buyer/:buyerId', (req, res) => {
    try {
        const contracts = db.prepare('SELECT * FROM contracts WHERE buyer_id = ?').all(req.params.buyerId);
        res.json(contracts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/seller/:sellerId', (req, res) => {
    try {
        const contracts = db.prepare('SELECT * FROM contracts WHERE seller_id = ?').all(req.params.sellerId);
        res.json(contracts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/property/:propertyId', (req, res) => {
    try {
        const contracts = db.prepare('SELECT * FROM contracts WHERE property_id = ?').all(req.params.propertyId);
        res.json(contracts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


async function analyzeContract(extractedText) {
  console.log(extractedText);
    const prompt = `
      You are a real estate expert. You are given a text created by a real estate agent. 
      Here is the contract text: ${extractedText}
      Describe exactly what is says.

      Introduce yourself as a real estate AI assistant with ONE brief sentence, then provide a short overview of what's in the contract (2-3 sentences maximum).
    `;

    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "openchat/openchat-7b", 
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": "http://localhost:3000", 
            "Content-Type": "application/json",
          },
        }
      );
  
      const messageContent = response.data.choices[0].message.content;
      return messageContent;
    } catch (error) {
      console.error("Error analyzing contract:", error.message);
      throw new Error("Failed to analyze contract");
    }
  }


//   //pdf readerzr
// const uploadDir = path.join(__dirname, 'uploads');
//     if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir);
// }

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'contracts_files/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const contractId = req.body.contractId;
    
    if (!contractId) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Contract ID is required' });
    }

    const contract = db.prepare('SELECT id FROM contracts WHERE id = ?').get(contractId);
    // if (!contract) {
    //   fs.unlinkSync(req.file.path);
    //   return res.status(404).json({ error: 'Contract not found' });
    // }

    const pdfPath = req.file.path;
    db.prepare(`
      UPDATE contracts 
      SET contract_detail = ?
      WHERE id = ?
    `).run(pdfPath, contractId);

    res.status(200).json({ 
      message: 'PDF uploaded successfully',
      filePath: pdfPath,
      contractId: contractId
    });
  } catch (error) {
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/pdf', (req, res) => {
  try {
    const contractId = req.params.id;
    console.log(`Trying to fetch PDF for contract ID: ${contractId}`);
    
    const contract = db.prepare('SELECT contract_detail FROM contracts WHERE id = ?').get(contractId);
    
    if (!contract) {
      console.log(`Contract not found for ID: ${contractId}. Looking for a default file to serve.`);
      
      // Try to find the first PDF in the contracts_files directory as a fallback
      const filesDir = path.join(__dirname, '..', 'contracts_files');
      
      if (fs.existsSync(filesDir)) {
        const files = fs.readdirSync(filesDir).filter(file => file.endsWith('.pdf'));
        
        if (files.length > 0) {
          // Use the first PDF file as a fallback
          const fallbackFile = path.join(filesDir, files[0]);
          console.log(`Using fallback PDF: ${fallbackFile}`);
          
          // Create a contract record for this file if it doesn't exist
          try {
            const insertResult = db.prepare(`
              INSERT INTO contracts (id, property_id, tenant_id, start_date, end_date, monthly_rent, contract_detail, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              contractId,
              1, // Default property_id
              1, // Default tenant_id
              new Date().toISOString().split('T')[0], // start_date
              new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], // end_date
              1000, // Default monthly_rent
              fallbackFile,
              'active'
            );
            console.log(`Created new contract record with ID ${contractId} for fallback file: ${insertResult.lastInsertRowid}`);
          } catch (dbError) {
            console.log(`Could not create contract record: ${dbError.message}. Serving fallback file anyway.`);
          }
          
          return res.sendFile(path.resolve(fallbackFile));
        }
      }
      
      return res.status(404).json({ error: 'Contract not found and no fallback PDF available' });
    }

    const filePath = contract.contract_detail;
    console.log(`File path from database: ${filePath}`);
    
    if (!filePath) {
      console.log('File path is empty or null');
      return res.status(404).json({ error: 'No PDF file associated with this contract' });
    }
    
    if (!fs.existsSync(filePath)) {
      console.log(`File does not exist at path: ${filePath}`);
      
      // Try looking in the contracts_files directory directly
      const fileName = path.basename(filePath);
      const alternativePath = path.join(__dirname, '..', 'contracts_files', fileName);
      console.log(`Trying alternative path: ${alternativePath}`);
      
      if (fs.existsSync(alternativePath)) {
        console.log(`File found at alternative path: ${alternativePath}`);
        return res.sendFile(path.resolve(alternativePath));
      }
      
      // Try to find any PDF in the contracts_files directory as a fallback
      const filesDir = path.join(__dirname, '..', 'contracts_files');
      
      if (fs.existsSync(filesDir)) {
        const files = fs.readdirSync(filesDir).filter(file => file.endsWith('.pdf'));
        
        if (files.length > 0) {
          // Use the first PDF file as a fallback
          const fallbackFile = path.join(filesDir, files[0]);
          console.log(`Using fallback PDF for contract ${contractId}: ${fallbackFile}`);
          
          // Update the contract with the new file path
          db.prepare(`
            UPDATE contracts 
            SET contract_detail = ?
            WHERE id = ?
          `).run(fallbackFile, contractId);
          
          return res.sendFile(path.resolve(fallbackFile));
        }
      }
      
      return res.status(404).json({ error: 'PDF file not found on server' });
    }

    console.log(`Sending file from: ${path.resolve(filePath)}`);
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error serving PDF file:', error);
    res.status(500).json({ error: error.message });
  }
});






// New route to analyze a contract by ID
router.get('/:id/analyze', async (req, res) => {
  try {
    console.log(`Received analysis request for contract ID: ${req.params.id}`);
    // Get the contract from the database
    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    
    if (!contract) {
      console.log(`Contract not found for ID: ${req.params.id}, using a sample file`);
    }

    // Try to find a contract file
    let filePath;
    if (contract && contract.contract_detail) {
      filePath = contract.contract_detail;
      console.log(`Using contract file from database: ${filePath}`);
    } else {
      // Use a sample file for testing
      filePath = path.join(__dirname, '..', 'contracts_files', '1744612705419-159912386-dummy.pdf');
      console.log(`Using sample file: ${filePath}`);
    }
    
    console.log('Extracting text from PDF file...');
    const text = await extractTextFromPDF(filePath);
    console.log(`Extracted ${text.length} characters from PDF`);
    
    console.log('Sending text to AI for analysis...');
    const analysis = await analyzeContract(text);
    console.log('Analysis completed successfully');
    
    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing contract:', error);
    res.status(500).json({ error: 'Failed to analyze contract' });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { question, context } = req.body;
    console.log(`Received question: "${question.substring(0, 50)}${question.length > 50 ? '...' : ''}"`);
    console.log(`Context length: ${context ? context.length : 0} messages`);
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Check the context to determine if this is a follow-up question
    const isFollowUp = Array.isArray(context) && context.length > 0;
    console.log(`Is follow-up question: ${isFollowUp}`);

    const prompt = isFollowUp 
      ? `
        You are a real estate expert who has already introduced yourself to the user.
        Previous conversation: ${JSON.stringify(context)}
        User's new question: ${question}
        Provide a direct answer to the user's question without re-introducing yourself.
      `
      : `
        You are a real estate expert. A user has asked their first question about a contract.
        User's question: ${question}
        Provide a helpful response, but do not repeat your introduction.
      `;

    console.log('Sending question to AI...');
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openchat/openchat-7b",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:3000",
          "Content-Type": "application/json",
        },
      }
    );

    console.log('Received AI response');
    const answer = response.data.choices[0].message.content;
    res.json({ answer });
  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

module.exports = router;

