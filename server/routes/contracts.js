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
    const filePath = path.join(__dirname, '..', 'contracts_files', 'contract1.pdf');
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
    // const prompt = `
    //   You are a real estate expert. You are given a contract text created by a real estate agent. 
    //   Assist the user in summarizing/explaining the contract details. 
    //   You are to provide a detailed explanation of any questions the buyer has about the contract, including the terms, conditions, and any other relevant information.
    //   If you feel that the contract is not disadvantageous to the buyer, you should suggest renegotiating the terms
    //   and provide a detailed revision that would be fair for both parties.
    //   Here is the contract text: ${extractedText}

    //   but briefly greet the user first and introduce yourself as a real estate ai then wait for the user to ask a question
    // `;

    const prompt = `
      You are a real estate expert. 
      Assist the user in summarizing/explaining the contract details. 
      You are to provide a detailed explanation of any questions the buyer has about the contract, including the terms, conditions, and any other relevant information.
      If you feel that the contract is not disadvantageous to the buyer, you should suggest renegotiating the terms
      and provide a detailed revision that would be fair for both parties.
      
      base your answer on this contract detail:
      **Real Estate Purchase Agreement** **Parties** _Buyer:_ John Doe _Address:_ 123 Main St, Anytown, USA _Phone:_ (123) 456-7890 _Email:_ johndoe@example.com _Seller:_ Jane Smith _Address:_ 456 Elm St, Anytown, USA _Phone:_ (987) 654-3210 _Email:_ janesmith@example.com **Property** _Legal Description:_ Lot 1, Block 2, Anytown Subdivision _Address:_ 789 Oak St, Anytown, USA **Purchase Price and Terms** _Purchase Price:_ $200,000 _Deposit:_ $5,000 _Payment Terms:_ Cash **Inspections and Contingencies** _Inspection Period:_ 10 days _Financing Contingency:_ Yes _Seller's Disclosure:_ Yes _Appraisal Contingency:_ Yes _Title Insurance:_ Yes **Closing Date** _Closing Date:_ September 1, 2022 _Time:_ 1:00 PM **Escrow Agent** _Escrow Agent:_ ABC Escrow Company _Address:_ 101 Pine St, Anytown, USA _Phone:_ (111) 222-3333 **Representations and Warranties** The Seller represents and warrants that: 1. The Seller has good and marketable title to the Property, free and clear of any liens or encumbrances, except for any exceptions agreed upon by the Parties. 2. The Seller has the full power and authority to sell the Property and to enter into this Agreement. 3. The Property is in compliance with all applicable laws, codes, and regulations. **Buyer's Obligations** The Buyer agrees to: 1. Deposit the Earnest Money with the Escrow Agent within 5 days of executing this Agreement. 2. Conduct any necessary inspections within the Inspection Period. 3. Pay the Purchase Price at the Closing, subject to any contingencies set forth in this Agreement. **Seller's Obligations** The Seller agrees to: 1. Provide a Title Insurance Policy at the Seller's expense. 2. Correct any title defects discovered within the Inspection Period. 3. Transfer good and marketable title to the Property at the Closing. **Miscellaneous** This Agreement shall be governed by the laws of California. 

      but briefly greet the user first and introduce yourself as a real estate ai then wait for the user to ask a question
    `;
  
    // const prompt = `
    //   hi
    // `
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






// New route to analyze a contract by ID
router.get('/:id/analyze', async (req, res) => {
  try {
    // Get the contract from the database
    // const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
    
    // if (!contract) {
    //   return res.status(404).json({ error: 'Contract not found' });
    // }

    const filePath = path.join(__dirname, '..', 'contracts_files', '1744612705419-159912386-dummy.pdf');
    console.log('Attempting to read file at:', filePath);
    
    const text = await extractTextFromPDF(filePath);
    const analysis = await analyzeContract(text);
    
    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing contract:', error);
    res.status(500).json({ error: 'Failed to analyze contract' });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { question, context } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const prompt = `
      You are a real estate expert. A user has asked a question about their contract.
      Previous context: ${JSON.stringify(context)}
      User's question: ${question}
      Please provide a helpful and detailed response to their question.
    `;

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

    const answer = response.data.choices[0].message.content;
    res.json({ answer });
  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

module.exports = router;

