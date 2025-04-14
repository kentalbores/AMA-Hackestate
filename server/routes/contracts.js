const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const db = new Database('./database.db');
// db.prepare(`
//     CREATE TABLE IF NOT EXISTS contracts (
//         id INTEGER PRIMARY KEY AUTOINCREMENT,
//         property_id INTEGER NOT NULL,
//         tenant_id INTEGER NOT NULL,
//         start_date TEXT NOT NULL,
//         end_date TEXT NOT NULL,
//         monthly_rent INTEGER NOT NULL,
//         status TEXT DEFAULT 'active',
//         created_at TEXT DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (property_id) REFERENCES properties(id),
//         FOREIGN KEY (tenant_id) REFERENCES users(id)
//     )
// `).run();

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

module.exports = router;

