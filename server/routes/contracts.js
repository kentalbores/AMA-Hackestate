const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const db = new Database('../db/database.db');
require('dotenv').config();
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');


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


async function analyzeContract(contract) {
    const prompt = `
      You are a real estate expert. You are given a contract created by a real estate agent. 
      Assist the buyer in summarizing/explaining the contract details. 
      Provide a detailed explanation of the contract, including the terms, conditions, and any other relevant information.
      If you feel that the contract is not disadvantageous to the buyer, you should suggest renegotiating the terms
      and provide a detailed revision that would be fair for both parties.
      The contract is in the form of a pdf file.
      Here is the contract: ${contract}
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
      console.error("Error estimating property value:", error.message);
      throw new Error("Failed to estimate property value");
    }
  }


//   //pdf readerzr
// const uploadDir = path.join(__dirname, 'uploads');
//     if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir);
// }

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'server/contracts_files/');
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
    if (!contract) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Contract not found' });
    }

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
    const contract = db.prepare('SELECT contract_detail FROM contracts WHERE id = ?').get(req.params.id);
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const filePath = contract.contract_detail;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    res.sendFile(path.resolve(filePath));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

